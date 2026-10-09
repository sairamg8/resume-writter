// H1-SYNC-26: a start (the connection back, a refresh) begins a new line and drops the result of a flush it finds on its way;
// the request that flush had handed to the cloud still lands. The new line's first sync read the cloud before it landed and
// wrote its record after: a "Clear all" whose deletion landed after the user's Undo and after the restart's read left every
// job in the list with a version, and in the cloud with none — the record's deletion (noted when the request landed) was
// overwritten by the copies the first sync had read, and the next first sync took the jobs for ones deleted on another device
// and dropped them here: the Undo lost. Now a first sync's record keeps what landed during it for the ids it did not write
// itself, and the jobs put back are sent again at once.
// The real engine, plan and io over a fake Firestore; the flush's request and the restart's read each wait at a gate.
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

test('a deletion that landed during the restart\'s first sync, after an Undo: the jobs put back are kept and sent again', async () => {
  const cloud = fakeFirestore();
  let list = [job('j1', '[1]', 100), job('j2', '[2]', 110)];
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.company,
  };
  const write = deferred(); // the flush's request
  const read = deferred(); // the answer of the restart's read of the items
  let writeArmed = false;
  let readArmed = false;
  const hold = (run) => {
    if (!writeArmed) return run();
    writeArmed = false;
    return write.promise.then(run);
  };
  const fs = {
    ...cloud.fs,
    writeBatch: (db) => {
      const batch = cloud.fs.writeBatch(db);
      return { set: (...a) => batch.set(...a), delete: (...a) => batch.delete(...a), commit: () => hold(() => batch.commit()) };
    },
    runTransaction: (db, update) => hold(() => cloud.fs.runTransaction(db, update)),
    // The snapshot is taken at once and handed over when the gate opens: a read that began before the request landed.
    getDocsFromServer: async (col) => {
      const snapshot = await cloud.fs.getDocsFromServer(col);
      if (readArmed) { readArmed = false; await read.promise; }
      return snapshot;
    },
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers });
  sync.start(A);
  await settle();
  const was = list;

  set([]); // Clear all jobs
  writeArmed = true;
  await timers.fire(); // the flush has read the cloud and handed over its request, which waits
  set(was); // Undo
  readArmed = true;
  sync.start(A); // the connection came back: a new line, and its first sync
  await settle();
  write.resolve(); // the deletion lands
  await settle(10);
  read.resolve();
  await settle(10);
  await timers.fire(); // the jobs put back are sent again
  await settle(10);
  assert.deepEqual(list.map((x) => x.id).toSorted(), ['j1', 'j2'], 'both jobs are still here');
  assert.deepEqual(jobsIn(cloud), ['users/A/jobs/j1', 'users/A/jobs/j2'], 'and in the account');
  assert.equal(seen.status, 'synced');

  sync.start(A); // and the next first sync keeps them
  await settle(10);
  assert.deepEqual(list.map((x) => x.id).toSorted(), ['j1', 'j2']);
  assert.deepEqual(jobsIn(cloud), ['users/A/jobs/j1', 'users/A/jobs/j2']);
});
