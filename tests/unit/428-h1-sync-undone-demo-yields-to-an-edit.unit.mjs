// H1-SYNC-28: the first visit's demo job, untouched, carries nothing typed: an account's edit of it wins over it, whatever the
// clocks say (R5-HUNT4). That held for a demo never synced here only. A demo deleted here and put back by Undo, still
// untouched, is "known" to the record (its deletion is), and was settled by the clocks like any edit: with another device's
// edit of the demo made meanwhile — where the deletion was never seen, so the edit won over it — stamped earlier by a slow clock,
// the untouched demo replaced the edit in the account, with no copy kept. Now an untouched demo put back by Undo yields to the
// account's edit, at a first sync and at a flush. Found by the three-device script once its Undo kept no exemption (410).
// The real engine, plan and io over a fake Firestore. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { jobConflictCopy } from '../../src/utils/collectionSyncConflict.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };

const demo = (notes, updatedAt) => ({
  id: 'demo', company: 'Acme', role: 'Engineer', status: 'applied', todos: [], notes,
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});
const jobsIn = (cloud) => [...cloud.data].filter(([p]) => p.startsWith('users/A/jobs/')).map(([, v]) => v.notes).toSorted();

function device(cloud, items) {
  let list = items;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.company, conflictCopy: jobConflictCopy,
    seed: (j) => j.id === 'demo' && j.notes === '', seedIds: ['demo'],
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers });
  return {
    seen, timers, set,
    items: () => list,
    start: async (user) => { sync.start(user); await settle(); },
  };
}

/** Both devices show the account's untouched demo; d2 deletes it (the deletion lands); d1, who had not heard, edits it (a slow clock). */
async function deletedHereEditedThere() {
  const cloud = fakeFirestore();
  const d1 = device(cloud, [demo('', 303)]);
  await d1.start(A);
  const d2 = device(cloud, []);
  await d2.start(A);
  assert.deepEqual(d2.items().map((x) => x.id), ['demo']);
  const untouched = d2.items();
  d2.set([]);
  await d2.timers.fire();
  assert.deepEqual(jobsIn(cloud), [], 'the deletion landed');
  d1.set([demo('[3]', 50)]); // an edit, stamped earlier than the copy it was made on
  await d1.timers.fire();
  assert.deepEqual(jobsIn(cloud), ['[3]'], 'and the edit won over it');
  d2.set(untouched); // Undo
  return { cloud, d2 };
}

test('an untouched demo put back by Undo yields to the account\'s edit at the first sync', async () => {
  const { cloud, d2 } = await deletedHereEditedThere();
  await d2.start(A);
  await d2.timers.fire();
  await settle(10);
  assert.deepEqual(jobsIn(cloud), ['[3]'], 'the edit is the account\'s demo, with no copy');
  assert.deepEqual(d2.items().map((x) => x.notes), ['[3]'], 'and the one shown here');
});

test('an untouched demo put back by Undo yields to the account\'s edit at a flush', async () => {
  const { cloud, d2 } = await deletedHereEditedThere();
  await d2.timers.fire();
  await settle(10);
  assert.deepEqual(jobsIn(cloud), ['[3]'], 'the edit is the account\'s demo, with no copy');
  assert.deepEqual(d2.items().map((x) => x.notes), ['[3]'], 'and the one shown here');
});
