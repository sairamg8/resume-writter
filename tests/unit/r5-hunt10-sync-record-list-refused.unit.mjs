// R5-HUNT10-SYNC-RECORD-SAVED-LIST-REFUSED-DELETES-CLOUD: the job and project lists keep their sync
// record (which items the account's cloud holds, collectionSyncMeta.js) under a key of its own,
// saved after or before the list. Storage nearly full, the list's save was refused (kept in memory
// only, "Changes are not being saved") while the record, a few bytes per item, still fitted: it then
// said this browser held items it never stored. At the next reload they were "known here, gone from
// the list" — deleted here — and the first sync deleted them from the account, and so from every
// other device. Now the record claims only what storage holds: the next first sync brings the rest
// back from the cloud. The real job and board stores, the list engine and its Firestore calls over
// a fake Firestore. Run: yarn test:unit
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { BOARDS_SYNC_KEY, JOBS_SYNC_KEY, localMeta } from '../../src/utils/collectionSyncMeta.js';
import { completeJob, readJob } from '../../src/utils/normalizeJob.js';
import { completeBoard, readBoard } from '../../src/utils/normalizeBoard.js';
import { createBoard } from '../../src/utils/boardModel.js';
import { _resetUnpersistedNotices } from '../../src/utils/storageBackup.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';
import * as jobStore from '../../src/hooks/useJobStore.js';
import * as boardStore from '../../src/hooks/boardStoreState.js';

const A = { uid: 'A', email: 'a@example.com' };
const JOBS = 'cpwtcv_jobs_v1';
const BOARDS = 'cpwtcv_boards_v2';

/** localStorage as a Map; a key in `refused` is too large to fit: its writes are refused (full). */
class TightStorage {
  constructor() { this.map = new Map(); this.refused = new Set(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) {
    if (this.refused.has(k)) throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError', code: 22 });
    this.map.set(k, String(v));
  }
  removeItem(k) { this.map.delete(k); }
}

const job = (id, company, updatedAt = 1) => ({
  id, company, role: 'Engineer', status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});
const jobPath = (uid, id) => `users/${uid}/jobs/${id}`;
const boardPath = (uid, id) => `users/${uid}/boards/${id}`;
const cloudIds = (cloud, uid, name) => [...cloud.data.keys()].filter((p) => p.startsWith(`users/${uid}/${name}/`)).map((p) => p.split('/').at(-1)).toSorted();
const fromCloud = (read, complete) => (d) => { const { kept } = read(d); return kept ? complete(kept) : null; };

/** A page load: the stores read storage afresh, and the engine starts over them, as useCollectionSync wires them. */
function load(cloud) {
  jobStore._resetJobStoreForTest();
  boardStore._resetBoardStoreForTest();
  const engine = (name, store, key) => {
    const timers = manualTimers();
    const { seen, report } = recorder();
    const sync = createCollectionSync({ name, io: collectionIo(cloud.fs, cloud.db, name), store, meta: localMeta(key), report, timers });
    return { sync, timers, seen };
  };
  return {
    jobs: engine('jobs', {
      items: jobStore.jobsNow, saved: jobStore.savedJobs, replace: jobStore.replaceJobs, subscribe: jobStore.subscribe,
      fromCloud: fromCloud(readJob, completeJob), label: (j) => j.company,
    }, JOBS_SYNC_KEY),
    boards: engine('boards', {
      items: boardStore.boardsNow, saved: boardStore.savedBoards, replace: boardStore.replaceBoards, subscribe: boardStore.subscribe,
      fromCloud: fromCloud(readBoard, completeBoard), label: (b) => b.title,
    }, BOARDS_SYNC_KEY),
  };
}

beforeEach(() => {
  globalThis.localStorage = new TightStorage();
  localStorage.setItem(JOBS, JSON.stringify({ jobs: [], dataVersion: 2 }));
  localStorage.setItem(BOARDS, JSON.stringify({ boards: [], dataVersion: 2 }));
  _resetUnpersistedNotices();
});
afterEach(() => {
  jobStore._resetJobStoreForTest();
  boardStore._resetBoardStoreForTest();
  delete globalThis.localStorage;
});

test('a fresh browser whose storage refuses the account\'s job list: the reload keeps the jobs in the account and brings them back', async () => {
  const cloud = fakeFirestore({ [jobPath('A', 'j1')]: job('j1', 'Acme', 2), [jobPath('A', 'j2')]: job('j2', 'Beta', 3), [jobPath('A', 'j3')]: job('j3', 'Gamma', 4) });
  localStorage.refused.add(JOBS);
  let page = load(cloud);
  page.jobs.sync.start(A);
  await settle();
  assert.deepEqual(jobStore.jobsNow().map((j) => j.id).toSorted(), ['j1', 'j2', 'j3'], 'shown from memory');
  assert.ok(jobStore.snapshot().persistError, 'the list was not saved: "Changes are not being saved"');
  assert.deepEqual(JSON.parse(localStorage.getItem(JOBS)).jobs, [], 'storage still holds the empty list');

  page.jobs.sync.cancel();
  page = load(cloud);
  page.jobs.sync.start(A);
  await settle();
  assert.deepEqual(cloudIds(cloud, 'A', 'jobs'), ['j1', 'j2', 'j3'], 'before: all three were deleted from the account at the reload');
  assert.deepEqual(jobStore.jobsNow().map((j) => j.id).toSorted(), ['j1', 'j2', 'j3'], 'the reload shows them again, from the cloud');

  localStorage.refused.clear();
  page.jobs.sync.cancel();
  page = load(cloud);
  page.jobs.sync.start(A);
  await settle();
  assert.deepEqual(JSON.parse(localStorage.getItem(JOBS)).jobs.map((j) => j.id).toSorted(), ['j1', 'j2', 'j3'], 'saved once storage has room');
  assert.deepEqual(Object.keys(JSON.parse(localStorage.getItem(JOBS_SYNC_KEY)).versions).toSorted(), ['j1', 'j2', 'j3'], 'and recorded as synced');
  assert.equal(page.jobs.seen.status, 'synced');
});

test('a job added while storage refuses the list: sent to the cloud, and still there — and here — after a reload', async () => {
  const cloud = fakeFirestore({ [jobPath('A', 'j1')]: job('j1', 'Acme', 2) });
  let page = load(cloud);
  page.jobs.sync.start(A);
  await settle();
  assert.equal(page.jobs.seen.status, 'synced');

  localStorage.refused.add(JOBS);
  const id = jobStore.addJob({ company: 'Notes Inc', notes: 'A long note' });
  assert.ok(jobStore.snapshot().persistError, 'the list was not saved');
  await page.jobs.timers.fire();
  await settle();
  assert.deepEqual(cloudIds(cloud, 'A', 'jobs'), ['j1', id].toSorted(), 'the flush sent it');
  assert.equal(JSON.parse(localStorage.getItem(JOBS_SYNC_KEY)).versions[id], undefined, 'the record does not claim a job storage never held');

  page.jobs.sync.cancel();
  page = load(cloud);
  page.jobs.sync.start(A);
  await settle();
  assert.deepEqual(cloudIds(cloud, 'A', 'jobs'), ['j1', id].toSorted(), 'before: the reload deleted it from the account');
  assert.ok(jobStore.jobsNow().some((j) => j.id === id && j.company === 'Notes Inc'), 'it comes back from the cloud');
});

test('a project made while storage refuses the list: sent to the cloud, and still there after a reload', async () => {
  const cloud = fakeFirestore();
  let page = load(cloud);
  page.boards.sync.start(A);
  await settle();
  assert.equal(page.boards.seen.status, 'synced');

  localStorage.refused.add(BOARDS);
  const board = createBoard({ title: 'Kitchen' });
  boardStore.setBoards((list) => [...list, board]);
  assert.ok(boardStore.snapshot().persistError, 'the list was not saved');
  await page.boards.timers.fire();
  await settle();
  assert.ok(cloud.data.has(boardPath('A', board.id)), 'the flush sent it');

  page.boards.sync.cancel();
  page = load(cloud);
  page.boards.sync.start(A);
  await settle();
  assert.deepEqual(cloudIds(cloud, 'A', 'boards'), [board.id], 'before: the reload deleted it from the account');
  assert.ok(boardStore.boardsNow().some((b) => b.id === board.id), 'it comes back from the cloud');
});
