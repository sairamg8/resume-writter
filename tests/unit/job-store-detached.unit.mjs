// R5-HUNT3-job-store-stale-write-after-leaving-job-pages: with no job page open the store stops
// listening to other tabs (J-01), yet two things still used its old list. An Undo toast outlives the
// job pages (it lives in the workspace layout), and its restore wrote this tab's old list over what
// another tab saved meanwhile; a job form reopened read the old job at its first render, before
// subscribe re-read storage, and saved the old notes back. Now the list is taken from storage first,
// keeping what storage refused here. Run: yarn test:unit
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../src/hooks/useJobStore.js';
import { _resetUnpersistedNotices } from '../../src/utils/storageBackup.js';

const KEY = 'cpwtcv_jobs_v1';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

let listeners;
const originalWindow = globalThis.window;

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
  listeners = new Set();
  globalThis.window = {
    addEventListener: (type, fn) => { if (type === 'storage') listeners.add(fn); },
    removeEventListener: (type, fn) => { if (type === 'storage') listeners.delete(fn); },
  };
  store._resetJobStoreForTest();
  _resetUnpersistedNotices();
});

afterEach(() => {
  if (originalWindow) globalThis.window = originalWindow;
  else delete globalThis.window;
  delete globalThis.localStorage;
  store._resetJobStoreForTest();
});

const job = (id, company, extra = {}) => ({
  id, company, role: 'Dev', status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt: 1, ...extra,
});
const save = (jobs) => localStorage.setItem(KEY, JSON.stringify({ jobs, dataVersion: 2 }));
const storedJobs = () => JSON.parse(localStorage.getItem(KEY)).jobs;
const storedCompanies = () => storedJobs().map((j) => j.company);

/** Another tab saves `jobs`: storage changes, and this tab's listeners (if any) hear of it. */
function otherTabSaves(jobs) {
  save(jobs);
  const newValue = localStorage.getItem(KEY);
  for (const fn of [...listeners]) fn({ key: KEY, newValue });
}

test('Undo of a delete, clicked after leaving the job pages, keeps the job another tab added meanwhile', () => {
  save([job('a', 'Acme'), job('b', 'Beta')]);
  const page = store.subscribe(() => {});
  const was = store.deleteJob('a');
  page(); // to /boards: the toast stays, no job page listens
  assert.equal(listeners.size, 0);

  otherTabSaves([job('b', 'Beta'), job('s', 'Stripe')]);
  store.restoreJob(was.job, was.index);

  assert.deepEqual(storedCompanies(), ['Acme', 'Beta', 'Stripe'], 'Stripe is not erased by the Undo');
});

test('Undo of "Clear all jobs" after leaving the job pages keeps the other tab\'s job', () => {
  save([job('a', 'Acme')]);
  const page = store.subscribe(() => {});
  const was = store.clearDemoData();
  page();
  otherTabSaves([job('s', 'Stripe')]);
  store.restoreJobs(was);
  assert.deepEqual(storedCompanies(), ['Acme', 'Stripe']);
});

test('a task-delete Undo (updateJob) after leaving the job pages keeps the other tab\'s edit to another job', () => {
  save([job('a', 'Acme', { todos: [{ id: 't1', text: 'Call', done: false }] }), job('b', 'Beta', { notes: 'old' })]);
  const page = store.subscribe(() => {});
  store.updateJob('a', { todos: [] });
  page();
  otherTabSaves([job('a', 'Acme'), job('b', 'Beta', { notes: '<p>new</p>' })]);
  store.updateJob('a', { todos: [{ id: 't1', text: 'Call', done: false }] });
  const beta = storedJobs().find((j) => j.id === 'b');
  assert.equal(beta.notes, '<p>new</p>', 'the other tab\'s notes are not written over');
  assert.equal(storedJobs().find((j) => j.id === 'a').todos.length, 1);
});

test('a job form reopened after leaving the job pages first renders the job as stored now', () => {
  save([job('a', 'Acme', { notes: '<p>old</p>', salary: '100k' })]);
  store.subscribe(() => {})(); // the edit page, then away to the dashboard
  otherTabSaves([job('a', 'Acme', { notes: '<p>old</p><p>more</p>', salary: '120k' })]);

  // The form's first render reads the snapshot before it subscribes; its initial values freeze it.
  const first = store.snapshot().jobs.find((j) => j.id === 'a');
  assert.equal(first.notes, '<p>old</p><p>more</p>');
  assert.equal(first.salary, '120k');
  assert.equal(store.snapshot(), store.snapshot(), 'the same snapshot while storage is unchanged');
});

test('a job this tab could not save survives the re-read with no job page open', () => {
  save([job('a', 'Acme')]);
  const page = store.subscribe(() => {});
  const { setItem } = localStorage;
  localStorage.setItem = () => { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; };
  store.addJob({ company: 'Unsaved' });
  localStorage.setItem = setItem;
  page();
  otherTabSaves([job('a', 'Acme'), job('s', 'Stripe')]);
  assert.deepEqual(store.snapshot().jobs.map((j) => j.company), ['Acme', 'Stripe', 'Unsaved']);
});
