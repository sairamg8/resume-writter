// H1-SYNC-12: what is kept aside when an account signs out (its unsent edits) joins the list at its next sign-in, but an
// item the list already had under the same id won: "the list's own" copy replaced the kept-aside one whole. A file
// imported again while signed out (an import keeps the file's ids) put the file's copy there, and the edit kept aside
// was dropped with no word. Now the later of the two stays and the other is kept as a conflict copy, but for a copy the
// account holds already (the file's, unedited, is that). Found by the three-device script (410).
// The real engine, plan and io over a fake Firestore. Run: yarn test:unit
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

function device(cloud, items) {
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
  const net = { online: true };
  const sync = createCollectionSync({
    name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: memoryMeta(), report, timers, online: () => net.online,
  });
  return {
    seen, net,
    notes: () => list.map((x) => x.notes).toSorted(),
    start: async (user) => { sync.start(user); await settle(); },
    set,
    edit: (id, patch, updatedAt) => set(list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt } : x))),
  };
}
const notesInCloud = (cloud) => [...cloud.data].filter(([p]) => p.startsWith('users/A/jobs/')).map(([, v]) => v.notes).toSorted();

/** j1 synced, edited offline and the account signed out (the edit kept aside); the signed-out list then has j1 from a file. */
async function signedOutWithImport(importedNotes) {
  const cloud = fakeFirestore();
  const d = device(cloud, [job('j1', 'original', 1)]);
  await d.start(A);
  d.net.online = false;
  await d.start(A);
  d.edit('j1', { notes: 'original [edit]' }, 300);
  await d.start(null);
  assert.deepEqual(d.notes(), [], 'the list left with the account');
  d.set([job('j1', importedNotes, 50)]); // the file imported again, signed out
  d.net.online = true;
  return { cloud, d };
}

test('the edit kept aside is not dropped for a file imported again, when the file\'s copy is what the account holds', async () => {
  const { cloud, d } = await signedOutWithImport('original');
  await d.start(A);
  assert.deepEqual(notesInCloud(cloud), ['original [edit]'], 'the edit stays, and no copy of the unedited file');
  assert.deepEqual(d.notes(), ['original [edit]']);
  assert.equal(d.seen.status, 'synced');
});

test('a file\'s copy the account does not hold is kept as a copy beside the edit', async () => {
  const { cloud, d } = await signedOutWithImport('from the file');
  await d.start(A);
  assert.deepEqual(notesInCloud(cloud), ['from the file', 'original [edit]']);
  assert.deepEqual(d.notes(), ['from the file', 'original [edit]']);
  assert.equal(d.seen.status, 'synced');
});
