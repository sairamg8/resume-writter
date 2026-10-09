// H1-SYNC-21: a flush that finds the same job edited on another device keeps the older edit as a conflict copy, under an id
// made from the job's and the time of the edit (collectionSyncConflict.js). It looked at the cloud's copy of the job and of
// nothing else: the copy's id was a document it wrote with no look at what the account held there. Another device
// holding that id — the same conflict found there, or another edit of the job made at the same time — was overwritten with the copy,
// and what it held was lost; a device writing it between the read and the write was overwritten the same way. A first sync
// already looks (planFirstSync). Now the flush reads the ids of its copies too, gives another content the next free id and
// makes no copy of one the account holds, and expects the rest to be absent when the write lands.
// The real engine, plan and io over a fake Firestore. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { jobConflictCopy } from '../../src/utils/collectionSyncConflict.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const J1 = 'users/A/jobs/j1';
const COPY = 'users/A/jobs/job_j1-conflict-200';

const job = (id, notes, updatedAt) => ({
  id, company: 'Acme', role: 'Engineer', status: 'applied', todos: [], notes,
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});
const theirs = { ...job('j1', '[theirs]', 200), syncRev: 2, syncBy: 'dev-other' };
const asCopy = { ...jobConflictCopy(job('j1', '[theirs]', 200)), syncRev: 1, syncBy: 'dev-other' };

/** A device that synced j1 (version 100); the other device then edited it (200); here it is edited (300): a conflict, theirs the older. */
async function conflict(cloud) {
  let list = [job('j1', '[base]', 100)];
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
  sync.start(A);
  await settle();
  cloud.data.set(J1, theirs);
  set(list.map((x) => ({ ...x, notes: '[mine]', updatedAt: 300 })));
  return { seen, timers, list: () => list };
}
const notesIn = (cloud) => [...cloud.data].filter(([p]) => p.startsWith('users/A/jobs/')).map(([p, v]) => `${p.split('/').pop()}=${v.notes}`).toSorted();

test('a conflict copy\'s id another device holds with other content is not overwritten: the copy gets the next free id', async () => {
  const cloud = fakeFirestore({ [J1]: { ...job('j1', '[base]', 100), syncRev: 1, syncBy: 'dev-other' }, 'users/A/meta/jobs': { order: ['j1'], deleted: [] } });
  const d = await conflict(cloud);
  cloud.data.set(COPY, { ...job('job_j1-conflict-200', '[an edit made at the same time]', 200), syncRev: 1, syncBy: 'dev-third' });
  await d.timers.fire();
  assert.deepEqual(notesIn(cloud), [
    'j1=[mine]', 'job_j1-conflict-200-2=[theirs]', 'job_j1-conflict-200=[an edit made at the same time]',
  ].toSorted());
  assert.equal(d.seen.status, 'synced');
});

test('a conflict copy\'s id another device writes while the flush reads is not overwritten', async () => {
  const cloud = fakeFirestore({ [J1]: { ...job('j1', '[base]', 100), syncRev: 1, syncBy: 'dev-other' }, 'users/A/meta/jobs': { order: ['j1'], deleted: [] } });
  const d = await conflict(cloud);
  let reads = 0;
  cloud.afterRead = (path) => {
    // The flush has read j1 (once) and the copy's id (absent); the other device writes the id as the write is being checked.
    if (path !== J1) return;
    reads += 1;
    if (reads === 2) cloud.data.set(COPY, { ...job('job_j1-conflict-200', '[an edit made at the same time]', 200), syncRev: 1, syncBy: 'dev-third' });
  };
  await d.timers.fire();
  await settle(10);
  assert.deepEqual(notesIn(cloud), [
    'j1=[mine]', 'job_j1-conflict-200-2=[theirs]', 'job_j1-conflict-200=[an edit made at the same time]',
  ].toSorted());
  assert.equal(d.seen.status, 'synced');
});

test('the same conflict\'s copy already in the account is not made again, nor under a new id', async () => {
  const cloud = fakeFirestore({ [J1]: { ...job('j1', '[base]', 100), syncRev: 1, syncBy: 'dev-other' }, 'users/A/meta/jobs': { order: ['j1'], deleted: [] } });
  const d = await conflict(cloud);
  cloud.data.set(COPY, asCopy);
  await d.timers.fire();
  assert.deepEqual(notesIn(cloud), ['j1=[mine]', 'job_j1-conflict-200=[theirs]']);
  assert.equal(d.seen.status, 'synced');
});
