// H1-SYNC-3: a flush that finds another device's newer copy of a job takes it, and an edit typed here while the flush
// read the cloud stays (R5-HUNT2). But the flush then recorded the cloud's copy as seen by this browser, though the
// list held the typed edit, not that copy: the typed edit's own write (queued) was then the only change as far as
// the record could tell, and it was written over the other device's edit with no conflict copy. The other device's
// work existed nowhere. Now the record does not claim a copy the list does not hold: the queued write finds the
// cloud's copy moved and this one changed, and the older of the two is kept as a conflict copy.
// The real engine, plan and io over a fake Firestore two devices share. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { jobConflictCopy } from '../../src/utils/collectionSyncConflict.js';
import { deferred, fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };

const job = (id, role, updatedAt) => ({
  id, company: 'Acme', role, status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});

function device(cloud, items = []) {
  let list = items;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.role, conflictCopy: jobConflictCopy,
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
const jobsIn = (cloud) => [...cloud.data].filter(([p]) => p.startsWith('users/A/jobs/')).map(([, v]) => v);

test('an edit typed while a flush reads the cloud does not replace the other device\'s edit without a trace', async () => {
  const cloud = fakeFirestore();
  const d1 = device(cloud, [job('j1', 'Engineer', 1)]);
  await d1.start(A);
  const d2 = device(cloud);
  await d2.start(A);

  // Device 2 makes j1 a Lead and sends it; device 1, not read since, edits j1.
  d2.edit('j1', { role: 'Lead' }, 20);
  await d2.timers.fire();
  d1.edit('j1', { notes: '<p>first</p>' }, 10);

  // Device 1's flush waits on its read; the user types again meanwhile (the latest edit).
  const gate = deferred();
  cloud.hold.read = gate.promise;
  const flushing = d1.timers.fire();
  await settle();
  d1.edit('j1', { notes: '<p>typed during the read</p>' }, 30);
  cloud.hold.read = null;
  gate.resolve();
  await flushing;
  await settle();
  await d1.timers.fire(); // the typed edit's own write

  assert.equal(d1.get('j1').notes, '<p>typed during the read</p>');
  assert.equal(cloud.doc('users/A/jobs/j1').notes, '<p>typed during the read</p>', 'the latest edit stays');
  assert.ok(jobsIn(cloud).some((j) => j.role === 'Lead'), 'the other device\'s edit is kept as a copy');
  assert.equal(d1.seen.status, 'synced');
});
