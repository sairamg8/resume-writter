// Unit tests for reading the saved lists without losing what cannot be read
// (src/utils/storageBackup.js), against an in-memory localStorage. Run: yarn test:unit
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadSavedList, pendingRecovery, rememberRecovery } from '../../src/utils/storageBackup.js';

/** A localStorage stand-in: the Storage methods the app uses. */
class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
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

test('pendingRecovery / rememberRecovery: the notice is kept per list until dismissed', () => {
  rememberRecovery(KEY, { backupKey: `${KEY}_backup_1` });
  assert.deepEqual(pendingRecovery(KEY), { backupKey: `${KEY}_backup_1` });
  assert.equal(pendingRecovery('cpwtcv_jobs_v1'), null, 'another list has its own');
  rememberRecovery(KEY, null);
  assert.equal(pendingRecovery(KEY), null);
  localStorage.setItem(`${KEY}_recovery`, '{ not json');
  assert.equal(pendingRecovery(KEY), null);
});
