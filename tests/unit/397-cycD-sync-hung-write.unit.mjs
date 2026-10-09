// CYCD-SYNC review M3: a flush now waits for its write to land before the next flush reads (so each reads what the one
// before wrote). A write that never settles — a cache with no server to answer it — held every later flush
// behind it for good, whatever account was signed in. Now a start (another account, a retry, going online)
// begins a new line of flushes, and a flush waiting behind one that does not land gives up at the deadline
// and is tried later like any failure.
// The real engine, plan and io over a fake Firestore. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const B = { uid: 'B', email: 'b@example.com' };
const job = (id, role, updatedAt) => ({
  id, company: 'Acme', role, status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});

function device(cloud, items) {
  let list = items;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.role,
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers });
  return {
    sync, timers, seen,
    start: async (user) => { sync.start(user); await settle(); },
    edit: (id, patch, updatedAt) => set(list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt } : x))),
    add: (j) => set([...list, j]),
  };
}

test('an account change while a write never settles: the new account\'s flush goes through', async () => {
  const cloud = fakeFirestore();
  const d = device(cloud, [job('a1', 'Engineer', 1)]);
  await d.start(A);

  cloud.hold.commit = new Promise(() => {}); // the answer never comes
  d.edit('a1', { role: 'Staff Engineer' }, 5);
  await d.timers.fire(); // account A's flush: its write is on the way, never acknowledged
  cloud.hold.commit = null;

  await d.start(null);
  await d.start(B);
  d.add(job('b1', 'Designer', 10));
  await d.timers.fire(); // account B's flush

  assert.equal(cloud.doc('users/B/jobs/b1')?.role, 'Designer', 'reached account B');
  assert.equal(d.seen.status, 'synced');
});

test('a flush behind one that never lands gives up at the deadline and is tried later', async () => {
  const cloud = fakeFirestore();
  const d = device(cloud, [job('a1', 'Engineer', 1)]);
  await d.start(A);

  cloud.hold.commit = new Promise(() => {});
  d.edit('a1', { role: 'Staff Engineer' }, 5);
  await d.timers.fire(); // the first flush, never acknowledged
  cloud.hold.commit = null;
  d.edit('a1', { role: 'Principal Engineer' }, 6);
  await d.timers.fire(); // the second waits behind it
  await d.timers.fire(); // its deadline passes
  assert.equal(d.seen.status, 'error', 'it says it will retry');

  await d.timers.fire(); // the retry: a first sync, a new line
  assert.equal(d.seen.status, 'synced');
  assert.equal(cloud.doc('users/A/jobs/a1').role, 'Principal Engineer');
});
