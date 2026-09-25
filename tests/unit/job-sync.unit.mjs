// The Job Tracker's jobs in the cloud (R2-145): the engine of a plain list's sync
// (collectionSyncEngine.js) with its own Firestore calls (collectionSyncIo.js) over one fake
// Firestore that several "devices" share, each with its own job list, sync record and timers.
// Until R2-145 the jobs lived in one browser only. Now a first sign-in merges this browser's jobs
// with the account's, job by job (the newer updatedAt wins, nothing is lost); every change after
// it is sent after a pause; a deletion is listed in users/{uid}/meta/jobs so no other device
// brings the job back; the list's order travels too; offline and failed changes are sent later.
// Signing out takes the account's jobs off this browser (a change not sent yet is kept aside for
// that account's next sign-in), and a browser never signed in keeps its jobs as before.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { localMeta, memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { completeJob, readJob } from '../../src/utils/normalizeJob.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';
import * as jobStore from '../../src/hooks/useJobStore.js';

const A = { uid: 'A', email: 'a@example.com' };
const B = { uid: 'B', email: 'b@example.com' };
const REFRESH = 10_000;

const job = (id, company, updatedAt = 1, extra = {}) => ({
  id, company, role: 'Engineer', status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt, ...extra,
});
const jobPath = (uid, id) => `users/${uid}/jobs/${id}`;
const metaPath = (uid) => `users/${uid}/meta/jobs`;
/** The cloud as account `uid`'s jobs: { id: doc }. */
const cloudJobs = (cloud, uid) => Object.fromEntries([...cloud.data.keys()]
  .filter((p) => p.startsWith(`users/${uid}/jobs/`)).map((p) => [p.split('/').at(-1), cloud.doc(p)]));
/** The job ids every commit since `from` wrote (set). */
const writtenSince = (cloud, from) => cloud.commits.slice(from).flat()
  .filter(([op, path]) => op === 'set' && path.includes('/jobs/')).map(([, path]) => path.split('/').at(-1));

/** A cloud copy as the job store loads one (jobSync in useCollectionSync.js). */
const fromCloud = (d) => { const { kept } = readJob(d); return kept ? completeJob(kept) : null; };
const label = (j) => [j.company, j.role].filter(Boolean).join(' — ') || 'Untitled job';

/**
 * A device: its own in-memory job list, sync record, timers and clock, with the engine over
 * `cloud` (null: a build with no cloud). `edit` / `add` / `remove` / `reorder` change the list as
 * the tracker would (new objects), and the engine hears of it at once, as it does from the store.
 */
function device(cloud, jobs = [], { online = () => true, meta = memoryMeta() } = {}) {
  let list = jobs;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list,
    replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud, label,
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  let clock = 0;
  const sync = createCollectionSync({
    name: 'jobs', io: cloud ? collectionIo(cloud.fs, cloud.db, 'jobs') : null, store, meta, report,
    online, timers, refreshAfter: REFRESH, now: () => clock,
  });
  return {
    sync, timers, seen, meta,
    jobs: () => list,
    job: (id) => list.find((j) => j.id === id),
    ids: () => list.map((j) => j.id),
    start: async (user) => { sync.start(user); await settle(); },
    /** The tab shown again after long enough for the list to be read again. */
    refresh: async () => { clock += REFRESH; sync.shown(); await settle(); },
    edit: (id, patch, updatedAt) => set(list.map((j) => (j.id === id ? { ...j, ...patch, updatedAt } : j))),
    add: (j) => set([...list, j]),
    remove: (id) => set(list.filter((j) => j.id !== id)),
    reorder: (ids) => set(ids.map((id) => list.find((j) => j.id === id))),
  };
}

test('R2-145: the first sync merges this browser\'s jobs with the account\'s — nothing is lost', async () => {
  const cloud = fakeFirestore({ [jobPath('A', 'job_cloud')]: job('job_cloud', 'Globex', 5) });
  const d = device(cloud, [job('job_local', 'Initech', 2)]);
  await d.start(A);

  assert.equal(d.seen.status, 'synced');
  assert.deepEqual(d.ids().toSorted(), ['job_cloud', 'job_local']);
  assert.equal(d.job('job_cloud').company, 'Globex');
  assert.deepEqual(cloud.doc(jobPath('A', 'job_local')), job('job_local', 'Initech', 2), 'the local job is in the account');
  assert.equal(cloud.doc(jobPath('A', 'job_cloud')).company, 'Globex');
  assert.deepEqual(cloud.doc(metaPath('A')).order, d.ids());
  const m = d.meta.read();
  assert.equal(m.uid, 'A');
  assert.deepEqual(m.versions, { job_local: 2, job_cloud: 5 });
});

test('R2-145: an edit reaches the cloud after the pause and the other device; the newer edit of a job wins on both', async () => {
  const cloud = fakeFirestore();
  const d1 = device(cloud, [job('j1', 'Acme'), job('j2', 'Beta'), job('j3', 'Cyan')]);
  await d1.start(A);
  let d2Online = true;
  const d2 = device(cloud, [], { online: () => d2Online });
  await d2.start(A);
  assert.deepEqual(d2.ids(), ['j1', 'j2', 'j3'], 'the second device gets the jobs');

  d1.edit('j1', { company: 'Acme Corp' }, 10);
  assert.equal(cloud.doc(jobPath('A', 'j1')).company, 'Acme', 'not sent before the pause');
  assert.equal(d1.seen.status, 'syncing');
  await d1.timers.fire();
  assert.equal(cloud.doc(jobPath('A', 'j1')).company, 'Acme Corp');
  assert.equal(d1.seen.status, 'synced');
  await d2.refresh();
  assert.equal(d2.job('j1').company, 'Acme Corp', 'the other device reads it again when shown');

  // j2: newer on device 2; j3: newer on device 1. Device 2 edits offline, device 1 sends first.
  d2Online = false;
  await d2.start(A);
  d2.edit('j2', { role: 'Staff' }, 30);
  d2.edit('j3', { role: 'Intern' }, 35);
  d1.edit('j2', { role: 'Lead' }, 20);
  d1.edit('j3', { role: 'Principal' }, 40);
  await d1.timers.fire();
  d2Online = true;
  await d2.start(A);
  await d1.refresh();

  for (const d of [d1, d2]) {
    assert.equal(d.job('j2').role, 'Staff');
    assert.equal(d.job('j3').role, 'Principal');
  }
  assert.equal(cloud.doc(jobPath('A', 'j2')).role, 'Staff');
  assert.equal(cloud.doc(jobPath('A', 'j3')).role, 'Principal');
});

test('R2-145: a deleted job leaves the cloud, is listed as deleted, and a device still holding it drops it', async () => {
  const cloud = fakeFirestore();
  const d1 = device(cloud, [job('j1', 'Acme'), job('j2', 'Beta')]);
  await d1.start(A);
  const d2 = device(cloud, []);
  await d2.start(A);
  assert.deepEqual(d2.ids(), ['j1', 'j2']);

  d1.remove('j1');
  await d1.timers.fire();
  assert.equal(cloud.doc(jobPath('A', 'j1')), undefined);
  assert.deepEqual(cloud.doc(metaPath('A')).deleted, ['j1']);
  assert.deepEqual(Object.keys(d1.meta.read().versions), ['j2']);

  const from = cloud.commits.length;
  await d2.refresh();
  assert.deepEqual(d2.ids(), ['j2'], 'gone on the other device too');
  assert.equal(cloud.doc(jobPath('A', 'j1')), undefined, 'not written back');
  assert.ok(!writtenSince(cloud, from).includes('j1'));
  assert.deepEqual(cloud.doc(metaPath('A')).deleted, ['j1']);
});

test('R2-145: changes made offline are sent once the browser is online again', async () => {
  const cloud = fakeFirestore();
  let online = false;
  const d = device(cloud, [job('j1', 'Acme'), job('j2', 'Beta')], { online: () => online });
  await d.start(A);
  assert.equal(d.seen.status, 'offline');
  assert.deepEqual(cloud.reads, []);
  assert.equal(cloud.commits.length, 0);

  online = true;
  await d.start(A);
  assert.deepEqual(Object.keys(cloudJobs(cloud, 'A')).toSorted(), ['j1', 'j2']);

  online = false;
  await d.start(A);
  d.edit('j1', { company: 'Acme Offline' }, 7);
  d.remove('j2');
  d.add(job('j3', 'Cyan', 8));
  assert.equal(d.timers.count, 0, 'nothing waits to be sent while offline');
  const commits = cloud.commits.length;
  await d.timers.fire();
  assert.equal(cloud.commits.length, commits);

  online = true;
  await d.start(A);
  assert.equal(d.seen.status, 'synced');
  const docs = cloudJobs(cloud, 'A');
  assert.deepEqual(Object.keys(docs).toSorted(), ['j1', 'j3']);
  assert.equal(docs.j1.company, 'Acme Offline');
  assert.deepEqual(cloud.doc(metaPath('A')).deleted, ['j2']);
  assert.deepEqual(d.ids(), ['j1', 'j3']);
});

test('R2-145: a change the cloud could not take for now is tried again later and gets there', async () => {
  const cloud = fakeFirestore();
  const d = device(cloud, [job('j1', 'Acme')]);
  await d.start(A);
  cloud.fail.commit = Object.assign(new Error('The service is currently unavailable.'), { code: 'unavailable' });
  d.edit('j1', { company: 'Acme Retry' }, 9);
  await d.timers.fire();

  assert.equal(d.seen.status, 'error');
  assert.equal(cloud.doc(jobPath('A', 'j1')).company, 'Acme');
  assert.deepEqual(d.timers.delays, [30000], 'a retry is set');

  cloud.fail.commit = null;
  await d.timers.fire();
  assert.equal(cloud.doc(jobPath('A', 'j1')).company, 'Acme Retry');
  assert.equal(d.seen.status, 'synced');
  assert.equal(d.meta.read().versions.j1, 9);
});

test('R2-145: signing out takes the jobs off this browser; a change not sent yet waits for the account\'s next sign-in', async () => {
  const cloud = fakeFirestore();
  cloud.auth = 'A';
  const d = device(cloud, [job('j1', 'Acme'), job('j2', 'Beta')]);
  await d.start(A);
  d.edit('j1', { company: 'Acme Unsent' }, 50); // within the pause: not sent yet

  cloud.auth = null;
  await d.start(null);
  assert.deepEqual(d.jobs(), [], 'the list leaves with the account');
  assert.equal(d.seen.status, 'idle');
  const { stashed, uid } = d.meta.read();
  assert.equal(uid, null);
  assert.deepEqual(stashed.A.items.map((j) => [j.id, j.company]), [['j1', 'Acme Unsent']]);
  await d.timers.fire();
  assert.equal(cloud.doc(jobPath('A', 'j1')).company, 'Acme', 'the queued change is not sent signed out');

  const aDocs = cloudJobs(cloud, 'A');
  cloud.auth = 'B';
  await d.start(B);
  assert.equal(d.seen.status, 'synced');
  assert.deepEqual(d.jobs(), [], 'B gets none of A\'s jobs');
  assert.deepEqual(cloudJobs(cloud, 'B'), {});
  assert.deepEqual(cloudJobs(cloud, 'A'), aDocs, 'A\'s documents untouched');

  cloud.auth = 'A';
  await d.start(A);
  assert.deepEqual(d.ids(), ['j1', 'j2']);
  assert.equal(d.job('j1').company, 'Acme Unsent', 'the kept change comes back');
  assert.equal(cloud.doc(jobPath('A', 'j1')).company, 'Acme Unsent', 'and is sent');
  assert.equal(d.meta.read().stashed.A, undefined);
  assert.equal(d.seen.status, 'synced');
});

test('R2-145: an account the rules refuse turns the sync off and leaves the list alone', async () => {
  const cloud = fakeFirestore({ [jobPath('A', 'j9')]: job('j9', 'Zeta') });
  cloud.auth = 'B';
  const jobs = [job('j1', 'Acme')];
  const d = device(cloud, jobs);
  await d.start(A);

  assert.equal(d.seen.status, 'off');
  assert.equal(d.jobs(), jobs);
  assert.equal(cloud.commits.length, 0);
  d.edit('j1', { company: 'Acme Local' }, 3);
  assert.equal(d.timers.count, 0, 'nothing is queued once off');
  assert.equal(d.meta.read().uid, null);
});

test('R2-145: never signed in, or a build with no cloud, the list stays this browser\'s', async () => {
  const cloud = fakeFirestore({ [jobPath('A', 'j9')]: job('j9', 'Zeta') });
  const jobs = [job('j1', 'Acme')];
  const d = device(cloud, jobs);
  await d.start(null);
  assert.equal(d.seen.status, 'idle');
  assert.equal(d.jobs(), jobs);
  d.edit('j1', { company: 'Acme Local' }, 3);
  assert.equal(d.timers.count, 0);
  assert.deepEqual(cloud.reads, []);
  assert.equal(cloud.commits.length, 0);

  const local = device(null, jobs);
  await local.start(A);
  assert.equal(local.seen.status, 'off');
  await local.start(null);
  assert.equal(local.jobs(), jobs, 'signing out keeps the only copy');
});

test('R2-145: the list\'s order is written and another device shows the same order', async () => {
  const cloud = fakeFirestore();
  const d1 = device(cloud, [job('j1', 'Acme'), job('j2', 'Beta'), job('j3', 'Cyan')]);
  await d1.start(A);
  const d2 = device(cloud, []);
  await d2.start(A);

  const from = cloud.commits.length;
  d1.reorder(['j3', 'j1', 'j2']);
  await d1.timers.fire();
  assert.deepEqual(cloud.doc(metaPath('A')).order, ['j3', 'j1', 'j2']);
  assert.deepEqual(writtenSince(cloud, from), [], 'a move writes no job');

  await d2.refresh();
  assert.deepEqual(d2.ids(), ['j3', 'j1', 'j2']);
  const d3 = device(cloud, []);
  await d3.start(A);
  assert.deepEqual(d3.ids(), ['j3', 'j1', 'j2']);
});

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

test('R2-145: with the real job store, signing out empties the saved list and signing in brings it back', async (t) => {
  globalThis.localStorage = new MemoryStorage();
  jobStore._resetJobStoreForTest();
  t.after(() => { jobStore._resetJobStoreForTest(); delete globalThis.localStorage; });
  localStorage.setItem('cpwtcv_jobs_v1', JSON.stringify({ jobs: [job('j1', 'Acme', 2)], dataVersion: 2 }));
  const saved = () => JSON.parse(localStorage.getItem('cpwtcv_jobs_v1')).jobs.map((j) => j.id).toSorted();

  const cloud = fakeFirestore({ [jobPath('A', 'j2')]: job('j2', 'Globex', 4) });
  const { seen, report } = recorder();
  const sync = createCollectionSync({
    name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'),
    store: { items: jobStore.jobsNow, replace: jobStore.replaceJobs, subscribe: jobStore.subscribe, fromCloud, label },
    meta: localMeta('cpwtcv_jobs_sync_v1'), report, timers: manualTimers(),
  });

  sync.start(A);
  await settle();
  assert.equal(seen.status, 'synced');
  assert.deepEqual(saved(), ['j1', 'j2']);
  assert.ok(cloud.doc(jobPath('A', 'j1')));

  sync.start(null);
  await settle();
  assert.deepEqual(jobStore.jobsNow(), []);
  assert.deepEqual(JSON.parse(localStorage.getItem('cpwtcv_jobs_v1')).jobs, [], 'nothing of A\'s is left in storage');
  assert.equal(JSON.parse(localStorage.getItem('cpwtcv_jobs_sync_v1')).uid, null);

  sync.start(A);
  await settle();
  assert.deepEqual(jobStore.jobsNow().map((j) => j.company).toSorted(), ['Acme', 'Globex']);
  assert.deepEqual(saved(), ['j1', 'j2']);
});

test('R2-145: a flush keeps a newer copy another device sent meanwhile, and takes it', async () => {
  const cloud = fakeFirestore();
  const d1 = device(cloud, [job('j1', 'Acme', 1), job('j2', 'Beta', 1)]);
  await d1.start(A);
  const d2 = device(cloud, []);
  await d2.start(A);

  d1.edit('j1', { role: 'Lead' }, 20); // made first, still in device 1's pause
  d1.edit('j2', { role: 'Tester' }, 21);
  d2.edit('j1', { role: 'Staff' }, 30); // made later, sent first
  await d2.timers.fire();
  assert.equal(cloud.doc(jobPath('A', 'j1')).role, 'Staff');

  const from = cloud.commits.length;
  await d1.timers.fire();
  assert.equal(cloud.doc(jobPath('A', 'j1')).role, 'Staff', 'the older copy is not written over the newer one');
  assert.equal(cloud.doc(jobPath('A', 'j2')).role, 'Tester', 'the rest of the batch is sent');
  assert.deepEqual(writtenSince(cloud, from), ['j2']);
  assert.equal(d1.job('j1').role, 'Staff', 'device 1 takes the newer copy');
  assert.equal(d1.meta.read().versions.j1, 30);
  assert.equal(d1.seen.status, 'synced');
  await d1.timers.fire();
  assert.deepEqual(writtenSince(cloud, from), ['j2'], 'the copy taken is not sent back');
});
