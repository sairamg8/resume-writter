// R5-HUNT11-SYNC-COLLECTION-FIRST-SYNC-READS-RECORD-AFTER-CLOUD: a job or project list's first sync
// read the account's cloud, and only then this browser's sync record — a record every tab shares
// through localStorage. Another tab's flush landing while the read was on its way wrote the record
// ahead of the cloud copy just read: a job that tab had just added was then "known here, removed
// from the cloud" and dropped from the list (the other tab took the shorter list and deleted it
// from the account), and a job it had just deleted was "changed elsewhere" and put back. The
// record is now taken before the read, as the résumés' engine takes its `known` (R5-HUNT6).
// The list engine and its Firestore calls over a fake Firestore; the read's answer is held back
// while the "other tab" writes. Run: node --test tests/unit/r5-hunt11-sync-first-sync-record-before-read.unit.mjs
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { DELETED } from '../../src/utils/collectionSyncPlan.js';
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
const cloudIds = (cloud) => [...cloud.data.keys()].filter((p) => p.startsWith('users/A/jobs/')).map((p) => p.split('/').at(-1)).toSorted();
const fromCloud = (d) => { const { kept } = readJob(d); return kept ? completeJob(kept) : null; };

/**
 * Tab B's engine over `list`. Its cloud read gets its answer, then waits for `gate` before handing
 * it over: what the other tab does meanwhile lands after the cloud was read.
 */
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

test('a job another tab just added, sent while this tab\'s first sync reads the cloud: kept, not dropped as removed from the cloud', async () => {
  const j1 = job('j1', 'Acme', 1);
  const z = job('z', 'Zeta', 5);
  const cloud = fakeFirestore({ [jobPath('A', 'j1')]: j1 });
  localMeta(JOBS_SYNC_KEY).write({ uid: 'A', versions: { j1: 1 }, order: ['j1'], stashed: {} });
  const gate = deferred();
  // Tab A added Z and saved it: tab B took Z through the storage event before its sync started.
  const b = tabB(cloud, [j1, z], gate.promise);
  b.sync.start(A);
  await b.readDone; // B's read has the cloud without Z
  // Tab A's flush lands meanwhile: Z in the cloud, and in the record both tabs share.
  cloud.data.set(jobPath('A', 'z'), { ...z });
  b.meta.write({ uid: 'A', versions: { j1: 1, z: 5 }, order: ['j1', 'z'], stashed: {} });
  gate.resolve();
  await settle(10);
  assert.deepEqual(b.list().map((j) => j.id).toSorted(), ['j1', 'z'], 'before: the job just added in the other tab was dropped from the list');
  assert.deepEqual(cloudIds(cloud), ['j1', 'z']);
});

test('a job another tab just deleted, sent while this tab\'s first sync reads the cloud: stays deleted, not brought back', async () => {
  const j1 = job('j1', 'Acme', 1);
  const y = job('y', 'Yolo', 3);
  const cloud = fakeFirestore({ [jobPath('A', 'j1')]: j1, [jobPath('A', 'y')]: y });
  localMeta(JOBS_SYNC_KEY).write({ uid: 'A', versions: { j1: 1, y: 3 }, order: ['j1', 'y'], stashed: {} });
  const gate = deferred();
  // Tab A deleted Y and saved: tab B took the list without it.
  const b = tabB(cloud, [j1], gate.promise);
  b.sync.start(A);
  await b.readDone; // B's read has the cloud with Y
  // Tab A's flush lands meanwhile: Y deleted from the account, and DELETED in the shared record.
  cloud.data.delete(jobPath('A', 'y'));
  cloud.data.set(metaPath('A'), { deleted: ['y'] });
  b.meta.write({ uid: 'A', versions: { j1: 1, y: DELETED }, order: ['j1'], stashed: {} });
  gate.resolve();
  await settle(10);
  assert.deepEqual(b.list().map((j) => j.id), ['j1'], 'before: the job just deleted in the other tab came back');
  assert.deepEqual(cloudIds(cloud), ['j1']);
});
