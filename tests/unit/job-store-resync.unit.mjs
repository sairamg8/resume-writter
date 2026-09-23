// The job store keeps its list in memory for the visit and listens to other tabs' saves only while
// a job page is open (J-01). Leaving the job pages removed the listener, and coming back did not
// read storage again: the tab showed the list of its first visit, and its next write erased every
// job another tab had saved meanwhile. Run: yarn test:unit
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

/** The page's `storage` listeners, so a test can fire another tab's save the way a browser does. */
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
const storedCompanies = () => JSON.parse(localStorage.getItem(KEY)).jobs.map((j) => j.company);
const shownCompanies = () => store.snapshot().jobs.map((j) => j.company);

/** Another tab saves `jobs`: storage changes, and this tab's listeners (if any) hear of it. */
function otherTabSaves(jobs) {
  save(jobs);
  const newValue = localStorage.getItem(KEY);
  for (const fn of [...listeners]) fn({ key: KEY, newValue });
}

test('J-01: back on a job page, the tab shows what another tab saved while it was away', () => {
  save([job('a', 'Acme')]);
  const leave = store.subscribe(() => {});
  assert.deepEqual(shownCompanies(), ['Acme']);
  leave(); // the user goes to the dashboard: no job page listens any more
  assert.equal(listeners.size, 0);

  otherTabSaves([job('a', 'Acme'), job('s', 'Stripe')]); // nobody here hears it

  const back = store.subscribe(() => {});
  assert.deepEqual(shownCompanies(), ['Acme', 'Stripe'], 'the list in storage, not the one of the first visit');
  assert.equal(listeners.size, 1, 'listening again');
  back();
});

test('J-01: a write after coming back keeps the other tab\'s job — it used to erase it for good', () => {
  save([job('a', 'Acme')]);
  store.subscribe(() => {})();
  otherTabSaves([job('a', 'Acme'), job('s', 'Stripe')]);

  const back = store.subscribe(() => {});
  assert.equal(typeof store.addJob, 'function', 'the store exports its actions');
  store.addJob({ company: 'Meta' });
  assert.deepEqual(storedCompanies(), ['Acme', 'Stripe', 'Meta']);
  back();
});

test('J-01: coming back tells the page, so it renders the new list', () => {
  save([job('a', 'Acme')]);
  store.subscribe(() => {})();
  otherTabSaves([job('a', 'Acme'), job('s', 'Stripe')]);
  let told = 0;
  const back = store.subscribe(() => { told += 1; });
  assert.ok(told >= 1, 'the page re-reads the snapshot');
  back();
});

test('J-01: a job this tab could not save survives coming back (keepUnsaved still applies)', () => {
  save([job('a', 'Acme')]);
  const page = store.subscribe(() => {});
  // Storage refuses the next write: the tab keeps Beta in memory and says it is not saved.
  const { setItem } = localStorage;
  localStorage.setItem = () => { const e = new Error('full'); e.name = 'QuotaExceededError'; throw e; };
  store.addJob({ company: 'Beta' });
  localStorage.setItem = setItem;
  page();

  otherTabSaves([job('a', 'Acme'), job('s', 'Stripe')]);
  const back = store.subscribe(() => {});
  assert.deepEqual(shownCompanies(), ['Acme', 'Stripe', 'Beta']);
  assert.deepEqual(storedCompanies(), ['Acme', 'Stripe', 'Beta'], 'written again, now that there is room');
  back();
});
