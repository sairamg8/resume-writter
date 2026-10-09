// CYCD-SYNC (c, d): a write with no precondition. A sync reads the cloud's copy of an item, decides,
// and writes — and a batch overwrites whatever is there when it lands. Another device writing the same item
// between the read and the write (a few seconds on a slow link), or two devices flushing at the same moment,
// had one edit silently replaced by the other: no conflict copy, no notice. Now the write is a transaction that
// reads the copies it was decided from again (their version, writer and time) and writes nothing if one
// changed: the sync reads again and decides from what is there — an edit kept as a conflict copy, an edit
// winning over a deletion — up to three times, then it is tried later like any failure.
// The real engine, plan and io over a fake Firestore (its transactions apply the server's check). Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { jobConflictCopy } from '../../src/utils/collectionSyncConflict.js';
import { deferred, fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const REFRESH = 10_000;

const job = (id, role, updatedAt, extra = {}) => ({
  id, company: 'Acme', role, status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt, ...extra,
});
const J1 = 'users/A/jobs/j1';
const roles = (list) => list.map((j) => j.role).toSorted();
const cloudRoles = (cloud) => [...cloud.data.keys()].filter((p) => p.startsWith('users/A/jobs/')).map((p) => cloud.doc(p).role).toSorted();

/** A device with a writer id of its own. */
function device(cloud, name, { items = [], online = () => true } = {}) {
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
  const record = { uid: null, versions: {}, revs: {}, device: name, order: null, stashed: {} };
  let clock = 0;
  const sync = createCollectionSync({
    name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: memoryMeta(record), report,
    online, timers, refreshAfter: REFRESH, now: () => clock,
  });
  return {
    sync, timers, seen, notices,
    list: () => list,
    ids: () => list.map((x) => x.id),
    get: (id) => list.find((x) => x.id === id),
    start: async () => { sync.start(A); await settle(); },
    refresh: async () => { clock += REFRESH; sync.shown(); await settle(); },
    edit: (id, patch, updatedAt) => set(list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt } : x))),
    remove: (id) => set(list.filter((x) => x.id !== id)),
  };
}

/** Devices 'dev-a' and 'dev-b' in sync on job j1 (rev 1, written by dev-a). */
async function twoDevices(cloud) {
  const a = device(cloud, 'dev-a', { items: [job('j1', 'Engineer', 1)] });
  await a.start();
  let online = true;
  const b = device(cloud, 'dev-b', { online: () => online });
  await b.start();
  assert.deepEqual(b.ids(), ['j1']);
  return { a, b, offline: async () => { online = false; await b.start(); }, back: async () => { online = true; await b.start(); } };
}

/** Device a's write lands in the account the moment `path` has been read: rev 2, written by dev-a. */
function otherWriteAfterRead(cloud, path, doc) {
  cloud.afterRead = (read) => {
    if (read !== path) return;
    cloud.afterRead = null;
    cloud.data.set(J1, { ...doc, syncRev: 2, syncBy: 'dev-a' });
  };
}

test('(d) a flush: another device writes the item between its read and its write — both edits are kept', async () => {
  const cloud = fakeFirestore();
  const { b } = await twoDevices(cloud);
  otherWriteAfterRead(cloud, J1, job('j1', 'Role of a', 25));
  b.edit('j1', { role: 'Role of b' }, 30);
  await b.timers.fire();

  assert.deepEqual(cloudRoles(cloud), ['Role of a', 'Role of b'], 'the account holds both: the job and a conflict copy');
  assert.equal(cloud.doc(J1).role, 'Role of b', 'the later edit stays the job');
  assert.deepEqual(roles(b.list()), ['Role of a', 'Role of b']);
  assert.deepEqual(b.notices, ['Acme — Role of b'], 'and the notice names it');
  assert.equal(b.seen.status, 'synced');
});

test('(d) a flush that deletes: an edit made elsewhere during its read wins over the deletion', async () => {
  const cloud = fakeFirestore();
  const { b } = await twoDevices(cloud);
  // Device b deletes j1 (it has the copy of rev 1); device a's edit lands while b reads.
  cloud.afterRead = (read) => {
    if (read !== J1) return;
    cloud.afterRead = null;
    cloud.data.set(J1, { ...job('j1', 'Role of a', 25), syncRev: 2, syncBy: 'dev-a' });
  };
  b.remove('j1');
  await b.timers.fire();

  assert.equal(cloud.doc(J1)?.role, 'Role of a', 'the edit is still in the account');
  assert.deepEqual(cloud.doc('users/A/meta/jobs').deleted ?? [], [], 'and not listed as deleted');
  assert.deepEqual(b.ids(), ['j1'], 'it comes back here');
  assert.equal(b.get('j1').role, 'Role of a');
});

test('(d) a first sync: another device writes the item between its read and its write — both edits are kept', async () => {
  const cloud = fakeFirestore();
  const { b, offline, back } = await twoDevices(cloud);
  await offline();
  b.edit('j1', { role: 'Role of b' }, 30);
  otherWriteAfterRead(cloud, 'users/A/jobs', job('j1', 'Role of a', 25));
  await back();

  assert.deepEqual(cloudRoles(cloud), ['Role of a', 'Role of b']);
  assert.equal(cloud.doc(J1).role, 'Role of b');
  assert.deepEqual(roles(b.list()), ['Role of a', 'Role of b']);
  assert.deepEqual(b.notices, ['Acme — Role of b']);
});

test('(c) two devices flushing the same item at the same moment: neither edit replaces the other', async () => {
  const cloud = fakeFirestore();
  const { a, b } = await twoDevices(cloud);
  a.edit('j1', { role: 'Role of a' }, 25);
  b.edit('j1', { role: 'Role of b' }, 30);
  const gate = deferred();
  cloud.hold.read = gate.promise; // both read the account before either writes
  await a.timers.fire();
  await b.timers.fire();
  cloud.hold.read = null;
  gate.resolve();
  await settle(15);

  assert.deepEqual(cloudRoles(cloud), ['Role of a', 'Role of b'], 'the job and a conflict copy, not one edit');
  assert.equal(cloud.doc(J1).role, 'Role of b', 'the later edit is the job, whichever landed first');
  await a.refresh();
  await b.refresh();
  assert.deepEqual(roles(a.list()), ['Role of a', 'Role of b']);
  assert.deepEqual(a.ids(), b.ids(), 'and both devices hold the same two');
});

test('a cloud that keeps changing under a flush: three tries, then it is tried later and the edit is not lost', async () => {
  const cloud = fakeFirestore();
  const { b } = await twoDevices(cloud);
  // Something of this browser's own (another tab) writes the item again after every read of it.
  let rev = 1;
  cloud.afterRead = (read) => {
    if (read !== J1) return;
    rev += 1;
    cloud.data.set(J1, { ...job('j1', 'Role of the other tab', 100 + rev), syncRev: rev, syncBy: 'dev-b' });
  };
  b.edit('j1', { role: 'Role of b' }, 30);
  await b.timers.fire();
  assert.equal(b.seen.status, 'error', 'the flush says it will retry');
  assert.equal(b.get('j1').role, 'Role of b', 'the edit is still here');
  assert.ok(b.timers.count > 0, 'and a retry is set');

  cloud.afterRead = null;
  await b.timers.fire(); // the retry: a first sync
  assert.equal(b.seen.status, 'synced');
  assert.equal(cloud.doc(J1).role, 'Role of b', 'the edit reached the account');
});
