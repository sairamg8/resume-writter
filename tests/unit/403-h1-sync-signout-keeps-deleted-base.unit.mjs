// H1-SYNC-4: a job deleted here and not yet sent when the account signs out (offline, or within the pause) was kept
// aside with no version, only its id. At the next sign-in the first sync could not tell whether another device had
// edited it since this browser saw it, so it deleted it from the account: the other device's edit was lost, though
// every other path (a flush, a first sync without a sign-out between) keeps an edit made where the deletion was
// never seen. Now the version the deletion was made from is kept aside with the id, and that edit stays.
// The real engine, plan and io over a fake Firestore two devices share. Run: yarn test:unit
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
  const net = { online: true };
  const sync = createCollectionSync({
    name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers, online: () => net.online,
  });
  return {
    timers, seen, net,
    ids: () => list.map((x) => x.id),
    get: (id) => list.find((x) => x.id === id),
    start: async (user) => { sync.start(user); await settle(); },
    edit: (id, patch, updatedAt) => set(list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt } : x))),
    remove: (id) => set(list.filter((x) => x.id !== id)),
  };
}

/** Two devices on the account with j1 and j2; the first goes offline and deletes both. */
async function deletedOffline(cloud) {
  const d1 = device(cloud, [job('j1', 'Engineer', 1), job('j2', 'Designer', 1)]);
  await d1.start(A);
  const d2 = device(cloud);
  await d2.start(A);
  d1.net.online = false;
  await d1.start(A);
  d1.remove('j1');
  d1.remove('j2');
  return { d1, d2 };
}

test('a deletion kept aside at sign-out does not remove an edit another device made meanwhile', async () => {
  const cloud = fakeFirestore();
  const { d1, d2 } = await deletedOffline(cloud);

  d2.edit('j1', { role: 'Lead' }, 20);
  await d2.timers.fire();

  await d1.start(null); // signs out, offline: the deletions are kept aside, unsent
  d1.net.online = true;
  await d1.start(A); // signs in again

  assert.equal(cloud.doc('users/A/jobs/j1')?.role, 'Lead', 'the edited job stays in the account');
  assert.equal(d1.get('j1')?.role, 'Lead', 'and comes back here');
  assert.equal(cloud.doc('users/A/jobs/j2'), undefined, 'the one nobody touched is deleted, as asked');
  assert.deepEqual(d1.ids(), ['j1']);
  assert.equal(d1.seen.status, 'synced');
});

test('without an edit elsewhere, a deletion kept aside at sign-out still goes to the account', async () => {
  const cloud = fakeFirestore();
  const { d1 } = await deletedOffline(cloud);
  await d1.start(null);
  d1.net.online = true;
  await d1.start(A);
  assert.equal(cloud.doc('users/A/jobs/j1'), undefined);
  assert.equal(cloud.doc('users/A/jobs/j2'), undefined);
  assert.deepEqual(d1.ids(), []);
});
