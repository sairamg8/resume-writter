// Typing-freeze finding 5, the same race in the job store: with a job page open the tab hears other tabs'
// saves through the `storage` event, but a save that had landed while its event was still on its way was
// not heard yet, and this tab's next change was written over it — and that tab, hearing the write, read
// this list as the other's. The other tab's job was gone from storage and from both tabs. Now a change
// made while a page listens reads storage first and takes in a save it has not heard of.
// Run: yarn test:unit
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../src/hooks/useJobStore.js';
import { _resetUnpersistedNotices } from '../../src/utils/storageBackup.js';

const KEY = 'cpwtcv_jobs_v1';

class MemoryStorage {
  constructor() { this.map = new Map(); this.writes = 0; }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { if (k === KEY) this.writes += 1; this.map.set(k, String(v)); }
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
const storedCompanies = () => JSON.parse(localStorage.getItem(KEY)).jobs.map((j) => j.company).sort();
const shownCompanies = () => store.snapshot().jobs.map((j) => j.company).sort();
/** The event of the save arriving, as a browser delivers it. */
const hear = () => { const newValue = localStorage.getItem(KEY); for (const fn of [...listeners]) fn({ key: KEY, newValue }); };

test('a job page is open and another tab saves a job whose event has not arrived: this tab\'s next change keeps it', () => {
  save([job('a', 'Acme')]);
  const leave = store.subscribe(() => {});
  save([job('a', 'Acme'), job('s', 'Stripe')]); // the other tab's save has landed; its event is on its way
  store.addJob({ company: 'Meta' });
  assert.deepEqual(storedCompanies(), ['Acme', 'Meta', 'Stripe'], 'before: Stripe was written over');
  assert.deepEqual(shownCompanies(), ['Acme', 'Meta', 'Stripe']);
  const writes = localStorage.writes;
  hear(); // the event arrives: this is this tab's own write, already in the list
  assert.deepEqual(shownCompanies(), ['Acme', 'Meta', 'Stripe']);
  assert.deepEqual(storedCompanies(), ['Acme', 'Meta', 'Stripe']);
  assert.equal(localStorage.writes, writes, 'hearing it writes nothing');
  leave();
});

test('an edit made there and one made here to the same job\'s other fields: the job is the one in storage, then this change on it', () => {
  save([job('a', 'Acme', { notes: '' })]);
  const leave = store.subscribe(() => {});
  save([job('a', 'Acme', { notes: 'Phone screen booked', updatedAt: 5 })]);
  store.updateJob('a', { role: 'Staff Engineer' });
  const [saved] = JSON.parse(localStorage.getItem(KEY)).jobs;
  assert.match(saved.notes, /Phone screen booked/, 'the other tab\'s edit stays');
  assert.equal(saved.role, 'Staff Engineer');
  leave();
});

test('nothing waiting: a change is one write, and the event of a save already taken in changes nothing', () => {
  save([job('a', 'Acme')]);
  const leave = store.subscribe(() => {});
  const before = localStorage.writes;
  store.addJob({ company: 'Meta' });
  assert.equal(localStorage.writes, before + 1);
  save([job('a', 'Acme'), job('m2', 'Other')]); // the other tab saves
  hear(); // heard
  const afterHear = localStorage.writes;
  store.addJob({ company: 'Third' });
  assert.equal(localStorage.writes, afterHear + 1, 'heard: not taken again before this change');
  assert.ok(storedCompanies().includes('Other'));
  leave();
});
