// CYCD-SYNC (b): a device whose clock is behind. The sync told "changed on the other device" and
// "changed here" by comparing wall-clock updatedAt values, so an edit stamped EARLIER than the copy it was
// made on (a slow clock; the copy came from a device with a fast one) looked unchanged — and lost to the
// copy it should have replaced, or was dropped with no conflict copy when the other side had changed too.
// Now whether the cloud's copy moved is read from its version (syncRev / syncBy) and whether this browser's
// copy changed from its updatedAt DIFFERING from the one recorded (not being later): one side only changed it,
// that side stays whatever the clocks say; both, both are kept, as before.
// The real engine, plan and io over a fake Firestore two devices share. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { jobConflictCopy } from '../../src/utils/collectionSyncConflict.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const REFRESH = 10_000;
const FAST = 1000; // the fast clock's stamp on the job both devices start from

const job = (id, company, updatedAt = FAST, extra = {}) => ({
  id, company, role: 'Engineer', status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt, ...extra,
});

/** A device: its own in-memory list, sync record and timers, the engine over `cloud`. */
function device(cloud, items = [], { online = () => true } = {}) {
  let list = items;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d,
    label: (j) => [j.company, j.role].filter(Boolean).join(' — '),
    conflictCopy: jobConflictCopy,
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const notices = [];
  report.conflict = (names) => { if (names) notices.push(...names); };
  let clock = 0;
  const sync = createCollectionSync({
    name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report,
    online, timers, refreshAfter: REFRESH, now: () => clock,
  });
  return {
    sync, timers, seen, notices,
    list: () => list,
    ids: () => list.map((x) => x.id),
    get: (id) => list.find((x) => x.id === id),
    start: async () => { sync.start(A); await settle(); },
    edit: (id, patch, updatedAt) => set(list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt } : x))),
    remove: (id) => set(list.filter((x) => x.id !== id)),
  };
}

/** Job j1 stamped by a fast clock, synced to both devices; device 2's connection can be switched off. */
async function twoDevices(cloud) {
  const d1 = device(cloud, [job('j1', 'Acme')]);
  await d1.start();
  let online = true;
  const d2 = device(cloud, [], { online: () => online });
  await d2.start();
  assert.equal(d2.get('j1').updatedAt, FAST, 'device 2 holds the fast clock\'s copy');
  return {
    d1, d2,
    offline: async () => { online = false; await d2.start(); },
    back: async () => { online = true; await d2.start(); },
  };
}

const SLOW = 500; // earlier than the copy the slow device edits

test('a slow clock\'s edit is the only change: it is sent, not replaced by the older-looking copy it was made on', async () => {
  const cloud = fakeFirestore();
  const { d2 } = await twoDevices(cloud);
  d2.edit('j1', { role: 'Staff Engineer' }, SLOW);
  await d2.timers.fire();

  assert.equal(cloud.doc('users/A/jobs/j1').role, 'Staff Engineer', 'the account has the edit');
  assert.equal(d2.get('j1').role, 'Staff Engineer', 'and it stays here');
  assert.deepEqual(d2.ids(), ['j1']);
  assert.deepEqual(d2.notices, []);
  assert.equal(cloud.doc('users/A/jobs/j1').syncRev, 2);
});

test('the same, made offline and sent by the first sync when the connection is back', async () => {
  const cloud = fakeFirestore();
  const { d2, offline, back } = await twoDevices(cloud);
  await offline();
  d2.edit('j1', { role: 'Staff Engineer' }, SLOW);
  await back();

  assert.equal(d2.get('j1').role, 'Staff Engineer', 'kept here');
  assert.equal(cloud.doc('users/A/jobs/j1').role, 'Staff Engineer', 'and sent');
  assert.deepEqual(d2.ids(), ['j1']);
  assert.deepEqual(d2.notices, []);
});

test('both devices changed it, one with a slow clock: both are kept (the slow edit was dropped with no copy)', async () => {
  const cloud = fakeFirestore();
  const { d1, d2, offline, back } = await twoDevices(cloud);
  await offline();
  d2.edit('j1', { role: 'Staff Engineer' }, SLOW);
  d1.edit('j1', { role: 'Lead Engineer' }, FAST + 100);
  await d1.timers.fire();
  await back();

  assert.equal(d2.get('j1').role, 'Lead Engineer', 'the later stamp stays the job');
  const copy = d2.list().find((j) => j.id !== 'j1');
  assert.ok(copy, 'the slow device\'s edit is kept');
  assert.equal(copy.role, 'Staff Engineer');
  assert.equal(copy.company, 'Acme (conflict copy)');
  assert.deepEqual(d2.notices, ['Acme — Lead Engineer']);
  assert.equal(cloud.doc(`users/A/jobs/${copy.id}`).role, 'Staff Engineer');
});

test('the same when the slow device is online and sends its edit after the other\'s', async () => {
  const cloud = fakeFirestore();
  const { d1, d2 } = await twoDevices(cloud);
  d1.edit('j1', { role: 'Lead Engineer' }, FAST + 100);
  await d1.timers.fire();
  d2.edit('j1', { role: 'Staff Engineer' }, SLOW);
  await d2.timers.fire();

  assert.equal(d2.get('j1').role, 'Lead Engineer');
  const copy = d2.list().find((j) => j.id !== 'j1');
  assert.equal(copy?.role, 'Staff Engineer', 'the slow edit is a conflict copy, not dropped');
  assert.equal(cloud.doc('users/A/jobs/j1').role, 'Lead Engineer');
  assert.equal(cloud.doc(`users/A/jobs/${copy.id}`).role, 'Staff Engineer');
});

test('an edit made by a slow clock where the job was deleted wins over the deletion, as any edit does', async () => {
  const cloud = fakeFirestore();
  const { d1, d2, offline, back } = await twoDevices(cloud);
  await offline();
  d2.edit('j1', { role: 'Staff Engineer' }, SLOW);
  d1.remove('j1');
  await d1.timers.fire();
  await back();

  assert.deepEqual(d2.ids(), ['j1'], 'the edit is not lost to the deletion');
  assert.equal(cloud.doc('users/A/jobs/j1')?.role, 'Staff Engineer');
});

test('a deletion does not remove a copy a slow clock edited since it was seen', async () => {
  const cloud = fakeFirestore();
  const { d1, d2 } = await twoDevices(cloud);
  d2.edit('j1', { role: 'Staff Engineer' }, SLOW);
  await d2.timers.fire();
  d1.remove('j1'); // device 1 still holds the copy of t=1000
  await d1.timers.fire();

  assert.equal(cloud.doc('users/A/jobs/j1')?.role, 'Staff Engineer', 'the edit stays in the account');
  assert.deepEqual(d1.ids(), ['j1'], 'and comes back here');
});
