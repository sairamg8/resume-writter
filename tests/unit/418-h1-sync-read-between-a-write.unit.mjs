// H1-SYNC-18: a first sync reads the account's items and its list of deleted ids with two reads at once. An edit on another
// device that brings a deleted item back writes the item and takes its id off the list in one transaction; a first sync whose
// reads straddle that write may read the list before it (the id still on it) and the items after it (the item there). The
// item then looked deleted for good and the sync deleted it from the account — the edit that had just been made, on every
// device. Now an item found on the list it was read with is checked against the list read again, after the items.
// The real engine, plan and io over a fake Firestore whose item read is held while the other device's write lands.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { deferred, fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };

const job = (id, notes, updatedAt) => ({
  id, company: 'Acme', role: 'Engineer', status: 'applied', todos: [], notes,
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});

test('an item another device brings back while the first sync reads is not deleted as one deleted for good', async () => {
  // The account lists j9 as deleted; this browser has not heard of it.
  const cloud = fakeFirestore({
    'users/A/jobs/j1': { ...job('j1', '[1]', 100), syncRev: 1, syncBy: 'dev-other' },
    'users/A/meta/jobs': { deleted: ['j9'], order: ['j1'] },
  });
  const gate = deferred();
  let armed = true;
  const fs = {
    ...cloud.fs,
    // The list of items is answered late: the list of deleted ids is read first.
    getDocsFromServer: async (col) => {
      if (armed) { armed = false; await gate.promise; }
      return cloud.fs.getDocsFromServer(col);
    },
  };
  let list = [job('j1', '[1]', 100)];
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.company,
  };
  const { seen, report } = recorder();
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers: manualTimers() });
  sync.start(A);
  await settle();

  // Meanwhile another device edits j9, which brings it back: the item is written and its id leaves the list, in one write.
  cloud.data.set('users/A/jobs/j9', { ...job('j9', '[9] edited', 300), syncRev: 2, syncBy: 'dev-other' });
  cloud.data.set('users/A/meta/jobs', { deleted: [], order: ['j1', 'j9'] });
  gate.resolve();
  await settle(10);

  assert.equal(cloud.doc('users/A/jobs/j9')?.notes, '[9] edited', 'the edit is still in the account');
  assert.deepEqual(list.map((x) => x.id).toSorted(), ['j1', 'j9'], 'and comes to this browser');
  assert.equal(seen.status, 'synced');
});
