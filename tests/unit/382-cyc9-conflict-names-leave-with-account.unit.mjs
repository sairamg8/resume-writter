// CYC9-H3: the names the conflict notice shows (syncConflicts) are module state of each tab, and
// only the tab that ran leave() cleared them. Another tab, finding the list already taken off the
// browser (its record no longer names the account), left the last account's job and project names
// for the next account to sign in there to be shown. Now the engine forgets them whenever its
// account changes, in any tab, as it does the held items; and a name reported twice is kept once.
// The real engine and store (collectionReport) over a fake Firestore. Run: yarn test:unit
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { collectionReport, memoryMeta, syncConflicts } from '../../src/utils/collectionSyncMeta.js';
import { jobConflictCopy } from '../../src/utils/collectionSyncConflict.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const B = { uid: 'B', email: 'b@example.com' };
const job = (id, company, role, updatedAt) => ({
  id, company, role, status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});
const clear = () => { syncConflicts.dismiss('jobs'); syncConflicts.dismiss('boards'); };
beforeEach(clear);
afterEach(clear);

/**
 * A tab signed in as A whose first sync found a conflict on j1 (edited here at t=30 and in the
 * account at t=20 since both saw t=1): its engine reports to the real store, like the app's.
 */
async function tabWithConflict() {
  const cloud = fakeFirestore({
    'users/A/jobs/j1': job('j1', 'Acme', 'Lead Engineer', 20),
    'users/A/meta/jobs': { order: ['j1'], deleted: [] },
  });
  let list = [job('j1', 'Acme', 'Staff Engineer', 30)];
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => [j.company, j.role].filter(Boolean).join(' — '),
    conflictCopy: jobConflictCopy,
  };
  const { report } = recorder();
  report.conflict = collectionReport('jobs').conflict;
  const meta = memoryMeta({ uid: 'A', versions: { j1: 1 }, order: ['j1'], stashed: {} });
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta, report, timers: manualTimers() });
  sync.start(A);
  await settle(10);
  assert.deepEqual(syncConflicts.get().jobs, ['Acme — Staff Engineer'], 'the conflict is shown');
  return {
    sync,
    /** Another tab signed out: it took the list off the browser and wrote the record empty. */
    otherTabLeft() {
      meta.write({ uid: null, versions: {}, order: null, stashed: {} });
      set([]);
    },
  };
}

test('a name reported twice is kept once, and each list has its own', () => {
  collectionReport('jobs').conflict(['Acme — Staff Engineer']);
  collectionReport('jobs').conflict(['Acme — Staff Engineer', 'Globex — Analyst']);
  collectionReport('jobs').conflict(['Globex — Analyst', 'Globex — Analyst']);
  collectionReport('boards').conflict(['Roadmap']);
  assert.deepEqual(syncConflicts.get().jobs, ['Acme — Staff Engineer', 'Globex — Analyst']);
  assert.deepEqual(syncConflicts.get().boards, ['Roadmap']);
});

test('another tab left with the list: signing out here still forgets the names', async () => {
  const tab = await tabWithConflict();
  tab.otherTabLeft(); // leave() will find the list is no longer this account\'s
  tab.sync.start(null);
  await settle();
  assert.deepEqual(syncConflicts.get().jobs, [], 'the next account is not shown the last one\'s job names');
});

test('another tab left with the list: the next account signing in here is not shown the names', async () => {
  const tab = await tabWithConflict();
  tab.otherTabLeft();
  tab.sync.start(B);
  await settle(10);
  assert.deepEqual(syncConflicts.get().jobs, []);
});

test('the same account syncing again keeps the names until they are dismissed', async () => {
  const tab = await tabWithConflict();
  tab.sync.start(A);
  await settle(10);
  assert.deepEqual(syncConflicts.get().jobs, ['Acme — Staff Engineer']);
  tab.sync.start(null);
  await settle();
  assert.deepEqual(syncConflicts.get().jobs, [], 'the sign-out clears them');
});
