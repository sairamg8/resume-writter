// CYCD-SYNC review M2: a batch the cloud refuses is taken apart and each item sent on its own (commitApart).
// An item's own write can fail as STALE now (the cloud's copy changed between the read and the write), and
// that was taken for a refusal "for good": the item was held back, named, and the sync stopped. Now a stale
// write is no refusal: the sync reads again and decides again, and nothing is held.
// The real engine, plan and io over a fake Firestore. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { jobConflictCopy } from '../../src/utils/collectionSyncConflict.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const job = (id, role, updatedAt) => ({
  id, company: 'Acme', role, status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});
const J2 = 'users/A/jobs/j2';

function device(cloud, name, items, { online = () => true } = {}) {
  let list = items;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => `${j.company} — ${j.role}`, conflictCopy: jobConflictCopy,
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const record = { uid: null, versions: {}, revs: {}, device: name, order: null, stashed: {} };
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: memoryMeta(record), report, online, timers });
  return {
    sync, timers, seen, list: () => list,
    start: async () => { sync.start(A); await settle(); },
    edit: (id, patch, updatedAt) => set(list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt } : x))),
  };
}

test('a stale write inside a batch taken apart is decided again, not held', async () => {
  const cloud = fakeFirestore();
  const a = device(cloud, 'dev-a', [job('j1', 'Engineer', 1), job('j2', 'Engineer', 1)]);
  await a.start();
  let online = true;
  const b = device(cloud, 'dev-b', [], { online: () => online });
  await b.start();
  online = false;
  await b.start();
  b.edit('j1', { role: 'Role of b1' }, 30);
  b.edit('j2', { role: 'Role of b2' }, 31);

  // The cloud refuses a write of two jobs (so the first sync takes it apart); the other device's edit of j2 lands
  // while the single write of j2 is being checked (the second read of j2: the first was the two-job write's).
  cloud.refuse = (ops) => (ops.filter(([op, path]) => op === 'set' && path.includes('/jobs/')).length > 1
    ? Object.assign(new Error('Request payload size exceeds the limit.'), { code: 'invalid-argument' }) : null);
  let reads = 0;
  cloud.afterRead = (path) => {
    if (path !== J2) return;
    reads += 1;
    if (reads === 2) cloud.data.set(J2, { ...job('j2', 'Role of a', 25), syncRev: 2, syncBy: 'dev-a' });
  };
  online = true;
  await b.start();

  assert.deepEqual(b.seen.held, [], 'nothing is held: the write was not refused, the copy had changed');
  assert.equal(b.seen.status, 'synced');
  const roles = [...cloud.data.keys()].filter((p) => p.startsWith('users/A/jobs/')).map((p) => cloud.doc(p).role).toSorted();
  assert.deepEqual(roles, ['Role of a', 'Role of b1', 'Role of b2'], 'both edits of j2 are in the account: the job and a conflict copy');
  assert.equal(cloud.doc(J2).role, 'Role of b2');
});
