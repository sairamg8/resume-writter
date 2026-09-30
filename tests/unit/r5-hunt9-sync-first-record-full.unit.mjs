// R5-HUNT9-SYNC-FIRST-SYNC-RECORD-WRITE-DROPPED: a job or project list's first sync ends by writing
// its sync record (collectionSyncMeta.js), which names the account the list now belongs to. When
// storage refused it (full — the list saves through setItemWithRoom, the record through plain
// setItem), the refusal was ignored: the account's jobs were taken into the list and the icon said
// "synced", but every later guard read the record, found it no account's, and stopped the sync —
// a deletion was never sent and came back at the next first sync, and at sign-out the account's
// list stayed in the browser, where the next account to sign in uploaded it. Now a first sync whose
// record storage refuses is not done: the list is left as it was, the sync says it will try again,
// and the retry that gets through finishes it.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { JOBS_SYNC_KEY, localMeta } from '../../src/utils/collectionSyncMeta.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const B = { uid: 'B', email: 'b@example.com' };
const LIST_KEY = 'cpwtcv_jobs_v1';

const job = (id, company, updatedAt = 1) => ({
  id, company, role: 'Engineer', status: 'applied', todos: [], statusHistory: [], createdAt: 1, updatedAt,
});
const jobPath = (uid, id) => `users/${uid}/jobs/${id}`;
const quota = () => Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError', code: 22 });

/** localStorage as a Map; `full` true refuses every write of the sync record. */
function storage() {
  const map = new Map();
  return {
    map,
    full: false,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem(k, v) {
      if (this.full && k === JOBS_SYNC_KEY) throw quota();
      map.set(k, String(v));
    },
    removeItem: (k) => { map.delete(k); },
  };
}

/** A page: the job list saved in `space` under LIST_KEY, its sync record next to it, the engine over `cloud`. */
function page(cloud, space) {
  const listeners = new Set();
  let list = JSON.parse(space.getItem(LIST_KEY) ?? '[]');
  const store = {
    items: () => list,
    replace(next) {
      list = next;
      try { space.setItem(LIST_KEY, JSON.stringify(next)); } catch { /* kept in memory */ }
      listeners.forEach((l) => l());
    },
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d,
    label: (j) => j.company,
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const sync = createCollectionSync({
    name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: localMeta(JOBS_SYNC_KEY, () => space), report, timers,
  });
  return {
    sync, timers, seen,
    ids: () => list.map((j) => j.id).toSorted(),
    remove: (id) => store.replace(list.filter((j) => j.id !== id)),
    start: async (user) => { sync.start(user); await settle(); },
  };
}

const cloudIds = (cloud, uid) => [...cloud.data.keys()].filter((p) => p.startsWith(`users/${uid}/jobs/`)).map((p) => p.split('/').at(-1)).toSorted();

test('a first sync whose record storage refuses is not "synced": the account\'s jobs stay out of the list, and the retry finishes it', async () => {
  const cloud = fakeFirestore({ [jobPath('A', 'j1')]: job('j1', 'Acme', 2), [jobPath('A', 'j2')]: job('j2', 'Beta', 3) });
  const space = storage();
  space.full = true;
  const p = page(cloud, space);
  await p.start(A);

  assert.notEqual(p.seen.status, 'synced', 'the record naming the account was not written: the sync is not done');
  assert.equal(p.seen.status, 'error', 'it says it will try again');
  assert.deepEqual(p.ids(), [], 'the account\'s jobs are not taken into a list no account owns');

  // Room again: the retry finishes the first sync, and a deletion then reaches the account.
  space.full = false;
  await p.timers.fire();
  assert.equal(p.seen.status, 'synced');
  assert.deepEqual(p.ids(), ['j1', 'j2']);
  assert.equal(JSON.parse(space.getItem(JOBS_SYNC_KEY)).uid, 'A');
  p.remove('j1');
  await p.timers.fire();
  assert.deepEqual(cloudIds(cloud, 'A'), ['j2'], 'the deletion is sent');

  await p.start(null);
  assert.deepEqual(p.ids(), [], 'the account\'s list leaves the browser at sign-out');
});

test('storage full through sign-out: none of the account\'s jobs is left behind for the next account to upload', async () => {
  const cloud = fakeFirestore({ [jobPath('A', 'j1')]: job('j1', 'Acme', 2), [jobPath('B', 'b1')]: job('b1', 'Bolt', 4) });
  const space = storage();
  space.full = true;
  const p = page(cloud, space);
  await p.start(A);
  await p.start(null);
  assert.deepEqual(p.ids(), [], 'no job of A\'s is left in the signed-out browser');

  space.full = false;
  await p.start(B);
  assert.equal(p.seen.status, 'synced');
  assert.deepEqual(cloudIds(cloud, 'B'), ['b1'], 'none of A\'s jobs reaches B\'s account');
  assert.deepEqual(p.ids(), ['b1']);
});
