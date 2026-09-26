// The order of a synced list — the job board's ranks, the boards' grid (R2-140) — merged on the
// order this browser last saw in the cloud. The order carries no updatedAt, so a first sync used to
// put the cloud's order first, always: a move made before it (offline, on a page loaded signed out,
// before a failed sync was tried again, or kept aside at sign-out) was lost to the cloud's order.
// Now the sync record keeps the order the cloud held as last seen here (`order`); a first sync lets
// this browser's order lead when the cloud's is still that one, and the cloud's lead otherwise.
// The engine (collectionSyncEngine.js) runs over a fake Firestore that several devices share, as
// in job-sync.unit.mjs and board-sync.unit.mjs. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { forgetSynced, localMeta, memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { planFirstSync } from '../../src/utils/collectionSyncPlan.js';
import { completeJob, readJob } from '../../src/utils/normalizeJob.js';
import { completeBoard, readBoard } from '../../src/utils/normalizeBoard.js';
import { createBoard } from '../../src/utils/boardModel.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const JOBS_KEY = 'cpwtcv_jobs_sync_v1';

const job = (id, company, updatedAt = 1) => ({
  id, company, role: 'Engineer', status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});
const jobPath = (uid, id) => `users/${uid}/jobs/${id}`;
const metaPath = (uid, name = 'jobs') => `users/${uid}/meta/${name}`;
const jobFromCloud = (d) => { const { kept } = readJob(d); return kept ? completeJob(kept) : null; };
const boardFromCloud = (d) => { const { kept } = readBoard(d); return kept ? completeBoard(kept) : null; };
const unavailable = () => Object.assign(new Error('The service is currently unavailable.'), { code: 'unavailable' });

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

/**
 * A device: its own list in memory, sync record, timers and online flag (`net.online`), with the
 * engine over `cloud`. `reorder` moves the list as a drag does (the same objects, a new order).
 */
function device(cloud, items = [], { name = 'jobs', meta = memoryMeta() } = {}) {
  let list = items;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list,
    replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: name === 'jobs' ? jobFromCloud : boardFromCloud,
    label: (x) => x.company || x.title || 'Untitled',
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const net = { online: true };
  const sync = createCollectionSync({
    name, io: collectionIo(cloud.fs, cloud.db, name), store, meta, report, timers, online: () => net.online,
  });
  return {
    sync, timers, seen, meta, net,
    items: () => list,
    ids: () => list.map((x) => x.id),
    start: async (user) => { sync.start(user); await settle(); },
    add: (x) => set([...list, x]),
    reorder: (ids) => set(ids.map((id) => list.find((x) => x.id === id))),
  };
}

test('R2-140: jobs moved offline keep their places once the browser is online again', async () => {
  const cloud = fakeFirestore();
  const d = device(cloud, [job('j1', 'Acme'), job('j2', 'Beta'), job('j3', 'Cyan')]);
  await d.start(A);
  assert.deepEqual(d.meta.read().order, ['j1', 'j2', 'j3'], 'the record keeps the order the cloud holds');

  d.net.online = false;
  await d.start(A);
  assert.equal(d.seen.status, 'offline');
  d.reorder(['j3', 'j1', 'j2']);
  assert.equal(d.timers.count, 0, 'nothing waits to be sent while offline');

  d.net.online = true;
  await d.start(A);
  assert.equal(d.seen.status, 'synced');
  assert.deepEqual(d.ids(), ['j3', 'j1', 'j2'], 'the move made offline is kept here');
  assert.deepEqual(cloud.doc(metaPath('A')).order, ['j3', 'j1', 'j2'], 'and sent');
  assert.deepEqual(d.meta.read().order, ['j3', 'j1', 'j2']);
  const other = device(cloud, []);
  await other.start(A);
  assert.deepEqual(other.ids(), ['j3', 'j1', 'j2'], 'another device shows it');
});

test('R2-140: a move made on a page loaded signed out is sent at the next sign-in', async () => {
  const cloud = fakeFirestore();
  const storage = new MemoryStorage();
  const saved = localMeta(JOBS_KEY, () => storage);
  const first = device(cloud, [job('j1', 'Acme'), job('j2', 'Beta'), job('j3', 'Cyan')], { meta: saved });
  await first.start(A);
  assert.deepEqual(JSON.parse(storage.getItem(JOBS_KEY)).order, ['j1', 'j2', 'j3'], 'saved with the record');

  // The page again, with the saved list and record, and no one signed in yet.
  const page = device(cloud, first.items(), { meta: localMeta(JOBS_KEY, () => storage) });
  await page.start(null);
  assert.equal(page.seen.status, 'idle');
  page.reorder(['j2', 'j3', 'j1']);
  await page.start(A);
  assert.deepEqual(page.ids(), ['j2', 'j3', 'j1']);
  assert.deepEqual(cloud.doc(metaPath('A')).order, ['j2', 'j3', 'j1']);
});

test('R2-140: a move not yet sent when the account signs out is kept aside and sent at its next sign-in', async () => {
  const cloud = fakeFirestore();
  const d = device(cloud, [job('j1', 'Acme'), job('j2', 'Beta'), job('j3', 'Cyan')]);
  await d.start(A);
  d.reorder(['j2', 'j3', 'j1']); // within the pause: not sent yet

  await d.start(null);
  assert.deepEqual(d.items(), [], 'the list leaves with the account');
  const { stashed, order } = d.meta.read();
  assert.equal(order, null, 'the record no longer holds the account\'s order');
  assert.deepEqual([stashed.A.order, stashed.A.base], [['j2', 'j3', 'j1'], ['j1', 'j2', 'j3']]);
  await d.timers.fire();
  assert.deepEqual(cloud.doc(metaPath('A')).order, ['j1', 'j2', 'j3'], 'not sent signed out');

  await d.start(A);
  assert.deepEqual(d.ids(), ['j2', 'j3', 'j1'], 'the move comes back');
  assert.deepEqual(cloud.doc(metaPath('A')).order, ['j2', 'j3', 'j1'], 'and is sent');
  assert.equal(d.meta.read().stashed.A, undefined);
});

test('R2-140: a move made here keeps a job another device added where that device put it; moved on both sides, the cloud\'s order wins', async () => {
  const cloud = fakeFirestore();
  const d1 = device(cloud, [job('j1', 'Acme'), job('j2', 'Beta'), job('j3', 'Cyan')]);
  await d1.start(A);
  const d2 = device(cloud, []);
  await d2.start(A);

  d1.net.online = false;
  await d1.start(A);
  d1.reorder(['j3', 'j2', 'j1']);
  // Device 2 adds a job at the top: the cloud's order changes, but not for the jobs device 1 knew.
  d2.add(job('j4', 'Delta', 5));
  d2.reorder(['j4', 'j1', 'j2', 'j3']);
  await d2.timers.fire();
  assert.deepEqual(cloud.doc(metaPath('A')).order, ['j4', 'j1', 'j2', 'j3']);

  d1.net.online = true;
  await d1.start(A);
  assert.deepEqual(d1.ids(), ['j4', 'j3', 'j2', 'j1'], 'device 1\'s move, with device 2\'s job where device 2 put it');
  assert.deepEqual(cloud.doc(metaPath('A')).order, ['j4', 'j3', 'j2', 'j1']);
  await d2.start(A);
  assert.deepEqual(d2.ids(), ['j4', 'j3', 'j2', 'j1'], 'device 2 takes it: it did not move anything since');

  // Both move: device 2 sends first, and its order is the account's.
  d1.net.online = false;
  await d1.start(A);
  d1.reorder(['j1', 'j2', 'j3', 'j4']);
  d2.reorder(['j2', 'j1', 'j4', 'j3']);
  await d2.timers.fire();
  d1.net.online = true;
  await d1.start(A);
  assert.deepEqual(d1.ids(), ['j2', 'j1', 'j4', 'j3']);
  assert.deepEqual(cloud.doc(metaPath('A')).order, ['j2', 'j1', 'j4', 'j3']);
});

test('R2-140: boards moved while the cloud refused them for now keep their places once it takes them', async () => {
  const cloud = fakeFirestore();
  const boards = ['Alpha', 'Bravo', 'Charlie'].map((title, i) => createBoard({ title }, { now: 1000 + i }));
  const ids = boards.map((b) => b.id);
  const d = device(cloud, boards, { name: 'boards' });
  await d.start(A);
  assert.deepEqual(cloud.doc(metaPath('A', 'boards')).order, ids);

  cloud.fail.commit = unavailable();
  const moved = [ids[2], ids[0], ids[1]];
  d.reorder(moved);
  await d.timers.fire();
  assert.equal(d.seen.status, 'error');
  assert.deepEqual(cloud.doc(metaPath('A', 'boards')).order, ids, 'not sent yet');
  assert.deepEqual(d.meta.read().order, ids, 'the record keeps the order the cloud still holds');

  cloud.fail.commit = null;
  await d.timers.fire(); // the retry: a first sync
  assert.equal(d.seen.status, 'synced');
  assert.deepEqual(d.ids(), moved, 'the move is kept');
  assert.deepEqual(cloud.doc(metaPath('A', 'boards')).order, moved, 'and sent');
});

test('R2-140: a record saved before the order was kept still reads, and the cloud\'s order leads its first sync', async () => {
  const storage = new MemoryStorage();
  storage.setItem(JOBS_KEY, JSON.stringify({ uid: 'A', versions: { j1: 1, j2: 1 }, stashed: {} }));
  const meta = localMeta(JOBS_KEY, () => storage);
  assert.equal(meta.read().order, null);
  storage.setItem(JOBS_KEY, JSON.stringify({ uid: 'A', versions: { j1: 1, j2: 1 }, order: 'j1', stashed: {} }));
  assert.equal(meta.read().order, null, 'an order that is not a list reads as none');
  storage.setItem(JOBS_KEY, JSON.stringify({ uid: 'A', versions: { j1: 1, j2: 1 }, stashed: {} }));

  const cloud = fakeFirestore({ [jobPath('A', 'j1')]: job('j1', 'Acme'), [jobPath('A', 'j2')]: job('j2', 'Beta') });
  cloud.data.set(metaPath('A'), { order: ['j1', 'j2'], deleted: [] });
  const d = device(cloud, [job('j2', 'Beta'), job('j1', 'Acme')], { meta });
  await d.start(A);
  assert.deepEqual(d.ids(), ['j1', 'j2'], 'no base to tell a move here from one made elsewhere: the cloud\'s order, as before');
  assert.deepEqual(meta.read().order, ['j1', 'j2'], 'the order is kept from now on');
});

test('R2-140: a saved list that could not be read in full forgets the order too', () => {
  const storage = new MemoryStorage();
  storage.setItem(JOBS_KEY, JSON.stringify({ uid: 'A', versions: {}, order: ['j1', 'j2'], stashed: {} }));
  forgetSynced(JOBS_KEY, () => storage);
  assert.deepEqual(localMeta(JOBS_KEY, () => storage).read(), { uid: 'A', versions: {}, order: null, stashed: {} });
});

test('R2-140: planFirstSync merges the order on its base', () => {
  const docs = ['a', 'b', 'c'].map((id) => ({ id, updatedAt: 1 }));
  const versions = { a: 1, b: 1, c: 1 };
  const local = ['c', 'a', 'b'].map((id) => ({ id, updatedAt: 1 }));
  const plan = (order, baseOrder, extra = {}) => planFirstSync({ local, versions, docs, order, baseOrder, ...extra }).order;
  assert.deepEqual(plan(['a', 'b', 'c'], ['a', 'b', 'c']), ['c', 'a', 'b'], 'moved here only: this browser\'s order');
  assert.deepEqual(plan(['b', 'a', 'c'], ['a', 'b', 'c']), ['b', 'a', 'c'], 'moved elsewhere too: the cloud\'s');
  assert.deepEqual(plan(['a', 'b', 'c'], null), ['a', 'b', 'c'], 'no base: the cloud\'s');
  assert.deepEqual(plan(['c', 'a', 'b'], ['c', 'a', 'b'], { local: ['a', 'b', 'c'].map((id) => ({ id, updatedAt: 1 })) }), ['a', 'b', 'c'],
    'moved here from the base, not elsewhere');
  assert.deepEqual(plan(['a', 'b', 'c'], ['a', 'b', 'c'], { local: ['a', 'b', 'c'].map((id) => ({ id, updatedAt: 1 })) }), ['a', 'b', 'c'],
    'moved nowhere: unchanged');
  // Kept aside at sign-out: the move leads what the browser holds now.
  assert.deepEqual(plan(['a', 'b', 'c'], ['a', 'b', 'c'], { local: [], localOrder: ['b', 'c', 'a'] }), ['b', 'c', 'a']);
});
