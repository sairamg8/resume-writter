// SL-SYNC-FIRST-SYNC-SAVED-MEANWHILE: a job or project list's first sync applies its merge to the list
// as it is once the batch is acknowledged, so what was changed meanwhile stays. It told "changed
// meanwhile" by the item's OBJECT: any item that was not the very object it started from. Another tab's
// save re-reads the whole list (every item a new object), so every item counted as edited here — and
// each one the plan had dropped (deleted on the phone, here unchanged since this browser last saw it)
// was added back to the list, written by the next flush, which also took it off the account's deletion
// list: the phone's deletion undone, on every device. Changed is now told by content, as the queue's
// changed() tells it: a new object with the same content is no change. An item whose content was
// edited here meanwhile still stays (the edit wins over a deletion it never saw, R2-029).
// The list engine and its Firestore calls over a fake Firestore; the first sync's batch is held
// (`cloud.hold.commit`) while the list is saved again.
// Run: node --test tests/unit/sync-first-sync-saved-meanwhile.unit.mjs
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
const metaPath = (uid) => `users/${uid}/meta/jobs`;
const fromCloud = (d) => { const { kept } = readJob(d); return kept ? completeJob(kept) : null; };
/** The jobs every batch wrote (set). */
const written = (cloud) => cloud.commits.flat()
  .filter(([op, path]) => op === 'set' && path.startsWith('users/A/jobs/')).map(([, path]) => path.split('/').at(-1));

/**
 * A browser that synced with account A before and holds j1 and j2 (both at the versions it last saw),
 * while the phone has deleted j2: the account lists it as deleted, with no copy. The order the cloud
 * holds is not the list's, so the first sync commits — and that batch is held until `release()`.
 * `save(list)` is the other tab's save arriving meanwhile (the storage event replacing the list).
 */
async function firstSyncCommitting() {
  const j1 = job('j1', 'Acme', 1);
  const j2 = job('j2', 'Beta', 2);
  const cloud = fakeFirestore({ [jobPath('A', 'j1')]: j1, [metaPath('A')]: { deleted: ['j2'] } });
  let list = [j1, j2];
  const listeners = new Set();
  const save = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: save,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud, label: (j) => j.company,
  };
  const meta = memoryMeta({ uid: 'A', versions: { j1: 1, j2: 2 }, order: null, stashed: {} });
  const timers = manualTimers();
  const { seen, report } = recorder();
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta, report, timers });

  const ack = deferred();
  cloud.hold.commit = ack.promise;
  sync.start(A);
  await settle(); // read, planned, and the batch handed over: waiting for the server's answer
  assert.equal(cloud.commits.length, 1, 'the first sync\'s batch (the order) is on its way');
  return {
    j1, j2, cloud, timers, seen, save,
    ids: () => list.map((j) => j.id),
    item: (id) => list.find((j) => j.id === id),
    release: async () => { cloud.hold.commit = null; ack.resolve(); await settle(10); },
  };
}

test('another tab saves the list while the first sync\'s batch is on its way: a job the phone deleted stays deleted, not added back and sent', async () => {
  const t = await firstSyncCommitting();
  t.save(t.ids().map((id) => ({ ...t.item(id) }))); // every item a new object, the same content
  await t.release();
  assert.deepEqual(t.ids(), ['j1'], 'before: [j1, j2] — the job deleted on the phone was added back');

  await t.timers.fire(); // whatever the list now asks to send
  assert.deepEqual(written(t.cloud), [], 'before: [j2] — written to the account');
  assert.equal(t.cloud.doc(jobPath('A', 'j2')), undefined);
  assert.deepEqual(t.cloud.doc(metaPath('A')).deleted, ['j2'], 'before: [] — taken off the account\'s deletion list');
  assert.equal(t.seen.status, 'synced');
});

test('the same save, with the dropped job edited here meanwhile: the edit wins, as it does over a deletion never seen', async () => {
  const t = await firstSyncCommitting();
  t.save([{ ...t.j1 }, { ...t.j2, role: 'Lead', updatedAt: 3 }]);
  await t.release();
  assert.deepEqual(t.ids().toSorted(), ['j1', 'j2']);
  assert.equal(t.item('j2').role, 'Lead');

  await t.timers.fire();
  assert.equal(t.cloud.doc(jobPath('A', 'j2')).role, 'Lead');
  assert.deepEqual(t.cloud.doc(metaPath('A')).deleted, [], 'taken off the list with its copy');
  assert.equal(t.seen.status, 'synced');
});

test('no save meanwhile: the job the phone deleted is dropped, as before', async () => {
  const t = await firstSyncCommitting();
  await t.release();
  assert.deepEqual(t.ids(), ['j1']);
  await t.timers.fire();
  assert.deepEqual(written(t.cloud), []);
  assert.deepEqual(t.cloud.doc(metaPath('A')).deleted, ['j2']);
  assert.equal(t.seen.status, 'synced');
});
