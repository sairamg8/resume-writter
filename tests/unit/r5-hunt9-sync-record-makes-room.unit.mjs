// R5-HUNT9 review of R5-HUNT9-SYNC-FIRST-SYNC-RECORD-WRITE-DROPPED: a first sync whose sync record
// (collectionSyncMeta.js) storage refuses now waits and is retried, instead of saying "synced".
// But the record was written with a plain setItem, while the list itself saves through
// setItemWithRoom, which drops the page pictures' cache and then the backups to make room. So when
// only that cache filled storage (it is written until nothing more fits), the record was refused
// at every retry: the account's jobs never reached this browser and the icon stayed on 'error',
// though dropping a cache would have made room. Now the record makes room as the list does; one
// that does not fit even then is still refused, and the backups it removed are put back.
// Run: yarn test:unit
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { JOBS_SYNC_KEY, localMeta } from '../../src/utils/collectionSyncMeta.js';
import { PAGE_IMAGES_KEY, _resetUnpersistedNotices } from '../../src/utils/storageBackup.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const LIST_KEY = 'cpwtcv_jobs_v1';
const BACKUP_KEY = `${LIST_KEY}_backup_1`;

/** A localStorage stand-in with a quota in characters, as tests/unit/storage-backup.unit.mjs has. */
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

const QUOTA = 4000;
const used = () => [...globalThis.localStorage.map].reduce((n, [k, v]) => n + k.length + v.length, 0);
/** Storage filled to the last character by `key` (the page pictures' cache, or a backup). */
const fillWith = (key) => globalThis.localStorage.setItem(key, 'x'.repeat(QUOTA - used() - key.length));

beforeEach(() => { globalThis.localStorage = new MemoryStorage(QUOTA); _resetUnpersistedNotices(); });

const job = (id, company, updatedAt = 1) => ({
  id, company, role: 'Engineer', status: 'applied', todos: [], statusHistory: [], createdAt: 1, updatedAt,
});
const jobPath = (uid, id) => `users/${uid}/jobs/${id}`;

/** A page as the app wires it: the list and its sync record both in the browser's localStorage. */
function page(cloud) {
  const listeners = new Set();
  let list = [];
  const store = {
    items: () => list,
    replace(next) {
      list = next;
      try { localStorage.setItem(LIST_KEY, JSON.stringify(next)); } catch { /* kept in memory */ }
      listeners.forEach((l) => l());
    },
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d,
    label: (j) => j.company,
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const sync = createCollectionSync({
    name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: localMeta(JOBS_SYNC_KEY), report, timers,
  });
  return {
    seen, timers,
    ids: () => list.map((j) => j.id).toSorted(),
    record: () => JSON.parse(localStorage.getItem(JOBS_SYNC_KEY) ?? 'null'),
    start: async (user) => { sync.start(user); await settle(); },
  };
}

test('storage filled by the page pictures\' cache: the first sync drops the cache for its record, and the account\'s jobs arrive', async () => {
  const cloud = fakeFirestore({ [jobPath('A', 'j1')]: job('j1', 'Acme', 2), [jobPath('A', 'j2')]: job('j2', 'Beta', 3) });
  fillWith(PAGE_IMAGES_KEY);
  const p = page(cloud);
  await p.start(A);

  assert.equal(p.seen.status, 'synced', 'a cache filling storage does not keep the sync waiting');
  assert.deepEqual(p.ids(), ['j1', 'j2'], 'the account\'s jobs are in the list');
  assert.equal(p.record().uid, 'A', 'the record names the account');
  assert.equal(localStorage.getItem(PAGE_IMAGES_KEY), null, 'the cache made room (it is painted again)');

  await p.start(null);
  assert.deepEqual(p.ids(), [], 'at sign-out the account\'s list leaves the browser');
});

test('storage filled by a backup: the backup makes room for the record, as it does for the list', async () => {
  const cloud = fakeFirestore({ [jobPath('A', 'j1')]: job('j1', 'Acme', 2) });
  fillWith(BACKUP_KEY);
  const p = page(cloud);
  await p.start(A);

  assert.equal(p.seen.status, 'synced');
  assert.deepEqual(p.ids(), ['j1']);
  assert.equal(p.record().uid, 'A');
  assert.equal(localStorage.getItem(BACKUP_KEY), null);
});

test('a record that does not fit even without the cache and backups is still refused: the sync waits, and the backup is put back', async () => {
  const cloud = fakeFirestore({ [jobPath('A', 'j1')]: job('j1', 'Acme', 2) });
  localStorage.setItem(BACKUP_KEY, 'b'.repeat(20));
  localStorage.setItem('cpwtcv_v1', 'r'.repeat(QUOTA - used() - 'cpwtcv_v1'.length)); // the résumés: work, never dropped
  const p = page(cloud);
  await p.start(A);

  assert.equal(p.seen.status, 'error', 'it says it will try again (R5-HUNT9-SYNC-FIRST-SYNC-RECORD-WRITE-DROPPED)');
  assert.deepEqual(p.ids(), []);
  assert.equal(p.record(), null);
  assert.equal(localStorage.getItem(BACKUP_KEY), 'b'.repeat(20), 'the backup removed for a write that still failed is back');
});
