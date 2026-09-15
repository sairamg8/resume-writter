// Unit tests for reading the saved lists without losing what cannot be read
// (src/utils/storageBackup.js), against an in-memory localStorage. Run: yarn test:unit
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadSavedList, pendingRecovery, rememberRecovery, backupRaw, setItemWithRoom, readBackup, BACKUPS_KEPT,
} from '../../src/utils/storageBackup.js';

/** A localStorage stand-in: the Storage methods the app uses, and a quota in characters. */
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

const KEY = 'cpwtcv_v1';
const backups = () => [...globalThis.localStorage.map.keys()].filter((k) => k.startsWith(`${KEY}_backup_`));
const keepWithId = (r) => (r && typeof r === 'object' && r.id ? r : null);

beforeEach(() => { globalThis.localStorage = new MemoryStorage(); });

test('loadSavedList: nothing saved gives no list and no notice', () => {
  assert.deepEqual(loadSavedList(KEY, 'resumes', keepWithId), { saved: null, list: null, recovery: null });
});

test('loadSavedList: a whole list that reads back keeps every entry as it is, with no backup', () => {
  const a = { id: 'a', name: 'A' };
  localStorage.setItem(KEY, JSON.stringify({ resumes: [a], activeId: 'a' }));
  const { saved, list, recovery } = loadSavedList(KEY, 'resumes', keepWithId);
  assert.deepEqual(list, [a]);
  assert.equal(saved.activeId, 'a');
  assert.equal(recovery, null);
  assert.deepEqual(backups(), []);
});

test('loadSavedList: one unreadable entry is left out, after the raw value is backed up (R4-6)', () => {
  const raw = JSON.stringify({ resumes: [null, { name: 'no id' }, { id: 'r3', name: 'Kept' }] });
  localStorage.setItem(KEY, raw);
  const { list, recovery } = loadSavedList(KEY, 'resumes', keepWithId);
  assert.deepEqual(list.map((r) => r.id), ['r3']);
  assert.equal(recovery.backupKey, backups()[0]);
  assert.equal(localStorage.getItem(recovery.backupKey), raw, 'the whole original, the dropped entries included');
});

test('loadSavedList: a repaired entry counts too; a value that is not the list at all is backed up', () => {
  localStorage.setItem(KEY, JSON.stringify({ resumes: [{ id: 'a', todos: 'x' }] }));
  const repaired = loadSavedList(KEY, 'resumes', (r) => ({ ...r, todos: [] }));
  assert.deepEqual(repaired.list, [{ id: 'a', todos: [] }]);
  assert.ok(repaired.recovery.backupKey);

  for (const raw of ['{ not json', '{"resumes":{"a":1}}', 'null']) {
    globalThis.localStorage = new MemoryStorage();
    localStorage.setItem(KEY, raw);
    const { saved, list, recovery } = loadSavedList(KEY, 'resumes', keepWithId);
    assert.deepEqual([saved, list], [null, []], raw);
    assert.equal(localStorage.getItem(recovery.backupKey), raw, raw);
  }
});

test('loadSavedList: storage that refuses the copy still reports the loss, with no key', () => {
  localStorage.setItem(KEY, '{ not json');
  localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.deepEqual(loadSavedList(KEY, 'resumes', keepWithId).recovery, { backupKey: null });
});

test('loadSavedList twice on the same value (React StrictMode in development): one copy, and no "repaired before" (V2W1a-9)', () => {
  localStorage.setItem(KEY, '{ not json');
  const first = loadSavedList(KEY, 'resumes', keepWithId).recovery;
  const second = loadSavedList(KEY, 'resumes', keepWithId).recovery; // the same raw value, not saved over yet
  assert.equal(second.backupKey, first.backupKey, 'before: a second backup of the same content');
  assert.equal(backups().length, 1);
  rememberRecovery(KEY, first);
  assert.deepEqual(rememberRecovery(KEY, second).earlier, [], 'before: the first copy was named an earlier repair');
  rememberRecovery(KEY, null);
});

test('pendingRecovery / rememberRecovery: the notice is kept per list until dismissed', () => {
  rememberRecovery(KEY, { backupKey: `${KEY}_backup_1` });
  assert.deepEqual(pendingRecovery(KEY), { backupKey: `${KEY}_backup_1`, earlier: [] });
  assert.equal(pendingRecovery('cpwtcv_jobs_v1'), null, 'another list has its own');
  rememberRecovery(KEY, null);
  assert.equal(pendingRecovery(KEY), null);
  localStorage.setItem(`${KEY}_recovery`, '{ not json');
  assert.equal(pendingRecovery(KEY), null);
  localStorage.setItem(`${KEY}_recovery`, JSON.stringify({ backupKey: `${KEY}_backup_7` })); // saved by an older build
  assert.deepEqual(pendingRecovery(KEY), { backupKey: `${KEY}_backup_7`, earlier: [] });
});

test('rememberRecovery: another repair before the notice is dismissed keeps the first copy named (R8-10)', () => {
  // Before, the second notice replaced the first: its backup was no longer named anywhere.
  assert.deepEqual(rememberRecovery(KEY, { backupKey: `${KEY}_backup_1` }), { backupKey: `${KEY}_backup_1`, earlier: [] });
  const second = rememberRecovery(KEY, { backupKey: `${KEY}_backup_2` });
  assert.deepEqual(second, { backupKey: `${KEY}_backup_2`, earlier: [`${KEY}_backup_1`] });
  assert.deepEqual(pendingRecovery(KEY), second, 'after a reload too');
  // A third with storage too full for a copy: the earlier copies are still named.
  assert.deepEqual(rememberRecovery(KEY, { backupKey: null }), { backupKey: null, earlier: [`${KEY}_backup_1`, `${KEY}_backup_2`] });
  rememberRecovery(KEY, null);
  assert.equal(pendingRecovery(KEY), null, 'dismissed: all of it');
});

test('backupRaw keeps the newest three backups of a key, however many loads fail (R4-8)', () => {
  // Before: every failed load added one for good, in the ~5 MB quota (photos are data URLs).
  const jobsBackup = backupRaw('cpwtcv_jobs_v1', 'jobs copy');
  const keys = ['one', 'two', 'three', 'four', 'five'].map((raw) => backupRaw(KEY, raw));
  assert.equal(new Set(keys).size, 5, 'two backups in one millisecond are two keys');
  assert.equal(BACKUPS_KEPT, 3);
  assert.deepEqual(backups().map((k) => localStorage.getItem(k)), ['three', 'four', 'five']);
  assert.equal(localStorage.getItem(jobsBackup), 'jobs copy', 'another key keeps its own');
  assert.equal(readBackup(keys[4]), 'five');
  assert.equal(readBackup(keys[0]), null);
});

test('setItemWithRoom: a save that does not fit removes backups, oldest first, until it does (R4-8)', () => {
  globalThis.localStorage = new MemoryStorage(230); // the three backups below use 218
  localStorage.setItem(`${KEY}_backup_1000`, 'a'.repeat(50));
  localStorage.setItem('cpwtcv_jobs_v1_backup_2000', 'b'.repeat(50));
  localStorage.setItem(`${KEY}_backup_3000`, 'c'.repeat(50));
  setItemWithRoom(KEY, 'x'.repeat(100)); // fits once two of the three are gone
  assert.equal(localStorage.getItem(KEY), 'x'.repeat(100));
  assert.deepEqual([...localStorage.map.keys()].toSorted(), [KEY, `${KEY}_backup_3000`], 'the newest backup stays');
});

test('setItemWithRoom: with no backup left to remove, or another error, storage\'s error comes through', () => {
  globalThis.localStorage = new MemoryStorage(30);
  localStorage.setItem(`${KEY}_backup_1`, 'small');
  assert.throws(() => setItemWithRoom(KEY, 'x'.repeat(100)), { name: 'QuotaExceededError' });
  assert.equal(localStorage.getItem(`${KEY}_backup_1`), 'small', 'a save that fails anyway removes nothing (VM4-0)');

  globalThis.localStorage = new MemoryStorage();
  localStorage.setItem(`${KEY}_backup_1`, 'kept');
  localStorage.setItem = () => { throw Object.assign(new Error('denied'), { name: 'SecurityError' }); };
  assert.throws(() => setItemWithRoom(KEY, 'x'), { name: 'SecurityError' });
  assert.equal(localStorage.getItem(`${KEY}_backup_1`), 'kept', 'a backup is only removed for room');
});

test('setItemWithRoom: a save that does not fit even without the backups keeps every backup, of both lists (VM4-0)', () => {
  // Before: each backup was removed in turn, the save failed anyway, and the only copy of an
  // unreadable store — the one the notice offers under "Download the copy" — was gone for good.
  globalThis.localStorage = new MemoryStorage(1000);
  localStorage.setItem(`${KEY}_backup_1000`, 'a'.repeat(300));
  localStorage.setItem('cpwtcv_jobs_v1_backup_2000', 'b'.repeat(100));
  localStorage.setItem(KEY, 'c'.repeat(200));
  const before = new Map(localStorage.map);
  assert.throws(() => setItemWithRoom(KEY, 'x'.repeat(995)), { name: 'QuotaExceededError' });
  assert.deepEqual(new Map(localStorage.map), before, 'storage as it was: both backups, and the store saved last');
});

test('setItemWithRoom: when removing every backup is exactly enough, the save goes through', () => {
  // Guard: putting backups back only for a save that still fails must not give up one too early.
  globalThis.localStorage = new MemoryStorage(100);
  localStorage.setItem(`${KEY}_backup_1`, 'a'.repeat(20 - `${KEY}_backup_1`.length));
  localStorage.setItem('cpwtcv_jobs_v1_backup_2', 'b'.repeat(40 - 'cpwtcv_jobs_v1_backup_2'.length));
  const value = 'x'.repeat(100 - KEY.length); // the whole quota
  setItemWithRoom(KEY, value);
  assert.deepEqual([...localStorage.map], [[KEY, value]]);
});

test('backupRaw: a copy that cannot fit even without older backups keeps them all (VM4-0)', () => {
  globalThis.localStorage = new MemoryStorage(200);
  localStorage.setItem('cpwtcv_jobs_v1_backup_5', 'o'.repeat(60));
  localStorage.setItem(`${KEY}_backup_6`, 'p'.repeat(60));
  assert.equal(backupRaw(KEY, 'n'.repeat(190)), null);
  assert.equal(readBackup('cpwtcv_jobs_v1_backup_5'), 'o'.repeat(60), 'before: the job list\'s copy went too');
  assert.equal(readBackup(`${KEY}_backup_6`), 'p'.repeat(60));
});

test('backupRaw: a full storage makes room from older backups for the newest copy', () => {
  globalThis.localStorage = new MemoryStorage(120);
  localStorage.setItem('cpwtcv_jobs_v1_backup_5', 'o'.repeat(60));
  const key = backupRaw(KEY, 'n'.repeat(60));
  assert.equal(readBackup(key), 'n'.repeat(60));
  assert.equal(localStorage.getItem('cpwtcv_jobs_v1_backup_5'), null);
});
