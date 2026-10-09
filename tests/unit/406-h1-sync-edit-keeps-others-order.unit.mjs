// H1-SYNC-7: every flush that sent an edit also sent the list's order, built from this browser's list as it was last
// read. A device that had not read the account since another device moved a job (a drag on the job board is the array
// order) put the old order back with its next edit of ANY job, and the move was undone on the account, then on the
// device that made it, with no word. Now an order is sent when the flush changes it: a move, a deletion, an item the
// account lacks (a new job, a conflict copy). An edit of jobs the account has sends the job and not the order.
// The real engine, plan and io over a fake Firestore two devices share. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const META = 'users/A/meta/jobs';

const job = (id, role, updatedAt) => ({
  id, company: 'Acme', role, status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});

function device(cloud, items = []) {
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
    ids: () => list.map((x) => x.id),
    start: async (user) => { sync.start(user); await settle(); },
    edit: (id, patch, updatedAt) => set(list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt } : x))),
    add: (j) => set([...list, j]),
    reorder: (ids) => set(ids.map((id) => list.find((x) => x.id === id))),
  };
}

async function twoDevices(cloud) {
  const d1 = device(cloud, [job('j1', 'One', 1), job('j2', 'Two', 1), job('j3', 'Three', 1)]);
  await d1.start(A);
  const d2 = device(cloud);
  await d2.start(A);
  assert.deepEqual(d2.ids(), ['j1', 'j2', 'j3']);
  return { d1, d2 };
}

test('an edit made on a device that has not read the account since another device moved a job does not undo the move', async () => {
  const cloud = fakeFirestore();
  const { d1, d2 } = await twoDevices(cloud);

  d2.reorder(['j3', 'j1', 'j2']);
  await d2.timers.fire();
  assert.deepEqual(cloud.doc(META).order, ['j3', 'j1', 'j2']);

  d1.edit('j2', { role: 'Two, edited' }, 5); // d1 still has the old order
  await d1.timers.fire();
  assert.equal(cloud.doc('users/A/jobs/j2').role, 'Two, edited', 'the edit is sent');
  assert.deepEqual(cloud.doc(META).order, ['j3', 'j1', 'j2'], 'the move stays');

  await d2.start(A); // d2 reads the account again
  assert.deepEqual(d2.ids(), ['j3', 'j1', 'j2'], 'and d2 still has it');
});

test('a new job still sends the order it joins', async () => {
  const cloud = fakeFirestore();
  const { d1 } = await twoDevices(cloud);
  d1.add(job('j4', 'Four', 6));
  await d1.timers.fire();
  assert.deepEqual(cloud.doc(META).order, ['j1', 'j2', 'j3', 'j4']);
});

test('a move still sends the order', async () => {
  const cloud = fakeFirestore();
  const { d1 } = await twoDevices(cloud);
  d1.reorder(['j2', 'j3', 'j1']);
  await d1.timers.fire();
  assert.deepEqual(cloud.doc(META).order, ['j2', 'j3', 'j1']);
});
