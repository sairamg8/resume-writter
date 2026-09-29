// R5-HUNT7-STATUS-MOVE-UNDO: a job moved to the wrong status by mistake (a board drag, 'Move to', a
// pipeline step, the status menu) had no Undo, and moving it back by hand left a false history
// entry and an Applied date, so the Summary's funnel and response rate counted the job at that
// step for good. The store's changeStatus now returns the change, and undoStatus takes it back:
// status, history and the applied date the move filled in are as they were, and the Summary no
// longer counts the job there. What was edited since stays; a job moved on since is left alone.
// Pure helper: undoStatusChange (src/utils/jobEdits.js). Store: src/hooks/useJobStore.js.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../src/hooks/useJobStore.js';
import { _resetUnpersistedNotices } from '../../src/utils/storageBackup.js';
import { applyStatusChange, undoStatusChange } from '../../src/utils/jobEdits.js';
import { funnelCounts, jobStats } from '../../src/utils/jobQuery.js';

const KEY = 'cpwtcv_jobs_v1';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const originalWindow = globalThis.window;
let leave;

const saved = (id, company) => ({
  id, company, role: 'Dev', status: 'saved', appliedDate: '', todos: [],
  statusHistory: [{ status: 'saved', changedAt: 1 }], createdAt: 1, updatedAt: 1,
});
const stored = () => JSON.parse(localStorage.getItem(KEY)).jobs;
const byId = (id) => store.snapshot().jobs.find((j) => j.id === id);

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
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

function open(jobs) {
  localStorage.setItem(KEY, JSON.stringify({ jobs, dataVersion: 2 }));
  leave = store.subscribe(() => {});
}

test('R5-HUNT7: a Saved job moved to Offer by mistake and undone is as it was — no history entry, no applied date, not in the funnel', () => {
  const acme = saved('a', 'Acme');
  open([acme, saved('b', 'Beta')]);
  const change = store.changeStatus('a', 'offer');
  assert.ok(change, 'the move returns what Undo needs');
  assert.equal(byId('a').status, 'offer');
  assert.equal(byId('a').statusHistory.length, 2);
  assert.ok(byId('a').appliedDate, 'the move filled in the applied date');

  store.undoStatus(change);
  const back = stored().find((j) => j.id === 'a');
  assert.equal(back.status, 'saved');
  assert.deepEqual(back.statusHistory, acme.statusHistory, 'no false history entry');
  assert.equal(back.appliedDate, '', 'no applied date left behind');
  assert.deepEqual(stored().map((j) => j.id), ['a', 'b'], 'the job keeps its place');
  assert.ok(back.updatedAt > 1, 'the undo is the newer copy for a sync');
  assert.deepEqual(funnelCounts(stored()).map((s) => s.count), [0, 0, 0, 0], 'the Summary no longer counts it at any step');
  assert.equal(jobStats(stored()).applied, 0, 'nor as an application');
});

test('R5-HUNT7: a mis-click on Rejected undone leaves no Rejected entry behind', () => {
  open([{ ...saved('a', 'Acme'), status: 'interview', appliedDate: '2026-09-01', statusHistory: [{ status: 'applied', changedAt: 1 }, { status: 'interview', changedAt: 2 }] }]);
  store.undoStatus(store.changeStatus('a', 'rejected'));
  const back = stored()[0];
  assert.equal(back.status, 'interview');
  assert.deepEqual(back.statusHistory.map((h) => h.status), ['applied', 'interview']);
  assert.equal(back.appliedDate, '2026-09-01', 'a date it had stays');
});

test('R5-HUNT7: no change, no Undo; an edit since the move stays; a job moved on since is left alone', () => {
  open([saved('a', 'Acme')]);
  assert.equal(store.changeStatus('a', 'saved'), null, 'already there');
  assert.equal(store.changeStatus('missing', 'offer'), null, 'no such job');

  const change = store.changeStatus('a', 'applied');
  store.updateJob('a', { location: 'Remote', appliedDate: '2026-09-02' });
  store.undoStatus(change);
  assert.equal(byId('a').status, 'saved');
  assert.equal(byId('a').location, 'Remote', 'an edit made since stays');
  assert.equal(byId('a').appliedDate, '2026-09-02', 'a date the user set since stays');

  const first = store.changeStatus('a', 'applied');
  store.changeStatus('a', 'interview');
  store.undoStatus(first);
  assert.equal(byId('a').status, 'interview', 'an older Undo does not undo a later move');
});

test('R5-HUNT7: undoStatusChange takes back one applyStatusChange, and a job with no history loses the one it gained', () => {
  const job = { id: 'a', company: 'Acme', status: 'saved', appliedDate: '', createdAt: 1, updatedAt: 1 };
  const moved = applyStatusChange(job, 'phone_screen', 50);
  const back = undoStatusChange(moved, job, moved, 60);
  assert.equal(back.status, 'saved');
  assert.equal('statusHistory' in back, false);
  assert.equal(back.appliedDate, '');
  assert.equal(back.updatedAt, 60);
});
