// R5-HUNT2-COLLECTION-UNDO-DELETE-LOST-IF-RESTORE-FLUSH-MISSES: a job (or project) put back with
// Undo after its deletion reached the cloud stays put back, even when the put-back's own write
// never gets there — the tab reloaded or went offline within the pause, or the user signed out.
// Undo puts back the job as it was, with its old updatedAt; once the deletion was sent, this
// browser's record dropped the job's version, so the next first sync read the job as a stale
// copy of one the account deleted, and deleted it here too — from every device, as the account
// still listed it as deleted. Now the record keeps a sent deletion (version 0) until the next
// first sync, so the job put back since counts as changed here: kept, written, and taken off the
// account's deleted list. A device that only held the job, and never deleted it, still drops it.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { completeJob, readJob } from '../../src/utils/normalizeJob.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };

const job = (id, company, updatedAt = 1) => ({
  id, company, role: 'Engineer', status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});
const jobPath = (uid, id) => `users/${uid}/jobs/${id}`;
const metaPath = (uid) => `users/${uid}/meta/jobs`;
const deletedIn = (cloud, uid) => cloud.doc(metaPath(uid))?.deleted ?? [];

const fromCloud = (d) => { const { kept } = readJob(d); return kept ? completeJob(kept) : null; };
const label = (j) => j.company || 'Untitled job';

/** A device: its own job list, sync record and timers; `online` flips its connection. */
function device(cloud, jobs = []) {
  let list = jobs;
  let isOnline = true;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = { items: () => list, replace: set, subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); }, fromCloud, label };
  const timers = manualTimers();
  const { report } = recorder();
  const meta = memoryMeta();
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta, report, timers, online: () => isOnline });
  return {
    sync, timers, meta,
    job: (id) => list.find((j) => j.id === id),
    ids: () => list.map((j) => j.id),
    start: async (user) => { sync.start(user); await settle(); },
    offline: () => { isOnline = false; sync.start(A); },
    online: async () => { isOnline = true; sync.start(A); await settle(); },
    remove: (id) => set(list.filter((j) => j.id !== id)),
    edit: (id, patch, updatedAt) => set(list.map((j) => (j.id === id ? { ...j, ...patch, updatedAt } : j))),
    /** Undo of a deletion (useJobStore.restoreJob): the same job back at its place. */
    putBack: (j, index) => set(list.toSpliced(index, 0, j)),
  };
}

test('a job put back after its deletion was sent survives a first sync that runs before its own write (reload or reconnect within the pause)', async () => {
  const cloud = fakeFirestore();
  const d1 = device(cloud, [job('j1', 'Acme'), job('j2', 'Beta')]);
  await d1.start(A);
  const original = d1.job('j1');
  d1.remove('j1');
  await d1.timers.fire();
  assert.ok(deletedIn(cloud, 'A').includes('j1'), 'the deletion reached the cloud');

  d1.putBack(original, 0);
  // Offline and back before the pause is over: the first sync runs instead of the queued write.
  d1.offline();
  await d1.online();
  assert.deepEqual(d1.ids().toSorted(), ['j1', 'j2'], 'still put back here');
  assert.equal(cloud.doc(jobPath('A', 'j1'))?.company, 'Acme', 'written to the account');
  assert.ok(!deletedIn(cloud, 'A').includes('j1'), 'taken off the deleted list');

  // Another device gets it back too.
  const d2 = device(cloud, []);
  await d2.start(A);
  assert.deepEqual(d2.ids().toSorted(), ['j1', 'j2']);
});

test('a job put back after its deletion was sent, then signed out before its write, comes back at the next sign-in', async () => {
  const cloud = fakeFirestore();
  const d1 = device(cloud, [job('j1', 'Acme'), job('j2', 'Beta')]);
  await d1.start(A);
  const original = d1.job('j1');
  d1.remove('j1');
  await d1.timers.fire();
  d1.putBack(original, 0);
  await d1.start(null);
  assert.deepEqual(d1.ids(), []);
  await d1.start(A);
  assert.deepEqual(d1.ids().toSorted(), ['j1', 'j2']);
  assert.ok(cloud.doc(jobPath('A', 'j1')));
  assert.ok(!deletedIn(cloud, 'A').includes('j1'));
});

test('a job deleted by a first sync (deleted offline) and put back before its write survives the next first sync', async () => {
  const cloud = fakeFirestore();
  const d1 = device(cloud, [job('j1', 'Acme'), job('j2', 'Beta')]);
  await d1.start(A);
  const original = d1.job('j1');
  d1.offline();
  d1.remove('j1');
  await d1.online();
  assert.ok(deletedIn(cloud, 'A').includes('j1'), 'the first sync sent the deletion');
  d1.putBack(original, 0);
  d1.offline();
  await d1.online();
  assert.deepEqual(d1.ids().toSorted(), ['j1', 'j2']);
  assert.ok(cloud.doc(jobPath('A', 'j1')));
  assert.ok(!deletedIn(cloud, 'A').includes('j1'));
});

test('a device that held the job and never deleted it still drops it once another device deleted it', async () => {
  const cloud = fakeFirestore();
  const d1 = device(cloud, [job('j1', 'Acme'), job('j2', 'Beta')]);
  await d1.start(A);
  const d2 = device(cloud, []);
  await d2.start(A);
  d1.remove('j1');
  await d1.timers.fire();
  d2.offline();
  await d2.online();
  assert.deepEqual(d2.ids(), ['j2']);
  assert.equal(cloud.doc(jobPath('A', 'j1')), undefined);
  assert.ok(deletedIn(cloud, 'A').includes('j1'));
});

// Review of the fix above: a deletion already sent is not kept aside at sign-out (leaveList), or
// the next sign-in sent it again and deleted the copy another device, which never saw the
// deletion, had edited and written back meanwhile.
test('a deletion already sent is not sent again after a sign-out: another device\'s later edit of the job stays', async () => {
  const cloud = fakeFirestore();
  const d1 = device(cloud, [job('j1', 'Acme'), job('j2', 'Beta')]);
  await d1.start(A);
  const d2 = device(cloud, []);
  await d2.start(A);
  d1.remove('j1');
  await d1.timers.fire();
  assert.ok(deletedIn(cloud, 'A').includes('j1'), 'the deletion reached the cloud');
  await d1.start(null);
  assert.equal(Object.keys(d1.meta.read().stashed).length, 0, 'nothing unsent is kept aside');

  // Device 2 never saw the deletion: its edit of j1 wins, and j1 is back in the account.
  d2.edit('j1', { notes: '<p>edited on device 2</p>' }, 20);
  await d2.timers.fire();
  assert.equal(cloud.doc(jobPath('A', 'j1'))?.notes, '<p>edited on device 2</p>');
  assert.ok(!deletedIn(cloud, 'A').includes('j1'));

  await d1.start(A);
  assert.deepEqual(d1.ids().toSorted(), ['j1', 'j2'], 'the edited job comes to device 1');
  assert.equal(cloud.doc(jobPath('A', 'j1'))?.notes, '<p>edited on device 2</p>', 'and stays in the account');
  assert.ok(!deletedIn(cloud, 'A').includes('j1'));
});
