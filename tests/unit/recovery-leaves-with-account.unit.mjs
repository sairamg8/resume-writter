// A list's recovery notice and its raw backups leave this browser with the account whose list
// they copy (R5-HUNT4-recovery-backup-survives-signout). Since R2-005 an account's jobs and boards
// leave the browser when it signs out, or when another account signs in (collectionSyncPlan
// leaveList); but the copies storageBackup.backupRaw made of a list that could not be read in full
// (`<key>_backup_<ms>`) and the notice offering them (`<key>_recovery`) stayed: the notice showed
// again whoever used the browser next, and its "Download the copy" saved the last account's whole
// list. Now they go with the list. The real job and board stores, the list engine and its
// Firestore calls over a fake Firestore. Run: yarn test:unit
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { localMeta } from '../../src/utils/collectionSyncMeta.js';
import { completeJob, readJob } from '../../src/utils/normalizeJob.js';
import { completeBoard, readBoard } from '../../src/utils/normalizeBoard.js';
// A namespace import: without the fix forgetRecovery is not there, and the tests below fail at
// their assertions (fail-first), not at loading the file.
import * as storageBackup from '../../src/utils/storageBackup.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';
import * as jobStore from '../../src/hooks/useJobStore.js';
import * as boardStore from '../../src/hooks/boardStoreState.js';

const { backupRaw, pendingRecovery, rememberRecovery, _resetUnpersistedNotices } = storageBackup;
const A = { uid: 'A', email: 'a@example.com' };
const B = { uid: 'B', email: 'b@example.com' };
const JOBS = 'cpwtcv_jobs_v1';
const BOARDS = 'cpwtcv_boards_v2';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const backupsOf = (key) => [...localStorage.map.keys()].filter((k) => k.startsWith(`${key}_backup_`));
const job = (id, company, updatedAt = 1) => ({
  id, company, role: 'Engineer', status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
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

test('forgetRecovery: the notice and every backup of that key go; another list\'s are kept', () => {
  const first = backupRaw(JOBS, 'one');
  rememberRecovery(JOBS, { backupKey: first });
  const second = backupRaw(JOBS, 'two');
  rememberRecovery(JOBS, { backupKey: second });
  const resumes = backupRaw('cpwtcv_v1', 'résumés');
  rememberRecovery('cpwtcv_v1', { backupKey: resumes });

  assert.equal(typeof storageBackup.forgetRecovery, 'function', 'storageBackup.forgetRecovery(key)');
  storageBackup.forgetRecovery(JOBS);
  assert.equal(pendingRecovery(JOBS), null);
  assert.deepEqual(backupsOf(JOBS), []);
  assert.deepEqual(pendingRecovery('cpwtcv_v1'), { backupKey: resumes, earlier: [] }, 'the résumés\' notice is theirs');
  assert.equal(localStorage.getItem(resumes), 'résumés');
});

/** The list engine over the real job store, as useCollectionSync wires jobSync. */
function jobsSync(cloud) {
  const { seen, report } = recorder();
  const sync = createCollectionSync({
    name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'),
    store: {
      items: jobStore.jobsNow, replace: jobStore.replaceJobs, subscribe: jobStore.subscribe,
      fromCloud: (d) => { const { kept } = readJob(d); return kept ? completeJob(kept) : null; },
      label: (j) => j.company || 'Untitled job',
      leaveRecovery: jobStore.leaveRecovery,
    },
    meta: localMeta('cpwtcv_jobs_sync_v1'), report, timers: manualTimers(),
  });
  return { sync, seen };
}

/** A's job list, one entry of which cannot be read: the store backs it up and keeps the notice. */
function damagedJobs() {
  localStorage.setItem(JOBS, JSON.stringify({ jobs: [job('j1', 'Acme Salaries Inc', 2), 42], dataVersion: 2 }));
  jobStore.jobsNow();
  assert.ok(jobStore.snapshot().recovery?.backupKey, 'the list was not read in full: a notice');
  assert.equal(backupsOf(JOBS).length, 1);
}

test('A signs out: the job list\'s recovery notice and its raw backup leave with A\'s jobs', async () => {
  damagedJobs();
  const cloud = fakeFirestore();
  const { sync, seen } = jobsSync(cloud);
  sync.start(A);
  await settle();
  assert.equal(seen.status, 'synced');

  sync.start(null);
  await settle();
  assert.deepEqual(jobStore.jobsNow(), [], 'A\'s jobs leave (R2-005)');
  assert.equal(pendingRecovery(JOBS), null, 'before: the notice was still offered to whoever came next');
  assert.deepEqual(backupsOf(JOBS), [], 'before: A\'s whole raw job list stayed for "Download the copy"');
  assert.equal(jobStore.snapshot().recovery, null, 'the notice leaves the page too');
  assert.equal(JSON.stringify([...localStorage.map.values()]).includes('Acme Salaries'), false);
});

test('B signs in while the job list is still A\'s: the notice and backup leave with A\'s list', async () => {
  damagedJobs();
  const cloud = fakeFirestore();
  const { sync } = jobsSync(cloud);
  sync.start(A);
  await settle();
  sync.cancel();

  const next = jobsSync(cloud);
  next.sync.start(B);
  await settle();
  assert.equal(pendingRecovery(JOBS), null);
  assert.deepEqual(backupsOf(JOBS), []);
});

test('never signed in: the list is this browser\'s, and so are its notice and backup', async () => {
  damagedJobs();
  const cloud = fakeFirestore();
  const { sync } = jobsSync(cloud);
  sync.start(null);
  await settle();
  assert.ok(pendingRecovery(JOBS));
  assert.equal(backupsOf(JOBS).length, 1);
});

test('A signs out: the board list\'s recovery notice and its raw backup leave with A\'s boards', async () => {
  localStorage.setItem(BOARDS, '{ not json: A\'s projects');
  boardStore.boardsNow();
  assert.ok(boardStore.snapshot().recovery?.backupKey, 'the list was not read: a notice');
  assert.equal(backupsOf(BOARDS).length, 1);

  const cloud = fakeFirestore();
  const { seen, report } = recorder();
  const sync = createCollectionSync({
    name: 'boards', io: collectionIo(cloud.fs, cloud.db, 'boards'),
    store: {
      items: boardStore.boardsNow, replace: boardStore.replaceBoards, subscribe: boardStore.subscribe,
      fromCloud: (d) => { const { kept } = readBoard(d); return kept ? completeBoard(kept) : null; },
      label: (b) => b.title || 'Untitled project',
      leaveRecovery: boardStore.leaveRecovery,
    },
    meta: localMeta('cpwtcv_boards_sync_v1'), report, timers: manualTimers(),
  });
  sync.start(A);
  await settle();
  assert.equal(seen.status, 'synced');
  sync.start(null);
  await settle();
  assert.equal(pendingRecovery(BOARDS), null, 'before: the notice was still offered to whoever came next');
  assert.deepEqual(backupsOf(BOARDS), [], 'before: A\'s raw board list stayed for "Download the copy"');
  assert.equal(boardStore.snapshot().recovery, null);
});
