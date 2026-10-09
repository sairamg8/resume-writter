// H1-SYNC-1: deleting more jobs (or projects) at once than one request can carry, "Clear all jobs" on a list of
// 600, was refused for good by the server (a batch or a transaction takes 500 writes, and each deletion is one).
// The flush stopped ("stopped until the next change"), and so did every first sync after it, since each one carried
// the same 600 deletions: a job added afterwards was blamed ("held: too large") and never reached the account, on
// that device for good, and the deleted jobs stayed in the account for every other device. Now deletions beyond
// what one request takes are sent first in requests of their own, each recorded as deleted as it lands (so an Undo
// after part of them went still brings the whole list back).
// The real engine, plan and io over a fake Firestore that refuses a request of more than 500 writes, as the server
// does. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const COUNT = 650;

const job = (id, updatedAt = 5) => ({
  id, company: `Company ${id}`, role: 'Engineer', status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});
const ids = (n) => Array.from({ length: n }, (_, i) => `j${String(i).padStart(4, '0')}`);
const jobPath = (id) => `users/A/jobs/${id}`;
const metaPath = 'users/A/meta/jobs';
const tooMany = (ops) => (ops.length > 500
  ? Object.assign(new Error('maximum 500 writes allowed per request'), { code: 'invalid-argument' }) : null);

/** The account already holds `n` jobs; this device holds the same ones. */
function setup(n = COUNT) {
  const docs = Object.fromEntries(ids(n).map((id) => [jobPath(id), job(id)]));
  const cloud = fakeFirestore(docs);
  cloud.refuse = tooMany;
  let list = ids(n).map((id) => job(id));
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.company,
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const net = { online: true };
  const sync = createCollectionSync({
    name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers, online: () => net.online,
  });
  return {
    cloud, timers, seen, net, set,
    items: () => list,
    start: async (user) => { sync.start(user); await settle(); },
  };
}
const jobsInCloud = (cloud) => [...cloud.data.keys()].filter((p) => p.startsWith('users/A/jobs/'));

test('clearing 650 jobs reaches the account, in requests it takes, and the sync goes on', async () => {
  const d = setup();
  await d.start(A);
  assert.equal(d.seen.status, 'synced');
  assert.equal(jobsInCloud(d.cloud).length, COUNT);

  d.set([]); // Clear all jobs
  await d.timers.fire();
  assert.equal(d.seen.status, 'synced', 'not stopped');
  assert.equal(jobsInCloud(d.cloud).length, 0, 'every deletion reached the account');
  assert.equal(d.cloud.doc(metaPath).deleted.length, COUNT, 'and is listed as deleted');
  assert.equal(d.cloud.refused.length, 0, 'no request over what the server takes');

  // A job added afterwards is sent, not held.
  d.set([job('new1', 9)]);
  await d.timers.fire();
  assert.equal(d.seen.status, 'synced');
  assert.equal(d.cloud.doc(jobPath('new1'))?.company, 'Company new1');
});

test('650 deletions made offline reach the account at the first sync, and the job added with them is not held', async () => {
  const d = setup();
  await d.start(A);
  d.net.online = false;
  await d.start(A);
  assert.equal(d.seen.status, 'offline');
  d.set([job('new1', 9)]); // the 650 cleared, one added

  d.net.online = true;
  await d.start(A);
  assert.equal(d.seen.status, 'synced');
  assert.deepEqual(jobsInCloud(d.cloud), [jobPath('new1')], 'the new job is the account\'s list');
  assert.equal(d.cloud.doc(metaPath).deleted.length, COUNT);
  assert.deepEqual(d.items().map((j) => j.id), ['new1']);
});

test('the deletions that went before a failure are recorded as deleted: an Undo after them brings the whole list back', async () => {
  const d = setup();
  await d.start(A);
  const was = d.items();

  // The second request fails (the network drops): the first 400 deletions went, 250 did not.
  let requests = 0;
  d.cloud.refuse = (ops) => {
    requests += 1;
    return requests === 2 ? Object.assign(new Error('unavailable'), { code: 'unavailable' }) : tooMany(ops);
  };
  d.set([]);
  await d.timers.fire();
  assert.equal(d.seen.status, 'error', 'it says it will retry');
  assert.equal(jobsInCloud(d.cloud).length, COUNT - 400, 'the first request went');

  // Undo puts the list back; the retry is a first sync.
  d.set(was);
  d.cloud.refuse = tooMany;
  await d.timers.fire();
  await settle();
  assert.equal(d.seen.status, 'synced');
  assert.equal(d.items().length, COUNT, 'every job is still here');
  assert.equal(jobsInCloud(d.cloud).length, COUNT, 'and in the account');
});
