// H1-SYNC-14: the first sync takes the cloud's newer copy of a job it finds unchanged here and, as the flush does
// (402), keeps an edit typed while its batch is on the way — an edit made on the copy BEFORE the cloud's, which this
// browser has not seen. It then recorded the cloud's copy as seen by this browser, so the edit's own write was the only
// change as far as the record could tell and went over the other device's edit with no conflict copy (whichever clock
// stamped the edit): the other device's work existed nowhere. Now the record keeps what it had for such a job, and the
// edit's write finds the cloud's copy moved and this one changed: the older of the two is kept as a conflict copy.
// Found by the three-device script with jittered server calls (410).
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

const job = (id, notes, updatedAt) => ({
  id, company: 'Acme', role: 'Engineer', status: 'applied', todos: [], notes,
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});

/** This browser: j1 as it last saw the account's (time 100, rev 1), the account's order out of date. */
function setup() {
  const cloud = fakeFirestore({
    'users/A/jobs/j1': { ...job('j1', '[1] [3]', 2000), syncRev: 2, syncBy: 'dev-other' },
    'users/A/meta/jobs': { order: [], deleted: [] },
  });
  let list = [job('j1', '[1]', 100)];
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.company, conflictCopy: jobConflictCopy,
  };
  // The next batch waits for the gate; the ones after it do not.
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
  const meta = memoryMeta({ uid: 'A', versions: { j1: 100 }, revs: { j1: 1 }, device: 'dev-here', order: null, stashed: {} });
  const timers = manualTimers();
  const { seen, report } = recorder();
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(fs, cloud.db, 'jobs'), store, meta, report, timers });
  return {
    cloud, seen, timers,
    hold: () => { armed = true; },
    release: async () => { gate.resolve(); await settle(10); },
    start: async () => { sync.start(A); await settle(); },
    edit: (notes, updatedAt) => set(list.map((x) => (x.id === 'j1' ? { ...x, notes, updatedAt } : x))),
  };
}
const notesInCloud = (cloud) => [...cloud.data].filter(([p]) => p.startsWith('users/A/jobs/')).map(([, v]) => v.notes).toSorted();

async function editedWhileBatchIsOnItsWay(editAt) {
  const d = setup();
  d.hold();
  await d.start(); // the first sync takes the account's j1 and sends the order; the batch waits
  d.edit('[1] [5]', editAt); // typed on the copy this browser has
  await d.release();
  await d.timers.fire(); // the edit's own write
  return d;
}

test('an edit typed while the first sync\'s batch is on its way, stamped before the cloud\'s copy: both are kept', async () => {
  const d = await editedWhileBatchIsOnItsWay(1500);
  assert.deepEqual(notesInCloud(d.cloud), ['[1] [3]', '[1] [5]'], 'the other device\'s edit and this one');
  assert.equal(d.cloud.doc('users/A/jobs/j1').notes, '[1] [3]', 'the later of the two stays the job');
  assert.equal(d.seen.status, 'synced');
});

test('the same, stamped after the cloud\'s copy', async () => {
  const d = await editedWhileBatchIsOnItsWay(2500);
  assert.deepEqual(notesInCloud(d.cloud), ['[1] [3]', '[1] [5]']);
  assert.equal(d.cloud.doc('users/A/jobs/j1').notes, '[1] [5]');
});
