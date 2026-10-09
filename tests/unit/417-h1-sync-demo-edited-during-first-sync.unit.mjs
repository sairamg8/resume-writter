// H1-SYNC-17: the first visit's demo job has one id on every browser. A browser that signs in shows its untouched demo, and
// the account's copy wins over it (the demo carries nothing typed). If the user writes in the demo while that first sync's
// batch is on the way, the edit stays — but it was made on a copy no cloud copy descends from, and the record claimed the
// account's copy as seen: the edit's own write went over the account's copy (an edit of the demo made on another device)
// with no conflict copy, whichever clock stamped it. Now such an edit's base is the copy it was made on, and the account's
// copy a change after it: both are kept. An untouched demo in the account holds nothing typed and is kept as no copy, nor
// does it replace the edit whatever the clocks say. Found by the three-device script with the demo job (410).
// The real engine, plan and io over a fake Firestore; the first sync's batch (the order only) waits at a gate.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { jobConflictCopy } from '../../src/utils/collectionSyncConflict.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { deferred, fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };

const demo = (notes, updatedAt) => ({
  id: 'demo', company: 'Acme', role: 'Engineer', status: 'applied', todos: [], notes,
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});

/** A browser showing its untouched demo, signing in to an account that holds the demo as `cloudCopy` says. */
function setup(cloudCopy) {
  const cloud = fakeFirestore({
    'users/A/jobs/demo': { ...cloudCopy, syncRev: 2, syncBy: 'dev-other' },
    'users/A/meta/jobs': { order: [], deleted: [] },
  });
  let list = [demo('', 50)];
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.company, conflictCopy: jobConflictCopy,
    seed: (j) => j.id === 'demo' && j.notes === '', seedIds: ['demo'],
  };
  const gate = deferred();
  let armed = false;
  const fs = {
    ...cloud.fs,
    writeBatch: (db) => {
      const batch = cloud.fs.writeBatch(db);
      return {
        set: (...a) => batch.set(...a),
        delete: (...a) => batch.delete(...a),
        commit: () => {
          if (!armed) return batch.commit();
          armed = false;
          return gate.promise.then(() => batch.commit());
        },
      };
    },
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers });
  return {
    cloud, seen, timers,
    hold: () => { armed = true; },
    release: async () => { gate.resolve(); await settle(10); },
    start: async () => { sync.start(A); await settle(); },
    write: (notes, updatedAt) => set(list.map((x) => ({ ...x, notes, updatedAt }))),
    shown: () => list.map((x) => x.notes),
  };
}
const jobsIn = (cloud) => [...cloud.data].filter(([p]) => p.startsWith('users/A/jobs/')).map(([, v]) => v.notes).toSorted();

async function writtenInWhileFirstSyncSendsItsBatch(cloudCopy, at) {
  const d = setup(cloudCopy);
  d.hold();
  await d.start(); // the first sync takes the account's demo and sends the order; the batch waits
  d.write('[7]', at); // the user writes in the demo
  await d.release();
  await d.timers.fire(); // the edit's own write
  return d;
}

test('the account\'s demo was written in on another device: both edits are kept, whichever clock is ahead', async () => {
  for (const [at, stays] of [[400, '[6]'], [2500, '[7]']]) {
    const d = await writtenInWhileFirstSyncSendsItsBatch(demo('[6]', 903), at);
    assert.deepEqual(jobsIn(d.cloud), ['[6]', '[7]'], `at ${at}`);
    assert.equal(d.cloud.doc('users/A/jobs/demo').notes, stays);
    assert.equal(d.seen.status, 'synced');
  }
});

test('the account\'s demo is untouched: the edit is the demo, with no copy of the untouched one', async () => {
  for (const at of [20, 400]) {
    const d = await writtenInWhileFirstSyncSendsItsBatch(demo('', 903), at);
    assert.deepEqual(jobsIn(d.cloud), ['[7]'], `at ${at}`);
    assert.deepEqual(d.shown(), ['[7]']);
  }
});
