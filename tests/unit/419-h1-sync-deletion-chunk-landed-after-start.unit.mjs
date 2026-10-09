// H1-SYNC-19: "Clear all jobs" on 650 goes in requests of 400 (400-h1-sync-many-deletions). A start (going offline, a refresh)
// replaces the sync that is sending them and drops its result — the record of what it deleted too — but a request already
// handed over still lands. The 400 jobs it deleted stood in the record as jobs known here, and when the user then used Undo
// (the whole list back), the next first sync found 400 jobs known here and gone from the account: deleted by someone else,
// so deleted here — the restored jobs were silently dropped. Now a chunk that lands is recorded as deleted all the same
// (when the record names the account), as 415 does for a write, and the Undo is one change after the deletion: all 650 stay.
// The real engine, plan and io over a fake Firestore that takes 500 writes at most; the first request waits at a gate while the
// browser goes offline. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { deferred, fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const COUNT = 650;

const job = (id, updatedAt = 5) => ({
  id, company: `Company ${id}`, role: 'Engineer', status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});
const ids = (n) => Array.from({ length: n }, (_, i) => `j${String(i).padStart(4, '0')}`);
const jobPath = (id) => `users/A/jobs/${id}`;
const tooMany = (ops) => (ops.length > 500
  ? Object.assign(new Error('maximum 500 writes allowed per request'), { code: 'invalid-argument' }) : null);
const jobsInCloud = (cloud) => [...cloud.data.keys()].filter((p) => p.startsWith('users/A/jobs/'));

test('a deletion request that landed after a start replaced the sync is recorded: an Undo after it keeps every job', async () => {
  const cloud = fakeFirestore(Object.fromEntries(ids(COUNT).map((id) => [jobPath(id), job(id)])));
  cloud.refuse = tooMany;
  let list = ids(COUNT).map((id) => job(id));
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.company,
  };
  const gate = deferred();
  let armed = false;
  const hold = (run) => {
    if (!armed) return run();
    armed = false;
    return gate.promise.then(run);
  };
  const fs = {
    ...cloud.fs,
    writeBatch: (db) => {
      const batch = cloud.fs.writeBatch(db);
      return { set: (...a) => batch.set(...a), delete: (...a) => batch.delete(...a), commit: () => hold(() => batch.commit()) };
    },
    runTransaction: (db, update) => hold(() => cloud.fs.runTransaction(db, update)),
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const net = { online: true };
  const sync = createCollectionSync({
    name: 'jobs', io: collectionIo(fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers, online: () => net.online,
  });
  sync.start(A);
  await settle();
  assert.equal(seen.status, 'synced');
  const was = list;

  set([]); // Clear all jobs; the first request of 400 waits at the gate
  armed = true;
  await timers.fire();
  net.online = false;
  sync.start(A); // the browser goes offline: the sync sending them is replaced
  await settle();
  gate.resolve(); // the request lands
  await settle(10);
  assert.equal(jobsInCloud(cloud).length, COUNT - 400, 'the first request went');

  set(was); // Undo
  net.online = true;
  sync.start(A);
  await settle(10);
  await timers.fire();
  await settle(10);
  assert.equal(seen.status, 'synced');
  assert.equal(list.length, COUNT, 'every job is still here');
  assert.equal(jobsInCloud(cloud).length, COUNT, 'and in the account');
});
