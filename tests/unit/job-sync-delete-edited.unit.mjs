// A deletion sent after the first sync, checked against the cloud (R2-140): the list engine
// (collectionSyncEngine.js) with its Firestore calls (collectionSyncIo.js) over one fake Firestore
// two "devices" share. A first sync already lets an edit win over a deletion it never saw
// (collectionSyncPlan.planFirstSync, R2-029), but a flush deleted what it was told to without
// looking: device 2 edits a job and sends it, device 1 — which has not read the account since —
// deletes the job, and device 2's edit was gone from the account and, at its next read, from
// device 2 too. Now the flush reads the cloud's copy of each item it deletes, as it already did of
// each item it writes: one changed later than the copy deleted here stays in the account and comes
// back on this device, and a deletion made after seeing the edit goes through.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { completeJob, readJob } from '../../src/utils/normalizeJob.js';
import { deferred, fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const REFRESH = 10_000;

const job = (id, company, updatedAt = 1) => ({
  id, company, role: 'Engineer', status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});
const jobPath = (uid, id) => `users/${uid}/jobs/${id}`;
const metaPath = (uid) => `users/${uid}/meta/jobs`;
const deletedIn = (cloud, uid) => cloud.doc(metaPath(uid))?.deleted ?? [];
/** The job ids every commit since `from` wrote (set). */
const writtenSince = (cloud, from) => cloud.commits.slice(from).flat()
  .filter(([op, path]) => op === 'set' && path.includes('/jobs/')).map(([, path]) => path.split('/').at(-1));

/** A cloud copy as the job store loads one (jobSync in useCollectionSync.js). */
const fromCloud = (d) => { const { kept } = readJob(d); return kept ? completeJob(kept) : null; };
const label = (j) => [j.company, j.role].filter(Boolean).join(' — ') || 'Untitled job';

/** A device, as in job-sync.unit.mjs: its own job list in memory, sync record, timers and clock. */
function device(cloud, jobs = []) {
  let list = jobs;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list,
    replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud, label,
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const meta = memoryMeta();
  let clock = 0;
  const sync = createCollectionSync({
    name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta, report,
    timers, refreshAfter: REFRESH, now: () => clock,
  });
  return {
    sync, timers, seen, meta,
    job: (id) => list.find((j) => j.id === id),
    ids: () => list.map((j) => j.id),
    start: async (user) => { sync.start(user); await settle(); },
    /** The tab shown again after long enough for the list to be read again. */
    refresh: async () => { clock += REFRESH; sync.shown(); await settle(); },
    edit: (id, patch, updatedAt) => set(list.map((j) => (j.id === id ? { ...j, ...patch, updatedAt } : j))),
    remove: (id) => set(list.filter((j) => j.id !== id)),
    /** Undo of a deletion (useJobStore.restoreJob): the same job back at its place. */
    putBack: (j, index) => set(list.toSpliced(index, 0, j)),
  };
}

test('R2-140: a job deleted on one device after another device changed it is not deleted from the account — the edit wins, and comes back', async () => {
  const cloud = fakeFirestore();
  const d1 = device(cloud, [job('j1', 'Acme'), job('j2', 'Beta')]);
  await d1.start(A);
  const d2 = device(cloud, []);
  await d2.start(A);
  assert.deepEqual(d2.ids(), ['j1', 'j2']);

  // Device 2 changes j1 and sends it; device 1 has not read the account since, and deletes j1.
  d2.edit('j1', { role: 'Lead', notes: '<p>Interview on Friday</p>' }, 30);
  await d2.timers.fire();
  assert.equal(cloud.doc(jobPath('A', 'j1')).role, 'Lead');
  d1.remove('j1');
  const from = cloud.commits.length;
  await d1.timers.fire();

  const kept = cloud.doc(jobPath('A', 'j1'));
  assert.ok(kept, 'the job another device changed is still in the account');
  assert.equal(kept.role, 'Lead');
  assert.equal(kept.notes, '<p>Interview on Friday</p>');
  assert.ok(!deletedIn(cloud, 'A').includes('j1'), 'and not listed as deleted');
  assert.equal(d1.job('j1')?.role, 'Lead', 'device 1 takes the changed job back');
  assert.equal(d1.meta.read().versions.j1, 30, 'as the version the cloud holds');
  assert.deepEqual(cloud.doc(metaPath('A')).order, d1.ids(), 'the order sent has it');
  assert.equal(d1.seen.status, 'synced');
  assert.deepEqual(writtenSince(cloud, from), [], 'the copy taken back is not written');
  await d1.timers.fire();
  assert.deepEqual(writtenSince(cloud, from), [], 'nor sent back later');

  await d2.refresh();
  assert.equal(d2.job('j1')?.role, 'Lead', 'the device that made the edit keeps it');

  // Deleted again, now that device 1 has seen the edit: it goes, everywhere.
  d1.remove('j1');
  await d1.timers.fire();
  assert.equal(cloud.doc(jobPath('A', 'j1')), undefined);
  assert.deepEqual(deletedIn(cloud, 'A'), ['j1']);
  assert.deepEqual(d1.ids(), ['j2']);
  await d2.refresh();
  assert.deepEqual(d2.ids(), ['j2']);
});

test('R2-140: a job this device changed and then deleted is deleted — its own edit in the cloud is no edit made elsewhere', async () => {
  const cloud = fakeFirestore();
  const d = device(cloud, [job('j1', 'Acme'), job('j2', 'Beta')]);
  await d.start(A);

  d.edit('j1', { role: 'Staff' }, 40);
  await d.timers.fire();
  assert.equal(cloud.doc(jobPath('A', 'j1')).role, 'Staff');
  d.remove('j1');
  await d.timers.fire();
  assert.equal(cloud.doc(jobPath('A', 'j1')), undefined);
  assert.deepEqual(deletedIn(cloud, 'A'), ['j1']);
  assert.deepEqual(d.ids(), ['j2']);

  // Changed and deleted within one pause: the cloud's older copy goes too.
  d.edit('j2', { role: 'Principal' }, 50);
  d.remove('j2');
  await d.timers.fire();
  assert.equal(cloud.doc(jobPath('A', 'j2')), undefined);
  assert.deepEqual(deletedIn(cloud, 'A').toSorted(), ['j1', 'j2']);
  assert.deepEqual(d.ids(), []);
  assert.equal(d.seen.status, 'synced');
});

test('R2-140: a deletion undone while its batch reads the cloud — the job is in the list once, as the other device changed it', async () => {
  const cloud = fakeFirestore();
  const d1 = device(cloud, [job('j1', 'Acme'), job('j2', 'Beta')]);
  await d1.start(A);
  const d2 = device(cloud, []);
  await d2.start(A);
  d2.edit('j1', { role: 'Lead' }, 30);
  await d2.timers.fire();

  // Device 1 deletes j1 and, while the batch is still reading the cloud's copy, undoes it.
  const original = d1.job('j1');
  d1.remove('j1');
  const gate = deferred();
  cloud.hold.read = gate.promise;
  await d1.timers.fire();
  d1.putBack(original, 0);
  cloud.hold.read = null;
  gate.resolve();
  await settle();
  assert.deepEqual(d1.ids().toSorted(), ['j1', 'j2'], 'not added a second time');
  assert.ok(cloud.doc(jobPath('A', 'j1')), 'not deleted from the account');

  // The undone job's own write finds the cloud's copy newer, and takes it.
  await d1.timers.fire();
  assert.deepEqual(d1.ids().toSorted(), ['j1', 'j2']);
  assert.equal(d1.job('j1').role, 'Lead');
  assert.equal(cloud.doc(jobPath('A', 'j1')).role, 'Lead');
  assert.ok(!deletedIn(cloud, 'A').includes('j1'));
  assert.equal(new Set(cloud.doc(metaPath('A')).order).size, cloud.doc(metaPath('A')).order.length, 'no id twice in the order');
});
