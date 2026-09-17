// Unit tests for ONB-4-NB1: recovery notice durability when storage fits backup but not notice.
// Probes whether after repair and the next save, a fresh reload returns pendingRecovery
// and the backup still exists. Run: node --test tests/unit/storage-recovery-durability.unit.mjs
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  readSavedList, loadSavedList, backupRaw, rememberRecovery, setItemWithRoom,
  pendingRecovery, readBackup, _resetUnpersistedNotices,
} from '../../src/utils/storageBackup.js';
import { readJob } from '../../src/utils/normalizeJob.js';

class MemoryStorage {
  constructor(quota = Infinity) { this.map = new Map(); this.quota = quota; }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) {
    const used = [...this.map].reduce((n, [key, val]) => n + (key === k ? 0 : key.length + val.length), 0);
    if (used + k.length + String(v).length > this.quota) {
      throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
    }
    this.map.set(k, String(v));
  }
  removeItem(k) { this.map.delete(k); }
}

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
  _resetUnpersistedNotices();
});

test('ONB-4-NB1: resume store recovery notice survives reload when quota fits backup but not notice at repair time', () => {
  const KEY = 'cpwtcv_v1';
  const unreadable = 'x'.repeat(300);
  localStorage.setItem(KEY, unreadable);
  const used = KEY.length + unreadable.length;
  // Quota allows backup (~330 chars), but not backup + notice (~330 + ~78 = 408 > 350)
  localStorage.quota = used + 350;

  // Step 1: useResumeStore reads unreadable store
  const { unreadable: raw } = readSavedList(KEY, 'resumes', () => ({ kept: null }));
  assert.equal(raw, unreadable);

  // Step 2: backup is taken and notice is remembered
  const backupKey = backupRaw(KEY, raw);
  assert.ok(backupKey, 'backup should fit in quota');
  assert.equal(readBackup(backupKey), unreadable);

  const notice = rememberRecovery(KEY, { backupKey });
  assert.equal(notice.backupKey, backupKey);

  // Step 3: Next save frees room by replacing 300 chars of unreadable data with repaired store
  const repairedStore = JSON.stringify({
    resumes: [], activeId: null, dataVersion: 2, deletedIds: [], deletedInfo: {}, syncedUid: null,
  });
  setItemWithRoom(KEY, repairedStore);

  assert.ok(localStorage.getItem(`${KEY}_recovery`), 'localStorage must hold the recovery notice');
  _resetUnpersistedNotices(); // Hard reload: in-memory state wiped

  // Step 4: Fresh load / reload (new visit over same localStorage)
  const reloadedNotice = pendingRecovery(KEY);
  assert.ok(reloadedNotice, 'pendingRecovery must not be null after reload');
  assert.equal(reloadedNotice.backupKey, backupKey);
  assert.equal(readBackup(backupKey), unreadable, 'backup copy must still be reachable on disk');
});

test('ONB-4-NB1: job store recovery notice survives reload when quota fits backup but not notice at repair time', () => {
  const KEY = 'cpwtcv_jobs_v1';
  const unreadable = 'x'.repeat(300);
  localStorage.setItem(KEY, unreadable);
  const used = KEY.length + unreadable.length;
  // Quota allows backup (~330 chars), but not backup + notice (~330 + ~78 = 408 > 350)
  localStorage.quota = used + 350;

  // Step 1: useJobStore snapshot() calls loadSavedList
  const { recovery: found } = loadSavedList(KEY, 'jobs', readJob);
  assert.ok(found?.backupKey, 'backup should fit in quota');
  assert.equal(readBackup(found.backupKey), unreadable);

  // Step 2: rememberRecovery is called
  const notice = rememberRecovery(KEY, found);
  assert.equal(notice.backupKey, found.backupKey);

  // Step 3: Next save frees room by replacing 300 chars with empty jobs list
  const repairedJobs = JSON.stringify({ jobs: [], dataVersion: 2 });
  setItemWithRoom(KEY, repairedJobs);

  assert.ok(localStorage.getItem(`${KEY}_recovery`), 'localStorage must hold the recovery notice');
  _resetUnpersistedNotices(); // Hard reload: in-memory state wiped

  // Step 4: Fresh load / reload
  const reloadedNotice = pendingRecovery(KEY);
  assert.ok(reloadedNotice, 'pendingRecovery must not be null after reload');
  assert.equal(reloadedNotice.backupKey, found.backupKey);
  assert.equal(readBackup(found.backupKey), unreadable, 'backup copy must still be reachable on disk');
});
