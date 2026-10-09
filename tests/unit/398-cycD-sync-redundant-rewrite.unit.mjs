// CYCD-SYNC review M4 / L1: a rev above the recorded one was always "the cloud's copy moved". A rewrite
// that changed nothing — another device (or tab) writing the item again with the same content and the very
// same updatedAt, one rev higher — then made a device with an offline edit based on the earlier rev keep a
// spurious "(conflict copy)" of the unchanged job. Now a rev bump at the updatedAt this browser saw is no
// move (no new edit). And a rev above the recorded one under this browser's own id counted as its own write
// even when the previous site had rewritten it since: now it does so only if the updatedAt is the one this
// browser handed over (when it knows it).
// The real engine, plan and io over a fake Firestore. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { jobConflictCopy } from '../../src/utils/collectionSyncConflict.js';
import { movedInCloud } from '../../src/utils/collectionSyncRev.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const job = (id, role, updatedAt) => ({
  id, company: 'Acme', role, status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});
const J1 = 'users/A/jobs/j1';

function device(cloud, name, items, { online = () => true } = {}) {
  let list = items;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => `${j.company} — ${j.role}`, conflictCopy: jobConflictCopy,
  };
  const timers = manualTimers();
  const { seen, report } = recorder();
  const notices = [];
  report.conflict = (names) => { if (names) notices.push(...names); };
  const record = { uid: null, versions: {}, revs: {}, device: name, order: null, stashed: {} };
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta: memoryMeta(record), report, online, timers });
  return {
    sync, timers, seen, notices, list: () => list,
    start: async () => { sync.start(A); await settle(); },
    edit: (id, patch, updatedAt) => set(list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt } : x))),
  };
}

test('a redundant rewrite by another device is no move: an offline edit based on the earlier rev makes no conflict copy', async () => {
  const cloud = fakeFirestore();
  const a = device(cloud, 'dev-a', [job('j1', 'Engineer', 1)]);
  await a.start();
  let online = true;
  const e = device(cloud, 'dev-e', [], { online: () => online });
  await e.start();
  online = false;
  await e.start();
  e.edit('j1', { role: 'Staff Engineer' }, 30);

  // Meanwhile device a writes the same job again: same content, same updatedAt, one rev higher.
  cloud.data.set(J1, { ...job('j1', 'Engineer', 1), syncRev: 2, syncBy: 'dev-a' });
  online = true;
  await e.start();

  assert.deepEqual(e.list().map((j) => j.id), ['j1'], 'no copy of the unchanged job');
  assert.deepEqual(e.notices, []);
  assert.equal(e.list()[0].role, 'Staff Engineer');
  assert.equal(cloud.doc(J1).role, 'Staff Engineer', 'and the edit is sent');
  assert.equal([...cloud.data.keys()].filter((p) => p.startsWith('users/A/jobs/')).length, 1);
});

test('movedInCloud: a rev bump at the seen time is no move; a bump with a new time is; this browser\'s own write only at the time it handed over', () => {
  const base = { baseRev: 1, baseTime: 5, device: 'dev-b' };
  assert.equal(movedInCloud({ ...base, stamp: { rev: 2, by: 'dev-a', at: 5 }, updatedAt: 5 }), false, 'same updatedAt: nothing new');
  assert.equal(movedInCloud({ ...base, stamp: { rev: 2, by: 'dev-a', at: 9 }, updatedAt: 9 }), true, 'a new edit');
  assert.equal(movedInCloud({ ...base, stamp: { rev: 2, by: 'dev-b', at: 9 }, updatedAt: 9 }), false, 'this browser\'s own write, time not known (a lost record): its own');
  assert.equal(movedInCloud({ ...base, stamp: { rev: 2, by: 'dev-b', at: 9 }, updatedAt: 9, ownTime: 9 }), false, 'its own, at the time it handed over');
  assert.equal(movedInCloud({ ...base, stamp: { rev: 2, by: 'dev-b', at: 12 }, updatedAt: 12, ownTime: 9 }), true, 'rewritten since by a writer that keeps the fields (the previous site)');
});
