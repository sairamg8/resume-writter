// R5-HUNT12-SYNC-FIRST-SYNC-STASH-READ-AFTER-CLOUD: a job or project list's first sync took the
// versions and order this browser knew from the record as it was BEFORE the cloud read (R5-HUNT11),
// but the list kept aside at the last sign-out (its unsent deletions, versions and move) still came
// from the record read AFTER it. Two tabs signing in at once, the other tab's first sync landing
// during this one's read took that kept-aside list out of the shared record and named the account:
// this tab then had no deletion to apply, kept the job from the cloud copy read before it went, and
// the other tab sent it back to the account — on every device. The kept-aside list is now taken
// from the record as it was before the read too.
// Run: node --test tests/unit/r5-hunt12-sync-first-sync-stash-before-read.unit.mjs
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

test('a job deleted just before sign-out, the other tab\'s first sync landing during this tab\'s read: stays deleted, not brought back', async () => {
  const j1 = job('j1', 'Beta', 1);
  const acme = job('acme', 'Acme', 2);
  // Acme was deleted and the list signed out before the delete was sent: kept aside for A.
  const cloud = fakeFirestore({ [jobPath('A', 'j1')]: j1, [jobPath('A', 'acme')]: acme });
  localMeta(JOBS_SYNC_KEY).write({ uid: null, versions: {}, order: null, stashed: { A: { items: [], versions: {}, deletes: ['acme'] } } });

  const meta = localMeta(JOBS_SYNC_KEY);
  const real = collectionIo(cloud.fs, cloud.db, 'jobs');
  const gate = deferred();
  let answered;
  const readDone = new Promise((r) => { answered = r; });
  const io = { ...real, async read(uid) { const r = await real.read(uid); answered(); await gate.promise; return r; } };
  let list = [];
  const store = {
    items: () => list, replace: (next) => { list = next; }, subscribe: () => () => {},
    fromCloud, label: (j) => j.company,
  };
  const { report } = recorder();
  const sync = createCollectionSync({ name: 'jobs', io, store, meta, report, timers: manualTimers() });

  sync.start(A);
  await readDone; // this tab's read has the cloud with Acme, not yet deleted
  // The other tab's first sync lands meanwhile: Acme deleted from the account, the kept-aside list
  // consumed, the record naming A, and its merged list (no Acme) taken here through the storage event.
  cloud.data.delete(jobPath('A', 'acme'));
  cloud.data.set(metaPath('A'), { deleted: ['acme'] });
  meta.write({ uid: 'A', versions: { j1: 1, acme: DELETED }, order: ['j1'], stashed: {} });
  list = [j1];
  gate.resolve();
  await settle(10);

  assert.deepEqual(list.map((j) => j.id), ['j1'], 'before: the job deleted before sign-out came back into the list');
  const rec = localMeta(JOBS_SYNC_KEY).read();
  assert.equal(rec.uid, 'A');
  assert.ok(rec.versions.acme === undefined || rec.versions.acme === DELETED, 'before: the record claimed Acme as a job in the account');
  assert.ok(!cloud.data.has(jobPath('A', 'acme')));
});
