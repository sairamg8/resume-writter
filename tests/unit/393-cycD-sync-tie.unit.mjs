// CYCD-SYNC (c, the tie): two devices change one job with the very same updatedAt (the same millisecond)
// and different content. Whichever device read the other's copy second kept its own as the job — so the
// same two copies gave a different job depending on who synced first — and a list that cannot make
// conflict copies never replaced the cloud's copy at all (this browser kept its own, the account the
// other's, for good). Now a tie goes to the greater writer id (syncBy): the same two copies, the same
// winner, whichever device finds the conflict and in whichever order they sync; and a tie is always settled
// (the winner is sent, or taken), with a conflict copy where the list makes them.
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
const TIE = 20;

const job = (id, role, updatedAt) => ({
  id, company: 'Acme', role, status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});

/** A device with a writer id of its own; `copies` false: a list that makes no conflict copies. */
function device(cloud, name, { items = [], online = () => true, copies = true } = {}) {
  let list = items;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d,
    label: (j) => [j.company, j.role].filter(Boolean).join(' — '),
    ...(copies ? { conflictCopy: jobConflictCopy } : {}),
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const record = { uid: null, versions: {}, revs: {}, device: name, order: null, stashed: {} };
  let clock = 0;
  const sync = createCollectionSync({
    name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: memoryMeta(record), report,
    online, timers, refreshAfter: REFRESH, now: () => clock,
  });
  return {
    sync, timers, seen,
    list: () => list,
    get: (id) => list.find((x) => x.id === id),
    start: async () => { sync.start(A); await settle(); },
    refresh: async () => { clock += REFRESH; sync.shown(); await settle(); },
    edit: (id, patch, updatedAt) => set(list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt } : x))),
  };
}

/** Devices 'dev-a' and 'dev-b' in sync on job j1; both then edit it at the same time stamp. */
async function twoDevices(cloud, options = {}) {
  const a = device(cloud, 'dev-a', { items: [job('j1', 'Engineer', 1)], ...options });
  await a.start();
  let online = true;
  const b = device(cloud, 'dev-b', { online: () => online, ...options });
  await b.start();
  assert.deepEqual(b.list().map((j) => j.id), ['j1']);
  return { a, b, offline: async () => { online = false; await b.start(); }, back: async () => { online = true; await b.start(); } };
}

const others = (d) => d.list().filter((j) => j.id !== 'j1').map((j) => j.role);

test('a tie in time, device a sent first and b reads it second (first sync): the greater id, b, stays the job', async () => {
  const cloud = fakeFirestore();
  const { a, b, offline, back } = await twoDevices(cloud);
  await offline();
  b.edit('j1', { role: 'Role of b' }, TIE);
  a.edit('j1', { role: 'Role of a' }, TIE);
  await a.timers.fire();
  await back();

  assert.equal(b.get('j1').role, 'Role of b');
  assert.deepEqual(others(b), ['Role of a'], 'a\'s edit is the copy');
  assert.equal(cloud.doc('users/A/jobs/j1').role, 'Role of b');
  await a.refresh();
  assert.equal(a.get('j1').role, 'Role of b');
  assert.deepEqual(others(a), ['Role of a']);
});

test('the same two copies, the other way round: device a reads b\'s second, and the job is still b\'s', async () => {
  const cloud = fakeFirestore();
  const b = device(cloud, 'dev-b', { items: [job('j1', 'Engineer', 1)] });
  await b.start();
  let online = true;
  const a = device(cloud, 'dev-a', { online: () => online });
  await a.start();
  assert.deepEqual(a.list().map((j) => j.id), ['j1']);
  online = false;
  await a.start();
  a.edit('j1', { role: 'Role of a' }, TIE);
  b.edit('j1', { role: 'Role of b' }, TIE);
  await b.timers.fire(); // b reaches the account first
  online = true;
  await a.start(); // a reads b's second: a tie

  assert.equal(a.get('j1').role, 'Role of b', 'the greater id stays the job on this device too');
  assert.deepEqual(others(a), ['Role of a'], 'and a\'s own edit is the copy');
  assert.equal(cloud.doc('users/A/jobs/j1').role, 'Role of b');
  await b.refresh();
  assert.equal(b.get('j1').role, 'Role of b');
  assert.deepEqual(others(b), ['Role of a']);
});

test('a tie when both send online: the same job stays, in either order', async () => {
  for (const order of [['a', 'b'], ['b', 'a']]) {
    const cloud = fakeFirestore();
    const devices = await twoDevices(cloud);
    devices.a.edit('j1', { role: 'Role of a' }, TIE);
    devices.b.edit('j1', { role: 'Role of b' }, TIE);
    for (const who of order) await devices[who].timers.fire();
    const second = devices[order[1]];
    assert.equal(cloud.doc('users/A/jobs/j1').role, 'Role of b', `${order.join(' then ')}: the greater id is the job in the account`);
    assert.equal(second.get('j1').role, 'Role of b', 'and on the device that sent second');
    assert.deepEqual(others(second), ['Role of a'], 'a\'s edit is the copy');
    assert.equal(cloud.doc(`users/A/jobs/${second.list().find((j) => j.id !== 'j1').id}`).role, 'Role of a');
  }
});

test('a list that makes no conflict copies still settles a tie: the account and both lists end on one copy', async () => {
  const cloud = fakeFirestore();
  const { a, b, offline, back } = await twoDevices(cloud, { copies: false });
  await offline();
  b.edit('j1', { role: 'Role of b' }, TIE);
  a.edit('j1', { role: 'Role of a' }, TIE);
  await a.timers.fire();
  await back();
  await a.refresh();

  const inCloud = cloud.doc('users/A/jobs/j1').role;
  assert.equal(b.get('j1').role, inCloud, 'device b holds what the account holds');
  assert.equal(a.get('j1').role, inCloud, 'and so does device a');
  assert.equal(inCloud, 'Role of b', 'the greater id');
});
