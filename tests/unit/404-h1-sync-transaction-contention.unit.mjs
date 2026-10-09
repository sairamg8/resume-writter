// H1-SYNC-5: the SDK runs a transaction again when a document it read changes under it, and out of tries (five)
// rejects with the code of the last one, `failed-precondition`. The sync took that for a refusal for good, as any code
// that is not on its list of temporary ones: the one job it was writing was held back ("too large") and the sync
// said "stopped", though nothing was wrong with the job. Now it is what it is, a copy found changed: the sync
// decides again, and when it keeps happening tries later like any temporary failure; nothing is held.
// The real engine, plan and io over a fake Firestore whose documents keep changing under the transaction.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };

const job = (id, role, updatedAt) => ({
  id, company: 'Acme', role, status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});

function device(cloud, items) {
  let list = items;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.role,
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers });
  return {
    timers, seen,
    start: async (user) => { sync.start(user); await settle(); },
    edit: (id, patch, updatedAt) => set(list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt } : x))),
  };
}

test('a transaction out of tries is a copy that kept changing: nothing is held, and the edit goes at the retry', async () => {
  const cloud = fakeFirestore();
  const d = device(cloud, [job('a1', 'Engineer', 1)]);
  await d.start(A);

  // Another device's write lands after every read (the same content, a new document: the transaction's check fails).
  cloud.afterRead = (path) => { const v = cloud.data.get(path); if (v && path.includes('/jobs/')) cloud.data.set(path, { ...v }); };
  d.edit('a1', { role: 'Staff Engineer' }, 5);
  await d.timers.fire();
  assert.deepEqual(d.seen.held, [], 'the job is not held back as one the cloud refuses');
  assert.equal(d.seen.status, 'error', 'it says it will retry, not "stopped"');

  cloud.afterRead = null;
  await d.timers.fire(); // the retry: a first sync
  assert.equal(d.seen.status, 'synced');
  assert.equal(cloud.doc('users/A/jobs/a1').role, 'Staff Engineer', 'the edit reached the account');
});
