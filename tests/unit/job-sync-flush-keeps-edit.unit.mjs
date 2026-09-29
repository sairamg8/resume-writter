// R5-HUNT2-COLLECTION-FLUSH-NEWER-OVERWRITES-CONCURRENT-LOCAL-EDIT: a flush that finds another
// device's newer copy of a job it sends takes that copy here (per-item last-writer-wins) — but an
// edit typed here while the flush read the cloud is newer still, and stays. The flush used to
// swap every job it found newer in the cloud into the list without looking at the list's own copy:
// the edit vanished from this device while its queued write still reached the cloud, and a later
// edit on top of what was shown overwrote it for good.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { completeJob, readJob } from '../../src/utils/normalizeJob.js';
import { deferred, fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };

const job = (id, company, updatedAt = 1) => ({
  id, company, role: 'Engineer', status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});
const jobPath = (uid, id) => `users/${uid}/jobs/${id}`;

const fromCloud = (d) => { const { kept } = readJob(d); return kept ? completeJob(kept) : null; };
const label = (j) => j.company || 'Untitled job';

function device(cloud, jobs = []) {
  let list = jobs;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = { items: () => list, replace: set, subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }, fromCloud, label };
  const timers = manualTimers();
  const { report } = recorder();
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers });
  return {
    timers,
    job: (id) => list.find((j) => j.id === id),
    start: async (user) => { sync.start(user); await settle(); },
    edit: (id, patch, updatedAt) => set(list.map((j) => (j.id === id ? { ...j, ...patch, updatedAt } : j))),
  };
}

test('an edit typed while a flush reads the cloud stays, though the flush found another device\'s newer copy', async () => {
  const cloud = fakeFirestore();
  const d1 = device(cloud, [job('j1', 'Acme')]);
  await d1.start(A);
  const d2 = device(cloud, []);
  await d2.start(A);

  // Device 2 changes j1 (T2) and sends it; device 1, not read since, edits j1 (T1 < T2).
  d2.edit('j1', { role: 'Lead' }, 20);
  await d2.timers.fire();
  d1.edit('j1', { notes: '<p>first</p>' }, 10);

  // Device 1's flush waits on its read of the cloud; the user types again meanwhile (T3 > T2).
  const gate = deferred();
  cloud.hold.read = gate.promise;
  const flushing = d1.timers.fire();
  await settle();
  d1.edit('j1', { notes: '<p>typed during the read</p>' }, 30);
  cloud.hold.read = null;
  gate.resolve();
  await flushing;
  await settle();
  assert.equal(d1.job('j1').notes, '<p>typed during the read</p>', 'the edit typed during the read is still here');
  assert.equal(d1.job('j1').updatedAt, 30);

  // Its own write goes next, and the cloud agrees with this device.
  await d1.timers.fire();
  assert.equal(d1.job('j1').notes, '<p>typed during the read</p>');
  assert.equal(cloud.doc(jobPath('A', 'j1')).notes, '<p>typed during the read</p>');
});

test('with no edit during the read, the flush still takes the other device\'s newer copy', async () => {
  const cloud = fakeFirestore();
  const d1 = device(cloud, [job('j1', 'Acme')]);
  await d1.start(A);
  const d2 = device(cloud, []);
  await d2.start(A);
  d2.edit('j1', { role: 'Lead' }, 20);
  await d2.timers.fire();
  d1.edit('j1', { notes: '<p>older</p>' }, 10);
  await d1.timers.fire();
  assert.equal(d1.job('j1').role, 'Lead');
  assert.equal(d1.job('j1').updatedAt, 20);
  assert.equal(cloud.doc(jobPath('A', 'j1')).role, 'Lead');
});
