// CYCD-SYNC (foundation): every job and project document the collection sync writes now carries a
// version, `syncRev` (up by one with each write), and its writer, `syncBy` (the browser's id, kept in the
// sync record as `device`); the record keeps the `revs` it last saw beside its `versions`. Nothing
// else changes shape, so the previous site (the old UI) still reads everything written here: the two fields
// are only added to an item document, never to the list the store holds, no key, path or rule moves, and a
// document or record without them (an older build's, the old site's) reads as rev 0 / none and syncs on.
// The real engine, plan, io and record over a fake Firestore. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { forgetSynced, localMeta, memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { leaveList, stashOf } from '../../src/utils/collectionSyncPlan.js';
import { jobConflictCopy, boardConflictCopy, sameContent } from '../../src/utils/collectionSyncConflict.js';
import { stampOf, splitStamp } from '../../src/utils/collectionSyncRev.js';
import { createBoard } from '../../src/utils/boardModel.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const REFRESH = 10_000;

const job = (id, company, updatedAt = 1, extra = {}) => ({
  id, company, role: 'Engineer', status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt, ...extra,
});

/** The two fields the sync adds, taken off a cloud document: what an older reader never looked at. */
const legacyView = (doc) => { const { syncRev: _r, syncBy: _b, ...rest } = doc; return rest; };

/** A device: its own in-memory list, sync record and timers, the engine over `cloud`. */
function device(cloud, kind, items = [], { online = () => true, record = null } = {}) {
  let list = items;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const jobs = kind === 'jobs';
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d,
    label: jobs ? (j) => [j.company, j.role].filter(Boolean).join(' — ') : (b) => b.title,
    conflictCopy: jobs ? jobConflictCopy : boardConflictCopy,
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const meta = record ? memoryMeta(record) : memoryMeta();
  let clock = 0;
  const sync = createCollectionSync({
    name: kind, io: collectionIo(cloud.fs, cloud.db, kind), store, meta, report,
    online, timers, refreshAfter: REFRESH, now: () => clock,
  });
  return {
    sync, timers, seen, meta,
    list: () => list,
    ids: () => list.map((x) => x.id),
    get: (id) => list.find((x) => x.id === id),
    start: async (user) => { sync.start(user); await settle(); },
    refresh: async () => { clock += REFRESH; sync.shown(); await settle(); },
    edit: (id, patch, updatedAt) => set(list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt } : x))),
  };
}

test('the first sync writes each job with rev 1 and this browser as its writer; the list holds neither field', async () => {
  const cloud = fakeFirestore();
  const mine = [job('j1', 'Acme'), job('j2', 'Beta')];
  const d1 = device(cloud, 'jobs', mine);
  await d1.start(A);

  const doc = cloud.doc('users/A/jobs/j1');
  assert.equal(doc.syncRev, 1);
  assert.ok(doc.syncBy, 'a writer');
  assert.equal(doc.syncBy, d1.meta.read().device, 'the id the sync record keeps');
  assert.equal(cloud.doc('users/A/jobs/j2').syncRev, 1);
  assert.deepEqual(legacyView(doc), job('j1', 'Acme'), 'an older reader sees the job as it always was');
  assert.deepEqual(d1.list(), mine, 'the store\'s list never holds the sync\'s fields');
  assert.deepEqual(d1.meta.read().revs, { j1: 1, j2: 1 }, 'the record keeps the revs it last saw');
  assert.deepEqual(d1.meta.read().versions, { j1: 1, j2: 1 }, 'beside its versions, unchanged');
});

test('each write of a job is one rev above the cloud\'s copy, by whichever device made it', async () => {
  const cloud = fakeFirestore();
  const d1 = device(cloud, 'jobs', [job('j1', 'Acme'), job('j2', 'Beta')]);
  await d1.start(A);
  const d2 = device(cloud, 'jobs');
  await d2.start(A);
  assert.deepEqual(d2.list().map((j) => j.id), ['j1', 'j2']);
  assert.deepEqual(d2.list(), [job('j1', 'Acme'), job('j2', 'Beta')], 'a job taken from the cloud holds neither field');
  assert.deepEqual(d2.meta.read().revs, { j1: 1, j2: 1 }, 'and this browser records the revs it saw');
  assert.notEqual(d1.meta.read().device, d2.meta.read().device, 'each browser has an id of its own');

  d1.edit('j1', { role: 'Lead Engineer' }, 10);
  await d1.timers.fire();
  assert.equal(cloud.doc('users/A/jobs/j1').syncRev, 2);
  assert.equal(cloud.doc('users/A/jobs/j2').syncRev, 1, 'a job nobody wrote again keeps its rev');
  assert.equal(d1.meta.read().revs.j1, 2);

  await d2.refresh();
  d2.edit('j1', { role: 'Staff Engineer' }, 20);
  await d2.timers.fire();
  const doc = cloud.doc('users/A/jobs/j1');
  assert.equal(doc.syncRev, 3, 'the other device writes the next one');
  assert.equal(doc.syncBy, d2.meta.read().device);
  assert.equal(d2.meta.read().revs.j1, 3);
  assert.deepEqual(d2.ids(), ['j1', 'j2'], 'and no conflict copy: it had seen rev 2');
});

test('a project is stamped the same way', async () => {
  const cloud = fakeFirestore();
  const roadmap = { ...createBoard({ title: 'Roadmap', key: 'RD' }, { now: 1 }), id: 'b1' };
  const d1 = device(cloud, 'boards', [roadmap]);
  await d1.start(A);
  const doc = cloud.doc('users/A/boards/b1');
  assert.equal(doc.syncRev, 1);
  assert.equal(doc.syncBy, d1.meta.read().device);
  assert.deepEqual(legacyView(doc), JSON.parse(JSON.stringify(roadmap)));
  assert.deepEqual(d1.list(), [roadmap]);

  d1.edit('b1', { description: 'Q4' }, 5);
  await d1.timers.fire();
  assert.equal(cloud.doc('users/A/boards/b1').syncRev, 2);
});

test('rollback safety: a document and a record without the new fields sync on, and only the two fields and the record\'s two are added', async () => {
  // What the account holds after the previous site, or an older build: no syncRev, no syncBy.
  const cloud = fakeFirestore({
    'users/A/jobs/j1': job('j1', 'Acme', 5),
    'users/A/jobs/j2': job('j2', 'Beta', 5),
    'users/A/meta/jobs': { order: ['j1', 'j2'], deleted: ['old'] },
  });
  const record = { uid: 'A', versions: { j1: 5, j2: 5 }, order: ['j1', 'j2'], stashed: {} }; // the shape saved before this change
  const d1 = device(cloud, 'jobs', [job('j1', 'Acme', 5), job('j2', 'Beta', 5)], { record });
  await d1.start(A);
  assert.equal(d1.seen.status, 'synced');
  assert.deepEqual(cloud.doc('users/A/jobs/j1'), job('j1', 'Acme', 5), 'nothing was written: no stamp is added to a job nobody changed');
  assert.deepEqual(d1.meta.read().revs, { j1: 0, j2: 0 }, 'a copy with no rev is rev 0');

  d1.edit('j1', { role: 'Lead Engineer' }, 9);
  await d1.timers.fire();
  const doc = cloud.doc('users/A/jobs/j1');
  assert.equal(doc.syncRev, 1, 'rev 0 and one more');
  assert.deepEqual(legacyView(doc), job('j1', 'Acme', 9, { role: 'Lead Engineer' }));
  assert.deepEqual(Object.keys(doc).toSorted(), [...Object.keys(job('j1', 'Acme')), 'syncBy', 'syncRev'].toSorted(), 'only the two fields are new');
  assert.deepEqual(Object.keys(cloud.doc('users/A/meta/jobs')).toSorted(), ['deleted', 'order'], 'the lists\' document keeps its fields');
  assert.deepEqual([...cloud.data.keys()].filter((p) => !p.startsWith('users/A/jobs/')), ['users/A/meta/jobs'], 'no other path');
});

test('the sync record: the new fields are added and read back; a record saved without them reads as none', () => {
  const storage = new Map();
  const place = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => { storage.set(k, v); } };
  const record = localMeta('k', () => place);
  storage.set('k', JSON.stringify({ uid: 'A', versions: { j1: 1 }, order: ['j1'], stashed: {} }));
  assert.deepEqual(record.read(), { uid: 'A', versions: { j1: 1 }, revs: {}, device: null, order: ['j1'], stashed: {} }, 'the previous shape');

  record.write({ uid: 'A', versions: { j1: 1 }, revs: { j1: 4 }, device: 'dev_x', order: ['j1'], stashed: {} });
  assert.deepEqual(record.read().revs, { j1: 4 });
  assert.equal(record.read().device, 'dev_x');
  assert.deepEqual(Object.keys(JSON.parse(storage.get('k'))).toSorted(), ['device', 'order', 'revs', 'stashed', 'uid', 'versions'], 'the old keys, and two more');

  storage.set('k', JSON.stringify({ uid: 'A', versions: { j1: 1 }, revs: 'x', device: 7, stashed: {} }));
  assert.deepEqual([record.read().revs, record.read().device], [{}, null], 'junk reads as none');

  record.write({ uid: 'A', versions: { j1: 1 }, revs: { j1: 4 }, device: 'dev_x', order: ['j1'], stashed: {} });
  forgetSynced('k', () => place);
  assert.deepEqual([record.read().versions, record.read().revs, record.read().device], [{}, {}, 'dev_x'], 'a list read in part forgets what the cloud holds, rev included; the device stays');
});

test('leaving the account keeps the revs of what was not sent, and the browser\'s own id', () => {
  const meta = { uid: 'A', versions: { a: 1, b: 2 }, revs: { a: 3, b: 4 }, device: 'dev_x', order: null, stashed: {} };
  const left = leaveList(meta, [{ id: 'a', updatedAt: 1 }, { id: 'b', updatedAt: 9 }], 'A');
  assert.equal(left.meta.device, 'dev_x', 'the id is the browser\'s, not the account\'s');
  assert.deepEqual(left.meta.revs, {});
  assert.deepEqual(left.meta.stashed.A.versions, { b: 2 });
  assert.deepEqual(left.meta.stashed.A.revs, { b: 4 }, 'only the copy kept aside');
  assert.deepEqual(stashOf(left.meta, 'A').revs, { b: 4 });
  assert.deepEqual(stashOf({ stashed: { A: { items: [], versions: { b: 2 }, deletes: [] } } }, 'A').revs, {}, 'a stash kept before this change has none');
});

test('stampOf and splitStamp: junk reads as rev 0', () => {
  assert.deepEqual(stampOf({ updatedAt: 7, syncRev: 3, syncBy: 'dev_x' }), { rev: 3, by: 'dev_x', at: 7 });
  assert.deepEqual(stampOf({ syncRev: 'x', syncBy: 4 }), { rev: 0, by: '', at: null });
  assert.deepEqual(stampOf({ syncRev: 1.5 }), { rev: 0, by: '', at: null });
  assert.deepEqual(stampOf({ syncRev: 0 }), { rev: 0, by: '', at: null });
  assert.deepEqual(stampOf(undefined), { rev: 0, by: '', at: null });
  const { item, stamp } = splitStamp({ id: 'j', syncRev: 2, syncBy: 'd', updatedAt: 5 });
  assert.deepEqual(item, { id: 'j', updatedAt: 5 });
  assert.deepEqual(stamp, { rev: 2, by: 'd', at: 5 });
});

test('a list the previous site wrote can carry the two fields: they are no difference in content', () => {
  const plain = job('j1', 'Acme');
  assert.equal(sameContent({ ...plain, syncRev: 3, syncBy: 'dev_x' }, plain), true);
  assert.equal(sameContent({ ...plain, syncRev: 3 }, { ...plain, syncRev: 4, updatedAt: 9 }), true);
  assert.equal(sameContent({ ...plain, syncRev: 3 }, { ...plain, role: 'Lead' }), false, 'a real difference still is one');
});
