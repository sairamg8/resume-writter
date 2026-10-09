// H1-SYNC-20: a write that lands after a start replaced the sync that sent it is recorded for what this browser's list holds
// (415). An item the user deleted while that write was on its way was not in the list, so it was left out of the record: in the
// account with no version, it was at the next sync a job "never seen here" and came back from the account — a deletion undone.
// Now the record has the versions of what was written and held when the write was decided, the item deleted meanwhile
// too: it is a job known here and gone from the list, and the next sync deletes it from the account. Only a conflict copy the
// plan made (in neither) is left out (416).
// The real engine, plan and io over a fake Firestore; the write waits at a gate while the browser goes offline.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { jobConflictCopy } from '../../src/utils/collectionSyncConflict.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { deferred, fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };

const job = (id, notes, updatedAt) => ({
  id, company: 'Acme', role: 'Engineer', status: 'applied', todos: [], notes,
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});

function device(cloud, items = []) {
  let list = items;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.company, conflictCopy: jobConflictCopy,
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
  return {
    seen, net, timers,
    ids: () => list.map((x) => x.id).toSorted(),
    hold: () => { armed = true; },
    release: async () => { gate.resolve(); await settle(10); },
    start: async (user) => { sync.start(user); await settle(); },
    add: (j) => set([...list, j]),
    remove: (id) => set(list.filter((x) => x.id !== id)),
  };
}
const jobsIn = (cloud) => [...cloud.data.keys()].filter((p) => p.startsWith('users/A/jobs/')).toSorted();

/** n5 is added and its write is on its way as the browser goes offline; the user deletes n5; the write lands; back online. */
async function deletedWhileLanding(run) {
  const cloud = fakeFirestore();
  const d1 = device(cloud, [job('j1', '[1]', 100)]);
  await d1.start(A);
  d1.add(job('n5', '[5]', 2111));
  d1.hold();
  await run(d1); // the write waits at the gate ...
  d1.net.online = false;
  await d1.start(A); // ... as the browser goes offline
  d1.remove('n5'); // the user deletes it
  await d1.release(); // the write lands
  assert.ok(jobsIn(cloud).includes('users/A/jobs/n5'), 'the write landed');
  d1.net.online = true;
  await d1.start(A);
  await d1.timers.fire();
  await settle(10);
  return { cloud, d1 };
}

test('a first sync\'s write that landed after the item was deleted here: the next sync deletes it, it does not come back', async () => {
  const { cloud, d1 } = await deletedWhileLanding((d1) => d1.start(A));
  assert.deepEqual(d1.ids(), ['j1']);
  assert.deepEqual(jobsIn(cloud), ['users/A/jobs/j1']);
  assert.equal(d1.seen.status, 'synced');
});

test('a flush\'s write that landed after the item was deleted here: the next sync deletes it, it does not come back', async () => {
  const { cloud, d1 } = await deletedWhileLanding(async (d1) => { await d1.timers.fire(); });
  assert.deepEqual(d1.ids(), ['j1']);
  assert.deepEqual(jobsIn(cloud), ['users/A/jobs/j1']);
  assert.equal(d1.seen.status, 'synced');
});
