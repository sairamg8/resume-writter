// H1-SYNC-11: a job deleted here (the deletion sent), edited on another device that had not heard of it (the edit wins
// over the deletion: the account holds the job again), then put back here with Undo and edited: two edits of one start. The
// record holds the sent deletion as version 0, which was "no base to tell an edit from", so neither the flush nor the
// first sync called it a conflict: the older of the two copies was dropped with no copy kept, whichever clock made it
// older. Now a copy put back after a sent deletion is a change of its own, and the cloud's copy a change after the
// deletion: both are kept (the older as a conflict copy). Found by the three-device script (410).
// The real engine, plan and io over a fake Firestore two devices share. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { jobConflictCopy } from '../../src/utils/collectionSyncConflict.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

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
  const timers = manualTimers();
  const { seen, report } = recorder();
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers });
  return {
    timers, seen,
    get: (id) => list.find((x) => x.id === id),
    start: async (user) => { sync.start(user); await settle(); },
    edit: (id, patch, updatedAt) => set(list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt } : x))),
    remove: (id) => set(list.filter((x) => x.id !== id)),
    putBack: (j, index) => set(list.toSpliced(index, 0, j)),
  };
}
const notesInCloud = (cloud) => [...cloud.data].filter(([p]) => p.startsWith('users/A/jobs/')).map(([, v]) => v.notes).toSorted();

/** j2 deleted on d1 and sent; edited on d0 (which had not heard) and sent; then put back on d1 and edited, on a slow clock. */
async function resurrected() {
  const cloud = fakeFirestore();
  const d0 = device(cloud, [job('j1', '', 1), job('j2', '[2]', 1)]);
  await d0.start(A);
  const d1 = device(cloud);
  await d1.start(A);
  const was = d1.get('j2');
  d1.remove('j2');
  await d1.timers.fire();
  d0.edit('j2', { notes: '[2] [3]' }, 300);
  await d0.timers.fire();
  assert.equal(cloud.doc('users/A/jobs/j2').notes, '[2] [3]', 'the edit won over the deletion');
  d1.putBack(was, 1);
  d1.edit('j2', { notes: '[2] [4]' }, 250);
  return { cloud, d0, d1 };
}

test('the flush: the older of the put-back edit and the account\'s is kept as a copy', async () => {
  const { cloud, d1 } = await resurrected();
  await d1.timers.fire();
  assert.deepEqual(notesInCloud(cloud).filter((n) => n.includes('[')), ['[2] [3]', '[2] [4]'], 'both edits are in the account');
  assert.equal(d1.seen.status, 'synced');
});

test('the first sync: the same', async () => {
  const { cloud, d1 } = await resurrected();
  await d1.start(A);
  assert.deepEqual(notesInCloud(cloud).filter((n) => n.includes('[')), ['[2] [3]', '[2] [4]'], 'both edits are in the account');
  assert.equal(d1.seen.status, 'synced');
});
