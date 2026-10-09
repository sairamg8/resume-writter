// CYC8-S6 (jobs): another tab saved a job list this tab cannot read in full. takeOtherTabsList backed
// the raw value up (loadSavedList) but dropped the rest of what the first load does with it: no
// recovery notice was kept (the user never heard a job was left out), and the sync record kept
// naming every job the cloud holds, so the next first sync took the jobs left out for ones deleted
// here and deleted them from the account. Now it behaves like the boot-time unreadable-value path:
// the recovery notice, and the record forgetting what the cloud holds (forgetSynced).
// The real job store over a memory localStorage. Run: yarn test:unit
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { _resetUnpersistedNotices, pendingRecovery } from '../../src/utils/storageBackup.js';
import * as jobStore from '../../src/hooks/useJobStore.js';

const KEY = 'cpwtcv_jobs_v1';
const SYNC_KEY = 'cpwtcv_jobs_sync_v1';

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
const saved = (jobs) => JSON.stringify({ jobs, dataVersion: 2 });

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

test('a list another tab saved that cannot be read in full: the notice is kept and the sync record forgets the cloud\'s jobs', () => {
  localStorage.setItem(KEY, saved([job('a', 'Acme')]));
  localStorage.setItem(SYNC_KEY, JSON.stringify({ uid: 'A', versions: { a: 1 }, order: ['a'], stashed: {} }));
  unsubscribe = jobStore.subscribe(() => {});
  assert.equal(jobStore.snapshot().recovery, null, 'a readable list: no notice');

  // The other tab saves a list holding an entry nobody can read.
  localStorage.setItem(KEY, saved([job('a', 'Acme'), 'not a job']));
  unsubscribe();
  unsubscribe = jobStore.subscribe(() => {}); // back on a job page: the other tab's list is taken in

  const { recovery } = jobStore.snapshot();
  assert.ok(recovery?.backupKey, 'the recovery notice names the backup of what was read');
  assert.equal(localStorage.getItem(recovery.backupKey), saved([job('a', 'Acme'), 'not a job']), 'the backup holds the raw value');
  assert.deepEqual(pendingRecovery(KEY)?.backupKey, recovery.backupKey, 'the notice is kept until dismissed');
  const record = JSON.parse(localStorage.getItem(SYNC_KEY));
  assert.deepEqual(record.versions, {}, 'the record no longer says the cloud holds job a: nothing left out looks deleted');
  assert.equal(record.uid, 'A', 'the account stays');
});
