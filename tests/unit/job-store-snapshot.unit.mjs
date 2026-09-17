// Unit tests for NB-6: useJobStore getSnapshot (snapshot()) purity.
// Calling snapshot() must perform no setItem and add no window listener during render;
// side effects (repair, persist, event listener registration) occur on subscribe.
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { snapshot, subscribe, _resetJobStoreForTest } from '../../src/hooks/useJobStore.js';
import { _resetUnpersistedNotices } from '../../src/utils/storageBackup.js';

const KEY = 'cpwtcv_jobs_v1';

class TrackedStorage {
  constructor() {
    this.map = new Map();
    this.setCalls = [];
  }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) {
    this.setCalls.push([k, String(v)]);
    this.map.set(k, String(v));
  }
  removeItem(k) { this.map.delete(k); }
}

let storage;
let addedListeners = [];
let removedListeners = [];
const originalWindow = globalThis.window;

beforeEach(() => {
  storage = new TrackedStorage();
  globalThis.localStorage = storage;
  addedListeners = [];
  removedListeners = [];
  globalThis.window = {
    addEventListener: (type, fn) => { addedListeners.push({ type, fn }); },
    removeEventListener: (type, fn) => { removedListeners.push({ type, fn }); },
  };
  _resetJobStoreForTest();
  _resetUnpersistedNotices();
});

afterEach(() => {
  if (originalWindow) globalThis.window = originalWindow;
  else delete globalThis.window;
  delete globalThis.localStorage;
  _resetJobStoreForTest();
});

test('NB-6: snapshot() is pure: calling snapshot() on corrupt storage performs no setItem and adds no listener', () => {
  const corrupt = '{ corrupt data not json';
  storage.setItem(KEY, corrupt);
  storage.setCalls.length = 0; // reset tracking

  // Calling snapshot() (which React calls during render via useSyncExternalStore)
  const snap = snapshot();
  assert.ok(snap, 'snapshot returns initial state');
  assert.deepEqual(snap.jobs, [], 'corrupt data returns empty jobs list in render');
  assert.equal(storage.setCalls.length, 0, 'snapshot() must NOT perform any setItem calls during render');
  assert.equal(addedListeners.length, 0, 'snapshot() must NOT add any window listener during render');

  // After subscribe, repair happens: backup is saved, list is persisted, listener is added
  let notified = false;
  const unsubscribe = subscribe(() => { notified = true; });
  assert.equal(notified, true, 'subscriber was notified upon init');

  assert.ok(storage.setCalls.length > 0, 'subscribe() performs repair and persistence');
  assert.equal(addedListeners.length, 1, 'subscribe() registers storage listener');
  assert.equal(addedListeners[0].type, 'storage');

  const afterSnap = snapshot();
  assert.ok(afterSnap.recovery?.backupKey, 'recovery notice is available after subscribe');
  const backupVal = storage.getItem(afterSnap.recovery.backupKey);
  assert.equal(backupVal, corrupt, 'corrupt backup exists on disk');

  // Unsubscribe cleans up listener
  unsubscribe();
  assert.equal(removedListeners.length, 1, 'unsubscribe cleans up window listener');
});

test('NB-6: snapshot() with valid stored data reads jobs purely without setItem or listener', () => {
  const jobs = [{ id: 'job_test_1', company: 'Acme Corp', role: 'Engineer', status: 'applied', todos: [] }];
  storage.setItem(KEY, JSON.stringify({ dataVersion: 2, jobs }));
  storage.setCalls.length = 0;

  const snap = snapshot();
  assert.equal(snap.jobs.length, 1);
  assert.equal(snap.jobs[0].company, 'Acme Corp');
  assert.equal(snap.recovery, null);
  assert.equal(storage.setCalls.length, 0, 'snapshot() must NOT perform any setItem calls');
  assert.equal(addedListeners.length, 0, 'snapshot() must NOT register window listeners');

  const unsubscribe = subscribe(() => {});
  assert.equal(addedListeners.length, 1, 'subscribe() registers listener');
  unsubscribe();
  assert.equal(removedListeners.length, 1, 'unsubscribe cleans up listener');
});

