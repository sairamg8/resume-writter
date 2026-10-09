// CYC8-S1 (live path): after the first sync every change is sent by a flush, which reads the
// cloud's copy of each item it writes first. One another device changed later was taken and this
// device's queued edit dropped with no word — and one this device changed later overwrote the
// other device's edit just as silently. Now, when both changed the item since this browser last
// saw the cloud's copy (its record, or what it sent itself since), to different content, the
// older copy is kept beside the newer one as a conflict copy, sent in the same batch, and reported
// for the notice. Own quick edits are no conflict (the record only has a version once the cloud
// acknowledged it), nor is an equal content; a failed flush retried does not make a second copy.
// The real engine, plan and io over a fake Firestore two devices share. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { jobConflictCopy } from '../../src/utils/collectionSyncConflict.js';
import { deferred, fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const REFRESH = 10_000;

const job = (id, company, updatedAt = 1) => ({
  id, company, role: 'Engineer', status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});

function device(cloud, items = []) {
  let list = items;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => [j.company, j.role].filter(Boolean).join(' — '),
    conflictCopy: jobConflictCopy,
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const notices = [];
  report.conflict = (names) => { if (names) notices.push(...names); };
  let clock = 0;
  const sync = createCollectionSync({
    name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report,
    timers, refreshAfter: REFRESH, now: () => clock,
  });
  return {
    sync, timers, seen, notices,
    ids: () => list.map((x) => x.id),
    get: (id) => list.find((x) => x.id === id),
    start: async () => { sync.start(A); await settle(); },
    refresh: async () => { clock += REFRESH; sync.shown(); await settle(); },
    edit: (id, patch, updatedAt) => set(list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt } : x))),
    remove: (id) => set(list.filter((x) => x.id !== id)),
  };
}

/** Two devices online and in sync on job j1 (Acme, t=1). */
async function twoDevices(cloud) {
  const d1 = device(cloud, [job('j1', 'Acme')]);
  await d1.start();
  const d2 = device(cloud, []);
  await d2.start();
  assert.deepEqual(d2.ids(), ['j1']);
  return { d1, d2 };
}
const cloudJobs = (cloud) => [...cloud.data.keys()].filter((p) => p.startsWith('users/A/jobs/'));

test('this device\'s edit is newer than the one the other device sent: the other\'s is kept as a copy', async () => {
  const cloud = fakeFirestore();
  const { d1, d2 } = await twoDevices(cloud);
  d2.edit('j1', { role: 'Staff Engineer' }, 30);
  d1.edit('j1', { role: 'Lead Engineer' }, 20);
  await d1.timers.fire(); // the other device\'s edit gets there first
  await d2.timers.fire();

  assert.equal(d2.get('j1').role, 'Staff Engineer');
  const copy = d2.get(d2.ids().find((id) => id !== 'j1'));
  assert.deepEqual([copy.company, copy.role], ['Acme (conflict copy)', 'Lead Engineer'], 'the overwritten edit is the copy');
  assert.deepEqual(d2.ids(), ['j1', copy.id]);
  assert.equal(cloud.doc('users/A/jobs/j1').role, 'Staff Engineer');
  assert.equal(cloud.doc(`users/A/jobs/${copy.id}`).role, 'Lead Engineer', 'sent in the same batch');
  assert.deepEqual(cloud.doc('users/A/meta/jobs').order, ['j1', copy.id]);
  assert.deepEqual(d2.notices, ['Acme — Staff Engineer']);
  assert.equal(d2.seen.status, 'synced');
  assert.equal(d2.timers.count, 0, 'nothing left to send');

  await d1.refresh();
  assert.deepEqual(d1.ids(), ['j1', copy.id], 'the other device gets both');
  assert.deepEqual(d1.notices, []);
});

test('the cloud\'s copy is newer than this device\'s queued edit: that edit is the copy, the cloud\'s stays', async () => {
  const cloud = fakeFirestore();
  const { d1, d2 } = await twoDevices(cloud);
  d2.edit('j1', { role: 'Staff Engineer' }, 15);
  d1.edit('j1', { role: 'Lead Engineer' }, 20);
  await d1.timers.fire();
  await d2.timers.fire();

  assert.equal(d2.get('j1').role, 'Lead Engineer', 'the newer copy is the job');
  const copy = d2.get(d2.ids().find((id) => id !== 'j1'));
  assert.deepEqual([copy.company, copy.role], ['Acme (conflict copy)', 'Staff Engineer'], 'the dropped edit is kept');
  assert.equal(cloud.doc(`users/A/jobs/${copy.id}`).role, 'Staff Engineer');
  assert.equal(cloud.doc('users/A/jobs/j1').role, 'Lead Engineer');
  assert.deepEqual(d2.notices, ['Acme — Lead Engineer']);
  assert.equal(d2.timers.count, 0);
});

test('own quick edits are no conflict: the cloud holds this device\'s first edit while the record still lacks it', async () => {
  const cloud = fakeFirestore();
  const { d1 } = await twoDevices(cloud);
  const ack = deferred();
  cloud.hold.commit = ack.promise; // the server\'s answer is slow
  d1.edit('j1', { role: 'Lead Engineer' }, 10);
  await d1.timers.fire(); // the batch is applied; its answer is awaited
  d1.edit('j1', { role: 'Principal Engineer' }, 20);
  await d1.timers.fire(); // reads the cloud: it holds the copy sent just before
  ack.resolve();
  await settle();

  assert.deepEqual(d1.ids(), ['j1'], 'no copy of this device\'s own earlier edit');
  assert.deepEqual(d1.notices, []);
  assert.equal(cloud.doc('users/A/jobs/j1').role, 'Principal Engineer');
  assert.equal(cloudJobs(cloud).length, 1);
});

test('no copy when both made the same change', async () => {
  const cloud = fakeFirestore();
  const { d1, d2 } = await twoDevices(cloud);
  d2.edit('j1', { role: 'Staff Engineer' }, 30);
  d1.edit('j1', { role: 'Staff Engineer' }, 20);
  await d1.timers.fire();
  await d2.timers.fire();
  assert.deepEqual(d2.ids(), ['j1'], 'equal content: no copy');
  assert.deepEqual(d2.notices, []);
  assert.equal(cloudJobs(cloud).length, 1);
});

test('no copy when the other device deleted the job: this edit wins over the deletion, as before', async () => {
  const cloud = fakeFirestore();
  const { d1, d2 } = await twoDevices(cloud);
  d1.remove('j1');
  d2.edit('j1', { role: 'Fellow' }, 50);
  await d1.timers.fire(); // the deletion gets there first
  await d2.timers.fire();
  assert.deepEqual(d2.ids(), ['j1']);
  assert.deepEqual(d2.notices, []);
  assert.equal(cloud.doc('users/A/jobs/j1').role, 'Fellow');
  assert.equal(cloudJobs(cloud).length, 1);
});

test('a flush that failed after the copy was kept is retried without a second copy', async () => {
  const cloud = fakeFirestore();
  const { d1, d2 } = await twoDevices(cloud);
  d2.edit('j1', { role: 'Staff Engineer' }, 30);
  d1.edit('j1', { role: 'Lead Engineer' }, 20);
  await d1.timers.fire();
  cloud.fail.commit = Object.assign(new Error('The service is currently unavailable.'), { code: 'unavailable' });
  await d2.timers.fire(); // the copy is kept here, its batch fails
  assert.equal(d2.ids().length, 2);
  cloud.fail.commit = null;
  await d2.timers.fire(); // the retry: a first sync
  await settle();

  assert.equal(d2.ids().length, 2, 'still one copy here');
  assert.equal(cloudJobs(cloud).length, 2, 'and one in the account');
  assert.equal(cloud.doc('users/A/jobs/j1').role, 'Staff Engineer');
  assert.equal(d2.seen.status, 'synced');
});
