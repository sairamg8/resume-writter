// R5-HUNT7-SYNC-LEAVE-META-WRITE-DROPPED: a job or project list leaving this browser (sign-out,
// or another account signing in) is set aside in its sync record (collectionSyncMeta.js), what
// its cloud lacks kept for that account's next sign-in. When storage would not take that record
// (full — the list itself saves through setItemWithRoom, the record through plain setItem), the
// write was dropped and the list cleared anyway: the unsent job was stored nowhere, and the old
// record left behind still listed the account's jobs, so the next sign-in took every one for
// deleted here and deleted them from the account — on every device. Now the list goes first to
// make room; when the record is still refused, the list stays, still that account's: its next
// sign-in sends what it holds, and another account's first sync waits rather than taking it in.
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

/**
 * localStorage as a Map. `refuse(key, value, map)` → true throws QuotaExceededError for that write
 * instead of storing it.
 */
function storage(refuse = () => false) {
  const map = new Map();
  return {
    map,
    refuse,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem(k, v) {
      if (this.refuse(k, String(v), map)) throw quota();
      map.set(k, String(v));
    },
    removeItem: (k) => { map.delete(k); },
  };
}

/** A page: the job list saved in `store`age under LIST_KEY, its sync record next to it, the engine over `cloud`. */
function page(cloud, space, { online = () => true } = {}) {
  const listeners = new Set();
  const items = () => JSON.parse(space.getItem(LIST_KEY) ?? '[]');
  let list = items();
  const store = {
    items: () => list,
    replace(next) {
      list = next;
      // As the job store: a list storage refuses stays in memory (the tab says it is not saved).
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
    name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: localMeta(JOBS_SYNC_KEY, () => space),
    report, online, timers,
  });
  return {
    sync, timers, seen,
    ids: () => list.map((j) => j.id).toSorted(),
    saved: () => items().map((j) => j.id).toSorted(),
    record: () => JSON.parse(space.getItem(JOBS_SYNC_KEY)),
    add: (j) => store.replace([...list, j]),
    start: async (user) => { sync.start(user); await settle(); },
  };
}

const cloudIds = (cloud, uid) => [...cloud.data.keys()].filter((p) => p.startsWith(`users/${uid}/jobs/`)).map((p) => p.split('/').at(-1)).toSorted();

test('a sync record storage will not grow: the signed-out list stays, and the next sign-in sends it without deleting the account\'s jobs', async () => {
  const cloud = fakeFirestore({ [jobPath('A', 'j1')]: job('j1', 'Acme', 2), [jobPath('A', 'j2')]: job('j2', 'Beta', 3) });
  // Full: the record cannot grow (the list itself saves, as setItemWithRoom makes room for it).
  const space = storage((k, v, map) => k === JOBS_SYNC_KEY && map.has(k) && v.length > map.get(k).length);
  let online = true;
  const p = page(cloud, space, { online: () => online });
  await p.start(A);
  assert.equal(p.seen.status, 'synced');
  assert.deepEqual(p.ids(), ['j1', 'j2']);
  assert.deepEqual(Object.keys(p.record().versions).toSorted(), ['j1', 'j2']);

  // Offline, a job is added; then the account signs out before it is sent.
  online = false;
  await p.start(A);
  p.add(job('j3', 'Cyan', 10));
  await p.start(null);

  assert.deepEqual(p.ids(), ['j1', 'j2', 'j3'], 'the list could not be set aside: it stays, with the unsent job');
  assert.deepEqual(p.saved(), ['j1', 'j2', 'j3'], 'and so does its saved copy');
  assert.equal(p.record().uid, 'A', 'still the account\'s');

  online = true;
  await p.start(A);
  assert.equal(p.seen.status, 'synced');
  assert.deepEqual(cloudIds(cloud, 'A'), ['j1', 'j2', 'j3'], 'the account keeps its jobs, and gets the unsent one');
  assert.deepEqual(cloud.doc('users/A/meta/jobs').deleted ?? [], [], 'nothing is listed as deleted');
  assert.deepEqual(p.ids(), ['j1', 'j2', 'j3']);
});

test('storage full: the list goes first to make room, and the unsent job kept aside reaches the account at its next sign-in', async () => {
  const cloud = fakeFirestore({ [jobPath('A', 'j1')]: job('j1', 'Acme', 2), [jobPath('A', 'j2')]: job('j2', 'Beta', 3) });
  let limit = Infinity;
  const used = (map, k, v) => [...map].reduce((n, [key, val]) => n + (key === k ? 0 : val.length), 0) + v.length;
  const space = storage((k, v, map) => used(map, k, v) > limit);
  let online = true;
  const p = page(cloud, space, { online: () => online });
  await p.start(A);

  online = false;
  await p.start(A);
  p.add(job('j3', 'Cyan', 10));
  // Storage is now all but full: the record with j3 kept aside fits only once the list is gone.
  limit = used(space.map, '', '') + 20;
  await p.start(null);

  assert.deepEqual(p.ids(), [], 'the list leaves this browser');
  assert.deepEqual(p.saved(), []);
  const record = p.record();
  assert.equal(record.uid, null);
  assert.deepEqual(record.stashed.A.items.map((j) => j.id), ['j3'], 'the unsent job is kept aside for the account');

  online = true;
  limit = Infinity;
  await p.start(A);
  assert.deepEqual(cloudIds(cloud, 'A'), ['j1', 'j2', 'j3'], 'nothing deleted from the account, and the unsent job sent');
  assert.deepEqual(p.ids(), ['j1', 'j2', 'j3']);
});

test('another account signing in while the last one\'s list cannot be set aside: its first sync waits, and takes none of it', async () => {
  const cloud = fakeFirestore({
    [jobPath('A', 'j1')]: job('j1', 'Acme', 2), [jobPath('A', 'j2')]: job('j2', 'Beta', 3), [jobPath('B', 'b1')]: job('b1', 'Bolt', 4),
  });
  const full = (k, v, map) => k === JOBS_SYNC_KEY && map.has(k) && v.length > map.get(k).length;
  const space = storage(full);
  let online = true;
  const p = page(cloud, space, { online: () => online });
  await p.start(A);
  online = false;
  await p.start(A);
  p.add(job('j3', 'Cyan', 10));
  await p.start(null);
  online = true;

  await p.start(B);
  assert.deepEqual(cloudIds(cloud, 'B'), ['b1'], 'none of A\'s jobs reaches B\'s account');
  assert.deepEqual(cloudIds(cloud, 'A'), ['j1', 'j2'], 'nor is any deleted from A\'s');
  assert.deepEqual(p.ids(), ['j1', 'j2', 'j3'], 'A\'s list, with its unsent job, is still here');
  assert.equal(p.seen.status, 'error', 'the sync says it will try again');

  // Room again: the retry sets A's list aside and B's first sync goes ahead.
  space.refuse = () => false;
  await p.timers.fire();
  assert.equal(p.seen.status, 'synced');
  assert.deepEqual(p.ids(), ['b1']);
  assert.deepEqual(cloudIds(cloud, 'B'), ['b1']);
  assert.deepEqual(p.record().stashed.A.items.map((j) => j.id), ['j3']);

  await p.start(A);
  assert.deepEqual(cloudIds(cloud, 'A'), ['j1', 'j2', 'j3']);
});
