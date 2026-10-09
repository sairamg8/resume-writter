// H1-SYNC-6: a job imported from a file has the id the file gives it, the same on every browser that imports that file
// (as the demo job's id is the same on all). A flush reads the cloud's copy of what it sends and writes only if the
// copies it read are still there (collectionSyncIo.commit): but one that was not there was written with no check
// at all, except for the demo's id. Another device writing the same imported job between the read and the write was
// overwritten with this device's older copy, an edit with it. Now a copy read as absent is expected to still be
// absent when the write is a few jobs, and the flush decides again from the copy that appeared.
// The real engine, plan and io over a fake Firestore. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const IMPORTED = 'users/A/jobs/imp1';

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
    get: (id) => list.find((x) => x.id === id),
    start: async (user) => { sync.start(user); await settle(); },
    add: (j) => set([...list, j]),
  };
}

test('an imported job another device writes while this flush reads it is not overwritten', async () => {
  const cloud = fakeFirestore();
  const d = device(cloud, [job('base', 'Engineer', 1)]);
  await d.start(A);

  // The file's job, imported here (older copy); the same job, edited since, is sent by another device right after
  // this flush has read the account and found nothing.
  d.add(job('imp1', 'Imported', 100));
  let landed = false;
  cloud.afterRead = (path) => {
    if (path !== IMPORTED || landed) return;
    landed = true;
    cloud.data.set(IMPORTED, { ...job('imp1', 'Edited on the other device', 200), syncRev: 1, syncBy: 'dev-other' });
  };
  await d.timers.fire();

  assert.equal(cloud.doc(IMPORTED).role, 'Edited on the other device', 'the account keeps the later edit');
  assert.equal(d.get('imp1').role, 'Edited on the other device', 'and this device shows it');
  assert.equal(d.seen.status, 'synced');
});

test('an imported job nobody else wrote is sent as before', async () => {
  const cloud = fakeFirestore();
  const d = device(cloud, [job('base', 'Engineer', 1)]);
  await d.start(A);
  d.add(job('imp1', 'Imported', 100));
  await d.timers.fire();
  assert.equal(cloud.doc(IMPORTED).role, 'Imported');
  assert.equal(d.seen.status, 'synced');
});
