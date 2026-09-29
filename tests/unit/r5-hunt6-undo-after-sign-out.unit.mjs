// R5-HUNT6-UNDO-AFTER-SIGN-OUT-UPLOADS-TO-NEXT-ACCOUNT: an Undo toast outlives a sign-out. "Clear
// all jobs", a job's Delete or a project's Delete, then Sign out while the toast was up (here or in
// another tab), then Undo: the last account's jobs or project came back into the list the sign-out
// had emptied, which belongs to no account, and the next account to sign in took them for its own
// and uploaded them to its cloud. Now an Undo puts things back only into the list they were taken
// from: once that account's list has left the browser, Undo does nothing. The same account signed
// in again still gets its Undo. The real job and board stores, the list engine and its Firestore
// calls over a fake Firestore, as useCollectionSync wires them. Run: yarn test:unit
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { localMeta } from '../../src/utils/collectionSyncMeta.js';
import { completeJob, readJob } from '../../src/utils/normalizeJob.js';
import { completeBoard, readBoard } from '../../src/utils/normalizeBoard.js';
import { _resetUnpersistedNotices } from '../../src/utils/storageBackup.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';
import * as jobStore from '../../src/hooks/useJobStore.js';
import * as boardStore from '../../src/hooks/boardStoreState.js';
import { boardActions } from '../../src/hooks/useBoardStore.js';

const A = { uid: 'A', email: 'a@example.com' };
const B = { uid: 'B', email: 'b@example.com' };
const JOBS = 'cpwtcv_jobs_v1';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const job = (id, company) => ({
  id, company, role: 'Engineer', status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt: 1,
});

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
  _resetUnpersistedNotices();
  jobStore._resetJobStoreForTest();
  boardStore._resetBoardStoreForTest();
});
afterEach(() => {
  jobStore._resetJobStoreForTest();
  boardStore._resetBoardStoreForTest();
  delete globalThis.localStorage;
});

function jobsSync(cloud) {
  const { report } = recorder();
  return createCollectionSync({
    name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'),
    store: {
      items: jobStore.jobsNow, replace: jobStore.replaceJobs, subscribe: jobStore.subscribe,
      fromCloud: (d) => { const { kept } = readJob(d); return kept ? completeJob(kept) : null; },
      label: (j) => j.company || 'Untitled job',
      leaveRecovery: jobStore.leaveRecovery,
    },
    meta: localMeta('cpwtcv_jobs_sync_v1'), report, timers: manualTimers(),
  });
}

function boardsSync(cloud) {
  const { report } = recorder();
  return createCollectionSync({
    name: 'boards', io: collectionIo(cloud.fs, cloud.db, 'boards'),
    store: {
      items: boardStore.boardsNow, replace: boardStore.replaceBoards, subscribe: boardStore.subscribe,
      fromCloud: (d) => { const { kept } = readBoard(d); return kept ? completeBoard(kept) : null; },
      label: (b) => b.title || 'Untitled project',
      leaveRecovery: boardStore.leaveRecovery,
    },
    meta: localMeta('cpwtcv_boards_sync_v1'), report, timers: manualTimers(),
  });
}

async function signedInWithJobs() {
  localStorage.setItem(JOBS, JSON.stringify({ jobs: [job('j1', 'Acme'), job('j2', 'Beta')], dataVersion: 2 }));
  const cloud = fakeFirestore();
  const sync = jobsSync(cloud);
  sync.start(A);
  await settle();
  assert.ok(cloud.doc('users/A/jobs/j1'), 'setup: A\'s jobs are in A\'s cloud');
  return { cloud, sync };
}

test('Clear all jobs, sign out, Undo: A\'s jobs do not come back, and B does not upload them', async () => {
  const { cloud, sync } = await signedInWithJobs();
  const removed = jobStore.clearDemoData();
  assert.equal(removed.length, 2);

  sync.start(null);
  await settle();
  assert.deepEqual(jobStore.jobsNow(), [], 'A\'s list left with A');

  jobStore.restoreJobs(removed); // the toast's Undo, still on screen
  assert.deepEqual(jobStore.jobsNow().map((j) => j.id), [], 'before: A\'s jobs came back signed out');

  const next = jobsSync(cloud);
  next.start(B);
  await settle();
  assert.equal(cloud.doc('users/B/jobs/j1'), undefined, 'before: B uploaded A\'s job j1 to its own cloud');
  assert.equal(cloud.doc('users/B/jobs/j2'), undefined, 'before: B uploaded A\'s job j2 to its own cloud');
});

test('Delete a job, sign out, Undo: the job does not come back, and B does not upload it', async () => {
  const { cloud, sync } = await signedInWithJobs();
  const removed = jobStore.deleteJob('j1');
  assert.ok(removed);

  sync.start(null);
  await settle();
  jobStore.restoreJob(removed.job, removed.index);
  assert.deepEqual(jobStore.jobsNow().map((j) => j.id), [], 'before: A\'s job came back signed out');

  const next = jobsSync(cloud);
  next.start(B);
  await settle();
  assert.equal(cloud.doc('users/B/jobs/j1'), undefined, 'before: B uploaded A\'s job to its own cloud');
});

test('the same account signed in again still gets its Undo', async () => {
  const { sync } = await signedInWithJobs();
  const removed = jobStore.deleteJob('j1');
  sync.start(null);
  await settle();
  sync.start(A);
  await settle();
  jobStore.restoreJob(removed.job, removed.index);
  assert.ok(jobStore.jobsNow().some((j) => j.id === 'j1'), 'A\'s own list takes its job back');
});

test('never signed in: Undo works as before', () => {
  localStorage.setItem(JOBS, JSON.stringify({ jobs: [job('j1', 'Acme')], dataVersion: 2 }));
  const removed = jobStore.clearDemoData();
  jobStore.restoreJobs(removed);
  assert.deepEqual(jobStore.jobsNow().map((j) => j.id), ['j1']);
});

test('Delete a project, sign out, Undo: the project does not come back, and B does not upload it', async () => {
  const board = boardActions.addBoard({ title: 'Launch plan', key: 'LCH' });
  const cloud = fakeFirestore();
  const sync = boardsSync(cloud);
  sync.start(A);
  await settle();
  assert.ok(cloud.doc(`users/A/boards/${board.id}`), 'setup: A\'s project is in A\'s cloud');

  const removed = boardActions.deleteBoard(board.id);
  sync.start(null);
  await settle();
  assert.deepEqual(boardStore.boardsNow(), [], 'A\'s projects left with A');

  assert.equal(boardActions.restoreBoard(removed), false, 'Undo says nothing came back');
  assert.equal(boardStore.boardsNow().some((b) => b.id === board.id), false, 'before: A\'s project came back signed out');

  const next = boardsSync(cloud);
  next.start(B);
  await settle();
  assert.equal(cloud.doc(`users/B/boards/${board.id}`), undefined, 'before: B uploaded A\'s project to its own cloud');
});
