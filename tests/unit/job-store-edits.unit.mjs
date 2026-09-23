// The job store's writes, driven as plain functions over an in-memory localStorage: an edit of a job
// that is gone (J-16), an edit after another tab's change (J-02), the applied date on add and on a
// status change (J-10). Run: yarn test:unit
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../src/hooks/useJobStore.js';
import { _resetUnpersistedNotices } from '../../src/utils/storageBackup.js';
import { todayLocalISO } from '../../src/utils/dates.js';

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
let leave;
const originalWindow = globalThis.window;

const job = (id, company, extra = {}) => ({
  id, company, role: 'Dev', status: 'applied', appliedDate: '2026-09-01', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt: 1, ...extra,
});
const save = (jobs) => localStorage.setItem(KEY, JSON.stringify({ jobs, dataVersion: 2 }));
const stored = () => JSON.parse(localStorage.getItem(KEY)).jobs;
const shown = () => store.snapshot().jobs;
const byId = (id) => shown().find((j) => j.id === id);

/** Open a job page over storage holding `jobs`. */
function open(jobs) {
  save(jobs);
  leave = store.subscribe(() => {});
}

/** Another tab saves `jobs` while this tab's page listens. */
function otherTabSaves(jobs) {
  save(jobs);
  const newValue = localStorage.getItem(KEY);
  for (const fn of [...listeners]) fn({ key: KEY, newValue });
}

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
  leave?.();
  leave = null;
  if (originalWindow) globalThis.window = originalWindow;
  else delete globalThis.window;
  delete globalThis.localStorage;
  store._resetJobStoreForTest();
});

test('J-16: an edit of a job that is gone says so (false) and writes nothing', () => {
  open([job('a', 'Acme')]);
  const before = localStorage.getItem(KEY);
  assert.equal(store.updateJob('missing', { company: 'Typed' }), false);
  assert.equal(localStorage.getItem(KEY), before);
  assert.equal(store.updateJob('a', { company: 'Acme Inc' }), true);
  assert.equal(stored()[0].company, 'Acme Inc');
});

test('J-02: an edit naming only the role keeps the to-do and the status another tab just saved', () => {
  open([job('a', 'Acme')]);
  const theirs = {
    ...job('a', 'Acme'), status: 'interview', todos: [{ id: 't1', text: 'Prep system design', done: false }],
    statusHistory: [{ status: 'applied', changedAt: 1 }, { status: 'interview', changedAt: 2 }], updatedAt: 2,
  };
  otherTabSaves([theirs]);
  store.updateJob('a', { role: 'Senior Dev' });
  const [a] = stored();
  assert.deepEqual([a.role, a.status, a.todos.map((t) => t.text), a.statusHistory.map((h) => h.status)],
    ['Senior Dev', 'interview', ['Prep system design'], ['applied', 'interview']]);
});

test('J-10: a job added as Saved has no applied date; one added past Saved gets today unless given one', () => {
  open([]);
  const today = todayLocalISO();
  const saved = store.addJob({ company: 'S', status: 'saved' });
  const applied = store.addJob({ company: 'A', status: 'applied' });
  const given = store.addJob({ company: 'G', status: 'interview', appliedDate: '2026-01-02' });
  const blank = store.addJob({ company: 'B', status: 'applied', appliedDate: '' });
  assert.deepEqual([byId(saved).appliedDate, byId(applied).appliedDate, byId(given).appliedDate, byId(blank).appliedDate],
    ['', today, '2026-01-02', ''], 'a date the caller cleared on purpose stays clear');
  assert.deepEqual(byId(applied).statusHistory.map((h) => h.status), ['applied']);
});

test('J-10: moving a Saved job to Applied (or later) fills a blank applied date with today, once', () => {
  open([job('a', 'Acme', { status: 'saved', appliedDate: '', statusHistory: [{ status: 'saved', changedAt: 1 }] })]);
  store.updateJob('a', { status: 'applied' });
  const today = todayLocalISO();
  assert.equal(byId('a').appliedDate, today);
  assert.deepEqual(byId('a').statusHistory.map((h) => h.status), ['saved', 'applied']);
  store.updateJob('a', { status: 'applied' });
  assert.equal(byId('a').statusHistory.length, 2, 'the same status again: no second entry');
  assert.equal(stored()[0].appliedDate, today);
});
