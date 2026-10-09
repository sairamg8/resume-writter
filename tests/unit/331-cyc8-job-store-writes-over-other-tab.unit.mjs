// CYC8-S4: another tab saves the job list and this tab, listening, has not yet heard the storage
// event. setJobs takes that save in first (takeOtherTabsList) — but importJobs and moveJob had
// already built their whole new list over this tab's OLD one and handed setJobs `() => list`,
// which ignores its argument: the stale list was written over the other tab's change. Now an import
// and a move are built over the list once the other tab's save is taken in. (The cloud sync's
// result, replaceJobs, stays as it was: keeping another tab's job over it also kept that job in
// the list a sign-out empties, for the next account to upload.)
// The real job store over a memory localStorage. Run: yarn test:unit
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { _resetUnpersistedNotices } from '../../src/utils/storageBackup.js';
import * as jobStore from '../../src/hooks/useJobStore.js';

const KEY = 'cpwtcv_jobs_v1';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const job = (id, company, status = 'applied') => ({
  id, company, role: 'Engineer', status, todos: [],
  statusHistory: [{ status, changedAt: 1 }], createdAt: 1, updatedAt: 1,
});
const saved = (jobs) => JSON.stringify({ jobs, dataVersion: 2 });
const storedIds = () => JSON.parse(localStorage.getItem(KEY)).jobs.map((j) => j.id).toSorted();

let unsubscribe;
beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
  _resetUnpersistedNotices();
  jobStore._resetJobStoreForTest();
});
afterEach(() => {
  unsubscribe?.();
  unsubscribe = null;
  jobStore._resetJobStoreForTest();
  delete globalThis.localStorage;
});

/** This tab with a job page open over [a, b], and the other tab having saved [a, b, other] meanwhile (no event yet). */
function twoTabs() {
  localStorage.setItem(KEY, saved([job('a', 'Acme'), job('b', 'Beta')]));
  unsubscribe = jobStore.subscribe(() => {});
  assert.deepEqual(jobStore.jobsNow().map((j) => j.id), ['a', 'b']);
  localStorage.setItem(KEY, saved([job('a', 'Acme'), job('b', 'Beta'), job('other', 'Added in the other tab')]));
}

test('an import keeps the job the other tab saved meanwhile', () => {
  twoTabs();
  const result = jobStore.importJobs([job('imp', 'Imported Co')]);
  assert.equal(result.added, 1);
  assert.deepEqual(storedIds(), ['a', 'b', 'imp', 'other']);
  assert.deepEqual(jobStore.jobsNow().map((j) => j.id).toSorted(), ['a', 'b', 'imp', 'other']);
});

test('moving a job keeps the job the other tab saved meanwhile', () => {
  twoTabs();
  const was = jobStore.moveJob('a', { status: 'interview' });
  assert.equal(was.job.id, 'a');
  assert.deepEqual(storedIds(), ['a', 'b', 'other']);
  assert.equal(jobStore.jobsNow().find((j) => j.id === 'a').status, 'interview');
});
