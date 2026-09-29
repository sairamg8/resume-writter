// R5-HUNT8 review of R5-HUNT8-SYNC-DELETE-REFUSED-ID-STOPS: an id the cloud cannot name was held
// only when Firestore refused it. One holding two "/" ("greenhouse/acme/12345") is no refused path
// but a document nested under the jobs (users/A/jobs/greenhouse/acme/12345): the SDK takes it,
// the job was written there and reported synced, yet no read of the list ever finds it — no other
// device got it, and this browser's next first sync took it for a job removed from the cloud and
// dropped it. The flush's new rule (a deletion of such an id is not sent) also rests on it never
// having been written. Now such an item is held before it is sent, as one too large is, and a
// version an older build recorded for it does not have it dropped.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const NESTED = 'greenhouse/acme/12345';

const job = (id, company, updatedAt = 1) => ({
  id, company, role: 'Engineer', status: 'applied', todos: [], statusHistory: [], createdAt: 1, updatedAt,
});

function device(cloud, jobs, meta = memoryMeta()) {
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
  // The fake takes a path of an even number of segments, as the SDK does: the nested document.
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta, report, timers });
  return {
    sync, timers, seen, meta,
    ids: () => list.map((j) => j.id).toSorted(),
    start: async (user) => { sync.start(user); await settle(); },
    set,
  };
}

const written = (cloud) => [...cloud.data.keys()].filter((p) => p.startsWith('users/A/jobs/')).toSorted();

test('a job whose id holds two "/" is held, not written as a document nested under the list', async () => {
  const cloud = fakeFirestore();
  const d = device(cloud, [job('j0', 'Acme', 2), job(NESTED, 'Greenhouse import', 2)]);
  await d.start(A);

  assert.deepEqual(written(cloud), ['users/A/jobs/j0'], 'nothing written where no read of the list finds it');
  assert.deepEqual(d.seen.held, [{ id: NESTED, name: 'Greenhouse import' }], 'named as not synced');
  assert.equal(d.seen.status, 'stopped', 'not "synced"');
  assert.deepEqual(d.ids(), ['j0', NESTED].toSorted());

  // Changed, it is held again; the next first sync keeps it here.
  d.set([job('j0', 'Acme', 2), job(NESTED, 'Greenhouse import', 3)]);
  await d.timers.fire();
  assert.deepEqual(written(cloud), ['users/A/jobs/j0']);
  await d.start(A);
  assert.deepEqual(d.ids(), ['j0', NESTED].toSorted(), 'not dropped as removed from the cloud');
  assert.deepEqual(d.seen.held, [{ id: NESTED, name: 'Greenhouse import' }]);
});

test('a version an older build recorded for such a job does not have it dropped at the next first sync', async () => {
  // What an older build left: the job written nested, and its version in this browser's record.
  const cloud = fakeFirestore({
    'users/A/jobs/j0': job('j0', 'Acme', 2),
    [`users/A/jobs/${NESTED}`]: job(NESTED, 'Greenhouse import', 2),
    'users/A/meta/jobs': { order: ['j0', NESTED], deleted: [] },
  });
  const meta = memoryMeta({ uid: 'A', versions: { j0: 2, [NESTED]: 2 }, order: ['j0', NESTED], stashed: {} });
  const d = device(cloud, [job('j0', 'Acme', 2), job(NESTED, 'Greenhouse import', 2)], meta);
  await d.start(A);

  assert.deepEqual(d.ids(), ['j0', NESTED].toSorted(), 'the job stays in this browser');
  assert.deepEqual(d.seen.held, [{ id: NESTED, name: 'Greenhouse import' }]);
  assert.equal(d.seen.status, 'stopped');
});
