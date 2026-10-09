// H1-SYNC-24: a deletion this browser sent is kept in its record as deleted (DELETED) so that an item put back after it (Undo)
// is a change after the deletion: kept, and taken off the account's deleted list. The record forgot it at the first sync
// after the one that sent it (a restart: the connection back, a refresh), and an Undo made after THAT put back a job the next
// first sync took for one typed before signing in whose id the account had deleted — dropped, with the user's Undo, here and
// from the list. Now the deletion stays in the record while the account lists the id as deleted. Found by the three-device
// script once its Undo kept no exemption (410).
// The real engine, plan and io over a fake Firestore. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

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
  const timers = manualTimers();
  const { seen, report } = recorder();
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers });
  return {
    timers, seen, set,
    ids: () => list.map((x) => x.id),
    start: async (user) => { sync.start(user); await settle(); },
    items: () => list,
  };
}
const jobsIn = (cloud) => [...cloud.data.keys()].filter((p) => p.startsWith('users/A/jobs/')).toSorted();

test('an Undo made after a restart that followed the deletion keeps the job, here and in the account', async () => {
  const cloud = fakeFirestore();
  const d = device(cloud, [job('j1', '[1]', 100), job('j2', '[2]', 110)]);
  await d.start(A);
  const was = d.items();

  d.set(d.items().filter((x) => x.id !== 'j1')); // deleted
  await d.timers.fire(); // the deletion reaches the account
  assert.deepEqual(jobsIn(cloud), ['users/A/jobs/j2']);
  await d.start(A); // the connection came back: a first sync, which has nothing to send
  assert.deepEqual(d.ids(), ['j2']);

  d.set(was); // Undo
  await d.start(A); // another restart before the Undo's own write was sent
  await d.timers.fire();
  await settle(10);
  assert.deepEqual(d.ids().toSorted(), ['j1', 'j2'], 'the job is still here');
  assert.deepEqual(jobsIn(cloud), ['users/A/jobs/j1', 'users/A/jobs/j2'], 'and in the account');
  assert.equal(cloud.doc('users/A/meta/jobs').deleted.includes('j1'), false, 'and no longer listed as deleted');
});

test('a deletion made on another device is not kept in the record: an old copy of it is still dropped', async () => {
  const cloud = fakeFirestore();
  const d1 = device(cloud, [job('j1', '[1]', 100), job('j2', '[2]', 110)]);
  await d1.start(A);
  const d2 = device(cloud, []);
  await d2.start(A);
  d1.set(d1.items().filter((x) => x.id !== 'j1'));
  await d1.timers.fire();
  await d2.start(A); // learns of it
  assert.deepEqual(d2.ids(), ['j2']);
  d2.set([job('j1', '[1]', 100), ...d2.items()]); // an old copy of the deleted job turns up (a stale tab's list)
  await d2.start(A);
  assert.deepEqual(d2.ids(), ['j2'], 'dropped, as a stale copy of a job deleted elsewhere');
});
