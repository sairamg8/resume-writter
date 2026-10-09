// H1-SYNC-14: the first sync takes the cloud's newer copy of a job it finds unchanged here and, as the flush does
// (402), keeps an edit typed meanwhile — an edit made on the copy BEFORE the cloud's, which this browser has not seen. It
// then recorded the cloud's copy as seen by this browser, so the edit's own write was the only change as far as the record
// could tell and went over the other device's edit with no conflict copy (whichever clock stamped the edit): the
// other device's work existed nowhere. Now the record keeps what it had for such a job, and the edit's write finds the cloud's
// copy moved and this one changed: the older of the two is kept as a conflict copy. Found by the three-device
// script with jittered server calls (410).
// The real engine, plan and io over a fake Firestore two devices share. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { jobConflictCopy } from '../../src/utils/collectionSyncConflict.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { deferred, fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };

const job = (id, notes, updatedAt) => ({
  id, company: 'Acme', role: 'Engineer', status: 'applied', todos: [], notes,
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});

function device(cloud, items = []) {
  let list = items;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.company, conflictCopy: jobConflictCopy,
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers });
  return {
    timers, seen,
    get: (id) => list.find((x) => x.id === id),
    start: async (user) => { sync.start(user); await settle(); },
    edit: (id, patch, updatedAt) => set(list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt } : x))),
  };
}
const notesInCloud = (cloud) => [...cloud.data].filter(([p]) => p.startsWith('users/A/jobs/')).map(([, v]) => v.notes).toSorted();

async function editedWhileFirstSyncReads(editAt) {
  const cloud = fakeFirestore();
  const d1 = device(cloud, [job('j1', '[1]', 100)]);
  await d1.start(A);
  const d2 = device(cloud);
  await d2.start(A);
  d2.edit('j1', { notes: '[1] [3]' }, 2000);
  await d2.timers.fire();
  assert.equal(cloud.doc('users/A/jobs/j1').notes, '[1] [3]');

  // Device 1 is shown again: its first sync reads the account, and the user types in j1 meanwhile.
  const gate = deferred();
  cloud.hold.read = gate.promise;
  const starting = d1.start(A);
  await settle();
  d1.edit('j1', { notes: '[1] [5]' }, editAt);
  cloud.hold.read = null;
  gate.resolve();
  await starting;
  await settle();
  await d1.timers.fire(); // the edit's own write
  return { cloud, d1 };
}

test('an edit typed while the first sync reads, stamped before the cloud\'s copy: both are kept', async () => {
  const { cloud, d1 } = await editedWhileFirstSyncReads(1500);
  assert.deepEqual(notesInCloud(cloud), ['[1] [3]', '[1] [5]'], 'the other device\'s edit and this one');
  assert.equal(cloud.doc('users/A/jobs/j1').notes, '[1] [3]', 'the later of the two stays the job');
  assert.equal(d1.seen.status, 'synced');
});

test('an edit typed while the first sync reads, stamped after the cloud\'s copy: both are kept', async () => {
  const { cloud } = await editedWhileFirstSyncReads(2500);
  assert.deepEqual(notesInCloud(cloud), ['[1] [3]', '[1] [5]']);
  assert.equal(cloud.doc('users/A/jobs/j1').notes, '[1] [5]');
});
