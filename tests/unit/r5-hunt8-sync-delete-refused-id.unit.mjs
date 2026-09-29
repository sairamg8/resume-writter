// R5-HUNT8-SYNC-DELETE-REFUSED-ID-STOPS: a job imported with an id the cloud cannot name
// ("linkedin/3912345") is held (R5-HUNT7), never sent. Deleting it, or clearing every job while it
// was in the list, sent its deletion too: the flush read its path first, the SDK refused it
// (invalid-argument), and with nothing queued to write the sync stopped — no deletion reached the
// account, and the icon said "Sync stopped" until another change or a reload. An id the cloud
// cannot name was never in it: its deletion is dropped, and the others go.
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
    set, list: () => list,
  };
}

const cloudIds = (cloud) => [...cloud.data.keys()].filter((p) => p.startsWith('users/A/jobs/')).map((p) => p.slice('users/A/jobs/'.length)).toSorted();

async function withHeldJob() {
  const cloud = fakeFirestore();
  const d = device(cloud, [job('j0', 'Acme', 2), job('j1', 'Globex', 2), job(BAD_ID, 'LinkedIn import', 2)]);
  await d.start(A);
  assert.deepEqual(cloudIds(cloud), ['j0', 'j1']);
  assert.deepEqual(d.seen.held, [{ id: BAD_ID, name: 'LinkedIn import' }]);
  return { cloud, d };
}

test('deleting the held job the cloud cannot name: the sync goes on, and ends synced', async () => {
  const { cloud, d } = await withHeldJob();
  d.set(d.list().filter((j) => j.id !== BAD_ID));
  await d.timers.fire(); // the flush
  assert.deepEqual(d.seen.held, []);
  assert.equal(d.seen.status, 'synced', 'not "Sync stopped"');
  assert.deepEqual(cloud.doc('users/A/meta/jobs').order, ['j0', 'j1']);

  // The next change is sent by the queue, as usual.
  d.set(d.list().filter((j) => j.id !== 'j1'));
  await d.timers.fire();
  assert.deepEqual(cloudIds(cloud), ['j0']);
  assert.equal(d.seen.status, 'synced');
});

test('clearing every job while the held one is in the list: every other deletion reaches the account', async () => {
  const { cloud, d } = await withHeldJob();
  d.set([]);
  await d.timers.fire(); // the flush
  assert.deepEqual(cloudIds(cloud), [], 'the jobs this browser deleted are gone from the account');
  assert.deepEqual(cloud.doc('users/A/meta/jobs').deleted.toSorted(), ['j0', 'j1']);
  assert.equal(d.seen.status, 'synced');
});
