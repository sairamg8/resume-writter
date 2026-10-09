// H1-SYNC-8: the project store makes a list addressable as it takes one (addressableBoards): a project whose key another
// has gets a key of its own. The first sync merges the account's projects with this browser's, hands the result to the
// store, and then told its queue about the list it had handed over instead of the list the store kept: the project
// with the new key was queued (from the store's own notice) and then replaced in the queue by the copy with the old
// key, which was what the next flush sent. The account kept two projects with one key (an issue is opened by its
// project's key), and this browser showed another, until a later edit or sync wrote it. Now the sync tells its queue
// about the list the store holds.
// The real engine, plan and io over a fake Firestore; the store gives a duplicate key a new one on taking a list.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };

const board = (id, key, title, updatedAt) => ({ id, key, title, issues: [], updatedAt });

/** The store's own pass over a list it takes: the first holder of a key keeps it, a later one gets `<key>2`. */
const addressable = (list) => {
  const keys = new Set();
  return list.map((b) => {
    const out = keys.has(b.key) ? { ...b, key: `${b.key}2` } : b;
    keys.add(out.key);
    return out;
  });
};

function device(cloud, items) {
  let list = items;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: (next) => set(addressable(next)),
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (b) => b.title,
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const sync = createCollectionSync({ name: 'boards', io: collectionIo(cloud.fs, cloud.db, 'boards'), store, meta: memoryMeta(), report, timers });
  return {
    timers, seen,
    keys: () => Object.fromEntries(list.map((b) => [b.id, b.key])),
    start: async (user) => { sync.start(user); await settle(); },
  };
}

test('a project given a key of its own on the merge is sent with it, not with the key it came with', async () => {
  // The account's Garden has the key GRD; this browser made another project, Grocery, with the same key.
  const cloud = fakeFirestore({ 'users/A/boards/garden': board('garden', 'GRD', 'Garden', 5) });
  const d = device(cloud, [board('grocery', 'GRD', 'Grocery', 4)]);
  await d.start(A);
  const shown = d.keys();
  assert.notEqual(shown.garden, shown.grocery, 'this browser shows two different keys');

  await d.timers.fire(); // the flush
  const sent = { garden: cloud.doc('users/A/boards/garden').key, grocery: cloud.doc('users/A/boards/grocery').key };
  assert.deepEqual(sent, shown, 'the account holds the keys this browser shows');
  assert.notEqual(sent.garden, sent.grocery);
  assert.equal(d.seen.status, 'synced');
});
