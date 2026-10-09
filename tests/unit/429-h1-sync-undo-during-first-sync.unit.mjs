// H1-SYNC-29: a deletion this browser sent is kept in its record as deleted (424), so that an item put back after it (Undo) is a
// change after the deletion. A first sync dropped it from the record for the jobs put back WHILE it was on its way — in the
// list, but in no copy the sync wrote or read: the record had nothing for them, and the next sync took them for jobs typed
// before signing in whose id the account had deleted, and dropped them with the user's Undo. Now the record keeps the deletion
// as their base, as it keeps the copy an edit typed then was made on (414). Found by the three-device script (410).
// The real engine, plan and io over a fake Firestore; the first sync's batch waits at a gate while the Undo is made.
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
const jobsIn = (cloud) => [...cloud.data.keys()].filter((p) => p.startsWith('users/A/jobs/')).toSorted();

test('jobs put back by Undo while the first sync sends are kept by the sync after it', async () => {
  const cloud = fakeFirestore();
  let list = [job('j1', '[1]', 100), job('j2', '[2]', 110)];
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.company,
  };
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
  sync.start(A);
  await settle();
  const was = list;

  set([]); // Clear all jobs
  await timers.fire(); // the deletion lands
  assert.deepEqual(jobsIn(cloud), []);
  set([job('n9', '[9]', 400)]); // a new job, so the next first sync has a write to send
  armed = true;
  sync.start(A); // a restart: its first sync's batch waits
  await settle();
  set([...list, ...was]); // Undo
  gate.resolve();
  await settle(10);
  sync.start(A); // and the sync after it
  await settle(10);
  await timers.fire();
  await settle(10);

  assert.deepEqual(list.map((x) => x.id).toSorted(), ['j1', 'j2', 'n9'], 'the jobs put back are still here');
  assert.deepEqual(jobsIn(cloud), ['users/A/jobs/j1', 'users/A/jobs/j2', 'users/A/jobs/n9'], 'and in the account');
  assert.equal(seen.status, 'synced');
});
