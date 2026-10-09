// H1-SYNC-25: a first sync takes the cloud's copy of a job another device edited (this browser's copy is the older), and
// records it as seen. A job the user deletes while that first sync's batch is on its way is gone from the list, but its
// record claimed the cloud's copy: the deletion, queued by the sync, was then a deletion of a copy the user had never
// seen — it deleted the other device's edit from the account, on every device (and an Undo put back the older copy over it).
// Now the deletion's base is the copy it was made on (as for an edit typed meanwhile, 414): the account's copy is a change
// after it, the deletion is not sent, and the edit comes back here. Found by the three-device script once its Undo kept
// no exemption (410).
// The real engine, plan and io over a fake Firestore; the first sync's batch waits at a gate while the job is deleted.
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

function device(cloud, items) {
  let list = items;
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
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers });
  return {
    seen, timers, set,
    items: () => list,
    notes: (id) => list.find((x) => x.id === id)?.notes,
    hold: () => { armed = true; },
    release: async () => { gate.resolve(); await settle(10); },
    start: async (user) => { sync.start(user); await settle(); },
  };
}

async function deletedWhileFirstSyncSends() {
  const cloud = fakeFirestore();
  const d = device(cloud, [job('j1', '[1]', 100), job('j2', '[2]', 110)]);
  await d.start(A);
  // Another device edits j2 meanwhile.
  cloud.data.set('users/A/jobs/j2', { ...job('j2', '[2] edited elsewhere', 300), syncRev: 2, syncBy: 'dev-other' });
  d.set([...d.items(), job('n9', '[9]', 400)]); // a new job, so the first sync has a write to send
  d.hold();
  await d.start(A); // takes the account's j2; its batch waits
  const was = d.items();
  d.set(d.items().filter((x) => x.id !== 'j2')); // the user deletes j2
  await d.release();
  return { cloud, d, was };
}

test('a job deleted while the first sync sends: another device\'s edit of it is not deleted from the account', async () => {
  const { cloud, d } = await deletedWhileFirstSyncSends();
  await d.timers.fire();
  await settle(10);
  assert.equal(cloud.doc('users/A/jobs/j2')?.notes, '[2] edited elsewhere', 'the account keeps the edit');
  assert.equal(d.notes('j2'), '[2] edited elsewhere', 'and it comes back here');
  assert.equal(d.seen.status, 'synced');
});

test('a job deleted while the first sync sends and put back by Undo: the account\'s newer copy stays', async () => {
  const { cloud, d, was } = await deletedWhileFirstSyncSends();
  d.set(was.map((x) => (x.id === 'j2' ? job('j2', '[2]', 110) : x))); // Undo: the copy that was deleted
  await d.timers.fire();
  await settle(10);
  assert.equal(cloud.doc('users/A/jobs/j2')?.notes, '[2] edited elsewhere', 'the account keeps the edit');
  assert.equal(d.notes('j2'), '[2] edited elsewhere');
});
