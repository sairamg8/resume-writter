// CYC8-S7: the jobs' and projects' commit put the whole change in ONE batch. Firestore refuses a
// batch of more than 500 writes (invalid-argument), so the first sync of an account with some
// hundreds of jobs was refused and taken apart by commitApart: one request per job. Now the change
// goes in batches of at most 450 items (room for the deletion-list and order writes), in order —
// sets, then deletes, the order in the last — and nothing is refused.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };

const job = (id, updatedAt = 1) => ({
  id, company: `Company ${id}`, role: 'Engineer', status: 'applied', todos: [], statusHistory: [], createdAt: 1, updatedAt,
});
const tooBig = () => Object.assign(new Error('maximum 500 writes allowed per request'), { code: 'invalid-argument' });
const many = (n) => Array.from({ length: n }, (_, i) => job(`j${String(i).padStart(4, '0')}`));

function device(cloud, jobs) {
  let list = jobs;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.company,
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers });
  return { sync, seen, timers, set };
}

const cloudJobs = (cloud) => [...cloud.data.keys()].filter((p) => p.startsWith('users/A/jobs/'));

test('a first sync of 1,000 jobs goes in batches under the limit and is not taken apart', async () => {
  const cloud = fakeFirestore();
  cloud.refuse = (ops) => (ops.length > 500 ? tooBig() : null);
  const list = many(1000);
  const d = device(cloud, list);
  d.sync.start(A);
  await settle(20);

  assert.equal(cloud.refused.length, 0, 'no batch is refused');
  assert.equal(d.seen.status, 'synced');
  assert.ok(cloud.commits.every((ops) => ops.length <= 500), 'every batch holds 500 writes at most');
  assert.ok(cloud.commits.length <= 4, 'a handful of batches, not one request per job');
  assert.equal(cloudJobs(cloud).length, 1000, 'every job reached the account');
  assert.deepEqual(cloud.doc('users/A/meta/jobs').order, list.map((j) => j.id), 'the order is sent whole');
});

test('600 jobs deleted at once: the deletions go in batches under the limit, all listed as deleted', async () => {
  const cloud = fakeFirestore();
  cloud.refuse = (ops) => (ops.length > 500 ? tooBig() : null);
  const list = many(600);
  const d = device(cloud, list);
  d.sync.start(A);
  await settle(20);
  assert.equal(cloudJobs(cloud).length, 600);
  const before = cloud.commits.length;

  d.set([]);
  await d.timers.fire(); // the flush
  await settle(20);

  assert.equal(cloud.refused.length, 0, 'no batch is refused');
  assert.equal(d.seen.status, 'synced');
  assert.ok(cloud.commits.length > before + 1, 'the deletions took more than one batch');
  assert.equal(cloudJobs(cloud).length, 0, 'every job is gone from the account');
  assert.equal(cloud.doc('users/A/meta/jobs').deleted.length, 600, 'every id is on the deletion list');
  assert.deepEqual(cloud.doc('users/A/meta/jobs').order, [], 'the order is sent');
});
