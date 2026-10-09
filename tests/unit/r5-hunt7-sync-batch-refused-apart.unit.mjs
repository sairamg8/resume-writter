// R5-HUNT7-SYNC-COLLECTION-BATCH-REFUSED-HOLDS-ALL: one job the cloud refuses for good — imported
// with an id Firestore cannot name ("linkedin/3912345": a path, not an id) or holding a value it
// will not store (a list inside a list) — stopped the job sync, and every other job of its batch
// was held back with it and named "too large" (collectionSyncEngine's failed held the whole
// batch). The résumés' sync takes such a batch apart (cloudSyncHeld.commitHolding); now the jobs'
// and projects' does too: the first sync sends each item on its own and holds only the one the
// cloud refuses, and a flush refused so hands its batch to that first sync after the pause.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const BAD_ID = 'linkedin/3912345';

const job = (id, company, updatedAt = 1, extra = {}) => ({
  id, company, role: 'Engineer', status: 'applied', todos: [], statusHistory: [], createdAt: 1, updatedAt, ...extra,
});
const invalid = (message) => Object.assign(new Error(message), { code: 'invalid-argument' });
const nestedList = (v) => (Array.isArray(v) ? v.some(Array.isArray) || v.some(nestedList)
  : Boolean(v) && typeof v === 'object' && Object.values(v).some(nestedList));

/**
 * The fake Firestore's SDK calls, refusing what the real SDK refuses, synchronously: a document
 * path with an odd number of segments (an id holding "/"), and a list inside a list.
 */
function strictFs(cloud) {
  return {
    ...cloud.fs,
    doc(db, ...segs) {
      if (segs.join('/').split('/').length % 2) throw invalid('Invalid document reference. Document references must have an even number of segments.');
      return cloud.fs.doc(db, ...segs);
    },
    writeBatch() {
      const batch = cloud.fs.writeBatch();
      const set = batch.set.bind(batch);
      batch.set = (ref, value, options) => {
        if (nestedList(value)) throw invalid('Function WriteBatch.set() called with invalid data. Nested arrays are not supported.');
        return set(ref, value, options);
      };
      return batch;
    },
    // A write that checks the copies it replaces (or the ones that are not there) is a transaction: its set refuses the same.
    runTransaction: (db, update) => cloud.fs.runTransaction(db, (tx) => update({
      get: (ref) => tx.get(ref),
      set(ref, value, options) {
        if (nestedList(value)) throw invalid('Function Transaction.set() called with invalid data. Nested arrays are not supported.');
        return tx.set(ref, value, options);
      },
      delete: (ref) => tx.delete(ref),
    })),
  };
}

function device(cloud, jobs = []) {
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
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(strictFs(cloud), cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers });
  return {
    sync, timers, seen,
    ids: () => list.map((j) => j.id).toSorted(),
    start: async (user) => { sync.start(user); await settle(); },
    add: (more) => set([...list, ...more]),
  };
}

const cloudIds = (cloud) => [...cloud.data.keys()].filter((p) => p.startsWith('users/A/jobs/')).map((p) => p.slice('users/A/jobs/'.length)).toSorted();
const imported = (n) => Array.from({ length: n }, (_, i) => job(`imp${String(i).padStart(2, '0')}`, `Company ${i}`, 5));

test('an imported job whose id the cloud cannot name: the other nineteen reach the account, and only it is held', async () => {
  const cloud = fakeFirestore({ 'users/A/jobs/j0': job('j0', 'Acme', 2) });
  const d = device(cloud, []);
  await d.start(A);
  assert.equal(d.seen.status, 'synced');

  const batch = [...imported(19), job(BAD_ID, 'LinkedIn import', 5)];
  d.add(batch);
  await d.timers.fire(); // the flush: its read of the bad id is refused
  await d.timers.fire(); // after the pause, a first sync takes the batch apart

  assert.deepEqual(cloudIds(cloud), ['j0', ...imported(19).map((j) => j.id)].toSorted(), 'every job but the refused one is in the account');
  assert.deepEqual(d.seen.held, [{ id: BAD_ID, name: 'LinkedIn import' }], 'only the refused job is held');
  assert.equal(d.seen.status, 'stopped');
  assert.equal(d.ids().length, 21, 'nothing leaves this browser');
  assert.equal(cloud.doc('users/A/meta/jobs').order.length, 21, 'the order is sent too');
});

test('an imported job holding a list inside a list: the others of its flush are sent, and it alone is held', async () => {
  const cloud = fakeFirestore();
  const d = device(cloud, [job('j0', 'Acme', 2)]);
  await d.start(A);
  assert.deepEqual(cloudIds(cloud), ['j0']);

  d.add([...imported(19), job('nested', 'Nested tags', 5, { tags: [['remote']] })]);
  await d.timers.fire(); // the flush: its batch is refused
  assert.notDeepEqual(d.seen.held.map((x) => x.id), [...imported(19).map((j) => j.id), 'nested'], 'the batch is not held whole');
  await d.timers.fire(); // after the pause, a first sync takes it apart

  assert.deepEqual(cloudIds(cloud), ['j0', ...imported(19).map((j) => j.id)].toSorted());
  assert.deepEqual(d.seen.held, [{ id: 'nested', name: 'Nested tags' }]);
  assert.equal(d.seen.status, 'stopped');
});

test('a first sign-in on a new browser with such a job: the account gets every other local job', async () => {
  const cloud = fakeFirestore({ 'users/A/jobs/c1': job('c1', 'Cloudy', 3) });
  const d = device(cloud, [job('l1', 'Local one', 4), job(BAD_ID, 'LinkedIn import', 4), job('l2', 'Local two', 4)]);
  await d.start(A);

  assert.deepEqual(cloudIds(cloud), ['c1', 'l1', 'l2']);
  assert.deepEqual(d.seen.held, [{ id: BAD_ID, name: 'LinkedIn import' }]);
  assert.equal(d.seen.status, 'stopped');
  assert.deepEqual(d.ids(), ['c1', 'l1', 'l2', BAD_ID].toSorted());

  // Nothing is sent again until the held job changes.
  await d.timers.fire();
  assert.deepEqual(cloudIds(cloud), ['c1', 'l1', 'l2'], 'the refused job is not retried until it changes');
});
