// R5-HUNT11-SYNC-REVIEW-FIRST-SYNC-ORDER-READ-AFTER-CLOUD: the fix for a first sync that read the
// shared sync record after the cloud (R5-HUNT11-SYNC-COLLECTION-FIRST-SYNC-READS-RECORD-AFTER-CLOUD)
// took the versions from the record as it was before the read, but still took the order the cloud
// held when this browser last synced (`baseOrder`) from the record read after it. Another tab's
// flush of a move (a job dragged up on the board) landing while the read was on its way wrote its
// new order to the record: the cloud's order just read (the old one) no longer matched that base,
// so the old order was taken as a move made on another device and led. This tab's list went back
// to the old order, and the other tab took it through the storage event and sent it: the move was
// undone on every device. The base now comes from the record as it was before the read, too.
// The list engine and its Firestore calls over a fake Firestore; the read's answer is held back
// while the "other tab" writes. Run: node --test tests/unit/r5-hunt11-sync-review-first-sync-order-before-read.unit.mjs
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { JOBS_SYNC_KEY, localMeta } from '../../src/utils/collectionSyncMeta.js';
import { completeJob, readJob } from '../../src/utils/normalizeJob.js';
import { deferred, fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };

/** localStorage as a Map. */
class MapStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const job = (id, company, updatedAt = 1) => ({
  id, company, role: 'Engineer', status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});
const jobPath = (uid, id) => `users/${uid}/jobs/${id}`;
const metaPath = (uid) => `users/${uid}/meta/jobs`;
const fromCloud = (d) => { const { kept } = readJob(d); return kept ? completeJob(kept) : null; };

/** Tab B's engine over `list`; its cloud read gets its answer, then waits for `gate` before handing it over. */
function tabB(cloud, list, gate) {
  const meta = localMeta(JOBS_SYNC_KEY);
  const real = collectionIo(cloud.fs, cloud.db, 'jobs');
  let answered;
  const readDone = new Promise((r) => { answered = r; });
  const io = { ...real, async read(uid) { const r = await real.read(uid); answered(); await gate; return r; } };
  const store = {
    items: () => list, replace: (next) => { list = next; }, subscribe: () => () => {},
    fromCloud, label: (j) => j.company,
  };
  const { report } = recorder();
  const sync = createCollectionSync({ name: 'jobs', io, store, meta, report, timers: manualTimers() });
  return { sync, meta, readDone, list: () => list };
}

beforeEach(() => { globalThis.localStorage = new MapStorage(); });
afterEach(() => { delete globalThis.localStorage; });

test('a move another tab just sent, while this tab\'s first sync reads the cloud: kept, not undone', async () => {
  const j1 = job('j1', 'Acme', 1);
  const j2 = job('j2', 'Beta', 2);
  const cloud = fakeFirestore({ [jobPath('A', 'j1')]: j1, [jobPath('A', 'j2')]: j2, [metaPath('A')]: { order: ['j1', 'j2'] } });
  localMeta(JOBS_SYNC_KEY).write({ uid: 'A', versions: { j1: 1, j2: 2 }, order: ['j1', 'j2'], stashed: {} });
  const gate = deferred();
  // Tab A dragged Beta above Acme and saved: tab B took the new order through the storage event.
  const b = tabB(cloud, [j2, j1], gate.promise);
  b.sync.start(A);
  await b.readDone; // B's read has the cloud's old order
  // Tab A's flush lands meanwhile: the new order in the cloud, and in the record both tabs share.
  cloud.data.set(metaPath('A'), { order: ['j2', 'j1'] });
  b.meta.write({ uid: 'A', versions: { j1: 1, j2: 2 }, order: ['j2', 'j1'], stashed: {} });
  gate.resolve();
  await settle(10);
  assert.deepEqual(b.list().map((j) => j.id), ['j2', 'j1'], 'before: the move just made in the other tab was undone here (and then sent from there)');
  assert.deepEqual(cloud.data.get(metaPath('A')).order, ['j2', 'j1']);
  assert.deepEqual(b.meta.read().order, ['j2', 'j1'], 'before: the record took the old order');
});

test('moved on another device, the record unchanged during the read: the cloud\'s order still leads', async () => {
  const j1 = job('j1', 'Acme', 1);
  const j2 = job('j2', 'Beta', 2);
  const cloud = fakeFirestore({ [jobPath('A', 'j1')]: j1, [jobPath('A', 'j2')]: j2, [metaPath('A')]: { order: ['j2', 'j1'] } });
  // This browser last saw the old order; another device moved Beta up since.
  localMeta(JOBS_SYNC_KEY).write({ uid: 'A', versions: { j1: 1, j2: 2 }, order: ['j1', 'j2'], stashed: {} });
  const gate = deferred();
  const b = tabB(cloud, [j1, j2], gate.promise);
  b.sync.start(A);
  await b.readDone;
  gate.resolve();
  await settle(10);
  assert.deepEqual(b.list().map((j) => j.id), ['j2', 'j1'], 'the other device\'s move leads');
  assert.deepEqual(cloud.data.get(metaPath('A')).order, ['j2', 'j1']);
});
