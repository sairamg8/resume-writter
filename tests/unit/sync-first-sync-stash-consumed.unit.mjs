// SL-SYNC-FIRST-SYNC-STASH-CONSUMED: a job or project list's first sync took the list kept aside at the
// last sign-out from the record as it was BEFORE the cloud read (R5-HUNT12), but the cloud copy it
// merged was the one read before the other tab's first sync got there. Two tabs signing in at once,
// the other tab's first sync landing during this one's read: it took the kept-aside list out of the
// record, restored a job from it, sent it — and the user deleted that job there. This tab then had
// the job in its (old) kept-aside list and not in the cloud copy it had read: it added the job to
// the list again and sent it to the account, where the deletion had just been recorded — back on
// every device, for good. A first sync that finds the record naming its account after the read,
// when it did not before, no longer has one consistent view (cloud copy, list kept aside, list):
// it reads again, as a steady-state sync. The list engine and its Firestore calls over a fake
// Firestore; the read's answer is held back while the "other tab" works.
// Run: node --test tests/unit/sync-first-sync-stash-consumed.unit.mjs
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
const fromCloud = (d) => { const { kept } = readJob(d); return kept ? completeJob(kept) : null; };

beforeEach(() => { globalThis.localStorage = new MapStorage(); });
afterEach(() => { delete globalThis.localStorage; });

/**
 * This tab, just signed in, over an empty list: the account's cloud holds j1 only, and `x` — made
 * before the last sign-out, never sent — is kept aside for the account in the shared record. The
 * first read answers at once and is then held until `release()`: `other()` is the other tab's work
 * in that time. `reads` counts the cloud reads.
 */
async function signingInWhileOtherTabSyncs() {
  const j1 = job('j1', 'Beta', 1);
  const x = job('x', 'Acme', 5);
  const cloud = fakeFirestore({ [jobPath('A', 'j1')]: j1 });
  const meta = localMeta(JOBS_SYNC_KEY);
  meta.write({ uid: null, versions: {}, order: null, stashed: { A: { items: [x], versions: {}, deletes: [] } } });

  const real = collectionIo(cloud.fs, cloud.db, 'jobs');
  const gate = deferred();
  let answered;
  const readDone = new Promise((r) => { answered = r; });
  const state = { reads: 0 };
  const io = { ...real, async read(uid) { state.reads += 1; const r = await real.read(uid); answered(); await gate.promise; return r; } };
  let list = [];
  const store = {
    items: () => list, replace: (next) => { list = next; }, subscribe: () => () => {},
    fromCloud, label: (j) => j.company,
  };
  const { seen, report } = recorder();
  const sync = createCollectionSync({ name: 'jobs', io, store, meta, report, timers: manualTimers() });

  sync.start(A);
  await readDone; // this tab's read has the cloud with j1 only
  return {
    j1, x, cloud, meta, seen, state,
    ids: () => list.map((j) => j.id),
    setList: (next) => { list = next; },
    release: async () => { gate.resolve(); await settle(10); },
  };
}

test('a job the other tab restored from the kept-aside list and then deleted: stays deleted, not added again and sent to the account', async () => {
  const t = await signingInWhileOtherTabSyncs();
  // The other tab's first sync lands meanwhile: it restored x, sent it, took the kept-aside list out
  // of the record and named A — and the user deleted x there, its deletion sent and recorded. Its
  // list (j1) reaches this tab through the storage event.
  t.cloud.data.delete(jobPath('A', 'x'));
  t.cloud.data.set(metaPath('A'), { deleted: ['x'], order: ['j1'] });
  t.meta.write({ uid: 'A', versions: { j1: 1, x: DELETED }, order: ['j1'], stashed: {} });
  t.setList([t.j1]);
  await t.release();

  assert.deepEqual(t.ids(), ['j1'], 'before: [j1, x] — the job deleted in the other tab came back into the list');
  assert.equal(t.cloud.data.has(jobPath('A', 'x')), false, 'before: sent to the account again');
  assert.deepEqual(t.cloud.data.get(metaPath('A')).deleted, ['x'], 'before: [] — taken off the account\'s deletion list');
  const rec = localMeta(JOBS_SYNC_KEY).read();
  assert.equal(rec.uid, 'A');
  assert.ok(rec.versions.x === undefined || rec.versions.x === DELETED, 'before: the record claimed x as a job in the account');
  assert.equal(t.seen.status, 'synced');
});

test('a job the other tab restored from the kept-aside list and kept: stays in the list and the account, whichever read the plan comes from', async () => {
  const t = await signingInWhileOtherTabSyncs();
  // The other tab restored x and sent it; no deletion.
  t.cloud.data.set(jobPath('A', 'x'), { ...t.x });
  t.cloud.data.set(metaPath('A'), { deleted: [], order: ['j1', 'x'] });
  t.meta.write({ uid: 'A', versions: { j1: 1, x: 5 }, order: ['j1', 'x'], stashed: {} });
  t.setList([t.j1, t.x]);
  await t.release();

  assert.deepEqual(t.ids().toSorted(), ['j1', 'x']);
  assert.equal(t.cloud.data.get(jobPath('A', 'x')).updatedAt, 5);
  assert.deepEqual(t.cloud.data.get(metaPath('A')).deleted, []);
  assert.equal(t.seen.status, 'synced');
});

test('no other tab involved: the record names the account only once this first sync is done, and the cloud is read once', async () => {
  const t = await signingInWhileOtherTabSyncs();
  await t.release();

  assert.equal(t.state.reads, 1, 'a read again only when another tab got to the record first');
  assert.deepEqual(t.ids().toSorted(), ['j1', 'x'], 'the job kept aside at the last sign-out is sent, as ever');
  assert.equal(t.cloud.data.get(jobPath('A', 'x')).updatedAt, 5);
  assert.equal(localMeta(JOBS_SYNC_KEY).read().uid, 'A');
  assert.equal(t.seen.status, 'synced');
});
