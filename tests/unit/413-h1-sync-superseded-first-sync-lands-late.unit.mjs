// H1-SYNC-13: a start (going online, a refresh, an account change) drops the result of the first sync it replaces, but a
// write that sync had already handed over still lands. Its items were new to the account, and a write of new items
// carried no precondition: arriving after the newer first sync's, it put the OLDER copy of an item over the newer one the
// user had edited meanwhile, and the next sync took the account's copy for the truth. The edit was lost on every device
// with no word. Now a first sync's few new items are written expecting them still absent, as a flush's are: the late
// write finds the item there and stops. Found by the three-device script with jittered server calls (410).
// The real engine, plan and io over a fake Firestore; the first sync's write waits (a gate around the write calls).
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { deferred, fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };

const job = (id, notes, updatedAt) => ({
  id, company: 'Acme', role: 'Engineer', status: 'applied', todos: [], notes,
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});

function device(cloud, items) {
  let list = items;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.company,
  };
  // The next write (a batch or a transaction) waits for the gate; the ones after it do not.
  const gate = deferred();
  let armed = false;
  const hold = (run) => {
    if (!armed) return run();
    armed = false;
    return gate.promise.then(run);
  };
  const fs = {
    ...cloud.fs,
    writeBatch: (db) => {
      const batch = cloud.fs.writeBatch(db);
      return { set: (...a) => batch.set(...a), delete: (...a) => batch.delete(...a), commit: () => hold(() => batch.commit()) };
    },
    runTransaction: (db, update) => hold(() => cloud.fs.runTransaction(db, update)),
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers });
  return {
    seen,
    get: (id) => list.find((x) => x.id === id),
    hold: () => { armed = true; },
    release: async () => { gate.resolve(); await settle(10); },
    start: async (user) => { sync.start(user); await settle(); },
    edit: (id, patch, updatedAt) => set(list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt } : x))),
  };
}

test('a first sync replaced by a start does not put its older copy over the newer one when its write lands late', async () => {
  const cloud = fakeFirestore();
  const d = device(cloud, [job('n3', '[3]', 303)]);
  d.hold();
  await d.start(A); // the first sync has read the account and handed over its write, which waits
  d.edit('n3', { notes: '[3] [6]' }, 603); // typed meanwhile
  await d.start(A); // going online again: a new first sync, which sends the edit
  assert.equal(cloud.doc('users/A/jobs/n3').notes, '[3] [6]', 'the new first sync sent the edit');

  await d.release(); // the old write lands
  assert.equal(cloud.doc('users/A/jobs/n3').notes, '[3] [6]', 'the account keeps the edit');
  assert.equal(d.get('n3').notes, '[3] [6]');
  assert.equal(d.seen.status, 'synced');
});
