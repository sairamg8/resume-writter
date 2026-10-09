// CYCD-SYNC review M1: a flush takes the cloud's copy for an item another device wrote since this browser saw it
// (decided by version), but the step that puts it into the list still compared clocks: a copy here stamped
// LATER than the cloud's (the other device has a slow clock) was kept as if it were an edit made after it. The
// record then claimed the cloud's version as held, and the next first sync saw this copy as changed and
// pushed the old job over the other device's edit. Now only the copy the decision was made on is replaced, by
// its updatedAt being the one decided on, not by a clock. The case: an Undo of a deletion (or a write queued for
// an unchanged job), the cloud's copy written by a slow clock.
// The real engine, plan and io over a fake Firestore two devices share. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { jobConflictCopy } from '../../src/utils/collectionSyncConflict.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const REFRESH = 10_000;
const FAST = 1000;
const SLOW = 500;

const job = (id, role, updatedAt) => ({
  id, company: 'Acme', role, status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});

function device(cloud, name, items = []) {
  let list = items;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d,
    label: (j) => [j.company, j.role].filter(Boolean).join(' — '),
    conflictCopy: jobConflictCopy,
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const record = { uid: null, versions: {}, revs: {}, device: name, order: null, stashed: {} };
  let clock = 0;
  const sync = createCollectionSync({
    name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: memoryMeta(record), report,
    timers, refreshAfter: REFRESH, now: () => clock,
  });
  return {
    sync, timers, seen,
    ids: () => list.map((x) => x.id),
    get: (id) => list.find((x) => x.id === id),
    start: async () => { sync.start(A); await settle(); },
    refresh: async () => { clock += REFRESH; sync.shown(); await settle(); },
    edit: (id, patch, updatedAt) => set(list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt } : x))),
    /** Delete, then Undo: the same job back at its place before the pause is over. */
    deleteAndUndo: (id) => { const was = list.find((x) => x.id === id); set(list.filter((x) => x.id !== id)); set([was, ...list]); },
  };
}

test('an Undo of a deletion: the cloud\'s copy, written by a slow clock, replaces the put-back copy, and the next first sync does not push it back', async () => {
  const cloud = fakeFirestore();
  const d1 = device(cloud, 'dev-a', [job('j1', 'Engineer', FAST)]);
  await d1.start();
  const d2 = device(cloud, 'dev-b');
  await d2.start();

  // Device 2, whose clock is slow, edits the job and sends it: stamped earlier than the copy it was made on.
  d2.edit('j1', { role: 'Staff Engineer' }, SLOW);
  await d2.timers.fire();
  assert.equal(cloud.doc('users/A/jobs/j1').role, 'Staff Engineer');

  // Device 1 has not read the account since; it deletes the job and undoes it, so a write of the old copy is queued.
  d1.deleteAndUndo('j1');
  await d1.timers.fire();
  assert.equal(d1.get('j1').role, 'Staff Engineer', 'the cloud\'s copy is what the list holds now, whatever it is stamped');
  assert.equal(cloud.doc('users/A/jobs/j1').role, 'Staff Engineer');

  await d1.refresh(); // a first sync
  assert.equal(cloud.doc('users/A/jobs/j1').role, 'Staff Engineer', 'the old job was not pushed over the other device\'s edit');
  assert.deepEqual(d1.ids(), ['j1'], 'and no copy was made');
  assert.equal(d1.get('j1').role, 'Staff Engineer');
});
