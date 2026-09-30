// R5-HUNT10-SYNC-RECORD-SAVED-LIST-REFUSED-DELETES-CLOUD, review: the job and project sync record
// stopped claiming items storage refused to hold (collectionSyncEngine's claimed), but its first
// cut dropped every version storage lacked — also a job the user had just deleted here, whose
// deletion was queued and not yet sent. A reload within the pause (or a failed flush, handed to the
// next first sync) then found the job in the cloud with no version here: one never seen here, and
// brought back, though the user deleted it. Only an item shown here that storage refused loses its
// version; one gone from the list and from storage keeps it until its deletion is sent. The real
// job store, the list engine and its Firestore calls over a fake Firestore. Run: yarn test:unit
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { JOBS_SYNC_KEY, localMeta } from '../../src/utils/collectionSyncMeta.js';
import { completeJob, readJob } from '../../src/utils/normalizeJob.js';
import { _resetUnpersistedNotices } from '../../src/utils/storageBackup.js';
import { deferred, fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';
import * as jobStore from '../../src/hooks/useJobStore.js';

const A = { uid: 'A', email: 'a@example.com' };
const JOBS = 'cpwtcv_jobs_v1';

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
const cloudIds = (cloud, uid) => [...cloud.data.keys()].filter((p) => p.startsWith(`users/${uid}/jobs/`)).map((p) => p.split('/').at(-1)).toSorted();
const fromCloud = (d) => { const { kept } = readJob(d); return kept ? completeJob(kept) : null; };
const recorded = () => Object.keys(JSON.parse(localStorage.getItem(JOBS_SYNC_KEY)).versions).toSorted();

/** A page load: the job store reads storage afresh, and the engine starts over it, as useCollectionSync wires it. */
function load(cloud) {
  jobStore._resetJobStoreForTest();
  const timers = manualTimers();
  const { seen, report } = recorder();
  const sync = createCollectionSync({
    name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), meta: localMeta(JOBS_SYNC_KEY), report, timers,
    store: {
      items: jobStore.jobsNow, saved: jobStore.savedJobs, replace: jobStore.replaceJobs, subscribe: jobStore.subscribe,
      fromCloud, label: (j) => j.company,
    },
  });
  return { sync, timers, seen };
}

beforeEach(() => {
  globalThis.localStorage = new MapStorage();
  localStorage.setItem(JOBS, JSON.stringify({ jobs: [], dataVersion: 2 }));
  _resetUnpersistedNotices();
});
afterEach(() => {
  jobStore._resetJobStoreForTest();
  delete globalThis.localStorage;
});

test('a job deleted while an earlier flush is on its way, then a reload before its deletion is sent: deleted from the account, not brought back', async () => {
  const cloud = fakeFirestore({ [jobPath('A', 'j1')]: job('j1', 'Acme', 2), [jobPath('A', 'j2')]: job('j2', 'Beta', 3) });
  let page = load(cloud);
  page.sync.start(A);
  await settle();
  assert.equal(page.seen.status, 'synced');
  assert.deepEqual(recorded(), ['j1', 'j2']);

  jobStore.updateJob('j1', { company: 'Acme Corp' });
  const ack = deferred();
  cloud.hold.commit = ack.promise;
  await page.timers.fire(); // the edit's flush: its batch waits for the server's answer
  jobStore.deleteJob('j2'); // saved: storage holds the list without it; its deletion is queued
  assert.deepEqual(JSON.parse(localStorage.getItem(JOBS)).jobs.map((j) => j.id), ['j1']);
  ack.resolve();
  await settle();
  cloud.hold.commit = null;
  assert.deepEqual(recorded(), ['j1', 'j2'], 'before: the edit\'s flush dropped the deleted job\'s version from the record');

  page.sync.cancel(); // a reload within the pause: the deletion was never sent
  page = load(cloud);
  page.sync.start(A);
  await settle();
  assert.deepEqual(jobStore.jobsNow().map((j) => j.id), ['j1'], 'before: the deleted job came back from the cloud');
  assert.deepEqual(cloudIds(cloud, 'A'), ['j1'], 'the reload\'s first sync deletes it from the account');
  assert.equal(page.seen.status, 'synced');
});

test('a job deleted while the first sync\'s batch is on its way, then a reload before its deletion is sent: deleted from the account, not brought back', async () => {
  const cloud = fakeFirestore({ [jobPath('A', 'j1')]: job('j1', 'Acme', 2) });
  localStorage.setItem(JOBS, JSON.stringify({ jobs: [job('j2', 'Beta', 5)], dataVersion: 2 }));
  const ack = deferred();
  cloud.hold.commit = ack.promise;
  let page = load(cloud);
  page.sync.start(A); // the first sync sends j2, made here before signing in
  await settle();
  jobStore.deleteJob('j2');
  ack.resolve();
  await settle();
  cloud.hold.commit = null;
  assert.deepEqual(cloudIds(cloud, 'A'), ['j1', 'j2'], 'the first sync sent it before it was deleted here');
  assert.deepEqual(JSON.parse(localStorage.getItem(JOBS)).jobs.map((j) => j.id), ['j1']);
  assert.deepEqual(recorded(), ['j1', 'j2'], 'before: the first sync dropped the deleted job\'s version from the record');

  page.sync.cancel(); // a reload within the pause: the deletion was never sent
  page = load(cloud);
  page.sync.start(A);
  await settle();
  assert.deepEqual(jobStore.jobsNow().map((j) => j.id), ['j1'], 'before: the deleted job came back from the cloud');
  assert.deepEqual(cloudIds(cloud, 'A'), ['j1'], 'the reload\'s first sync deletes it from the account');
});
