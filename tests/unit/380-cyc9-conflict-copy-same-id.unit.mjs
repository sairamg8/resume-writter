// CYC9-H1: the conflict copy of a job or project was made under newId(), so two tabs (or two
// devices coming online together) that found the same conflict each made their own copy, and the
// twin guard (same content under ANOTHER id) saw nothing before the other's copy arrived: two
// identical "(conflict copy)" items in every list. Now the copy's id is made from what it is a
// copy of — the older version's id and updatedAt — so the same conflict is the same document
// wherever it is found: written twice, it is one, and the twin guard matches by id too.
// The real plan, engine and io over a fake Firestore two tabs share. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { planFirstSync } from '../../src/utils/collectionSyncPlan.js';
import { boardConflictCopy, hasTwin, jobConflictCopy } from '../../src/utils/collectionSyncConflict.js';
import { createBoard } from '../../src/utils/boardModel.js';
import { deferred, fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };
const job = (id, company, role, updatedAt) => ({
  id, company, role, status: 'applied', todos: [],
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt,
});
const cloudJobs = (cloud) => [...cloud.data.keys()].filter((p) => p.startsWith('users/A/jobs/'));

test('the same older copy gets the same id every time, with the usual prefix and characters', () => {
  const older = job('job_1f2e3d4c-aaaa-bbbb-cccc-1234567890ab', 'Acme', 'Lead Engineer', 20);
  const first = jobConflictCopy(older);
  const second = jobConflictCopy({ ...older });
  assert.equal(first.id, second.id, 'made twice: the same id');
  assert.match(first.id, /^job_[\w-]+$/);
  assert.notEqual(first.id, older.id);
  assert.notEqual(jobConflictCopy({ ...older, updatedAt: 21 }).id, first.id, 'another older version, another copy');
  assert.match(jobConflictCopy(job('odd/id', 'Acme', 'x', 20)).id, /^job_[\w-]+$/, 'no "/" in the copy\'s id');
  assert.equal(jobConflictCopy(job('', 'Acme', 'x', 20)).id.startsWith('job_'), true, 'no id to go by: still a job_ id');

  const board = { ...createBoard({ title: 'Roadmap', key: 'RD' }, { now: 5 }), id: 'board_9f8e7d6c-1111-2222-3333-abcdefabcdef', updatedAt: 20 };
  const one = boardConflictCopy(board, [board]);
  const two = boardConflictCopy(board, [board]);
  assert.equal(one.id, two.id);
  assert.match(one.id, /^board_[\w-]+$/);
  assert.equal(one.title, 'Roadmap (conflict copy)');
});

test('the twin guard also matches a copy by its id', () => {
  const copy = jobConflictCopy(job('j1', 'Acme', 'Lead Engineer', 20));
  assert.equal(hasTwin(copy, [{ ...copy, role: 'edited since' }]), true, 'the copy is there already (and may have been edited): not made again');
  assert.equal(hasTwin(copy, [job('j1', 'Acme', 'Staff', 30)]), false);
});

test('the same conflict planned twice yields the same one copy', () => {
  const input = (docs) => ({
    local: [job('j1', 'Acme', 'Staff Engineer', 30)], versions: { j1: 1 },
    docs, order: ['j1'], baseOrder: ['j1'], copyOf: jobConflictCopy,
  });
  const theirs = job('j1', 'Acme', 'Lead Engineer', 20);
  const a = planFirstSync(input([theirs]));
  const b = planFirstSync(input([theirs]));
  assert.equal(a.conflicts.length, 1);
  assert.equal(a.conflicts[0].copy.id, b.conflicts[0].copy.id);
  // The other tab's plan, run once the first has written the copy: it is in the account already.
  const copy = a.conflicts[0].copy;
  const again = planFirstSync(input([theirs, copy]));
  assert.equal(again.conflicts.length, 0, 'not made a second time');
  assert.deepEqual(again.merged.map((x) => x.id), ['j1', copy.id]);
});

/** One tab of a browser signed in as A, its list and sync record its own, over `cloud`. */
function tab(cloud, items, seen = Object.fromEntries(items.map((x) => [x.id, x.updatedAt]))) {
  let list = items;
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => [j.company, j.role].filter(Boolean).join(' — '),
    conflictCopy: jobConflictCopy,
  };
  const timers = manualTimers();
  const { report } = recorder();
  const meta = memoryMeta({ uid: 'A', versions: seen, order: items.map((x) => x.id), stashed: {} });
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta, report, timers });
  return {
    sync, timers,
    ids: () => list.map((x) => x.id),
    edit: (id, patch, updatedAt) => set(list.map((x) => (x.id === id ? { ...x, ...patch, updatedAt } : x))),
  };
}

/** An account holding job j1 as the other device last edited it (t=20). */
const accountWithJob = () => fakeFirestore({
  'users/A/jobs/j1': job('j1', 'Acme', 'Lead Engineer', 20),
  'users/A/meta/jobs': { order: ['j1'], deleted: [] },
});

test('two tabs coming online together (first sync) make one copy, not two', async () => {
  const cloud = accountWithJob();
  // Both last synced j1 at t=1 and both edited it since (t=30); the account holds t=20.
  const one = tab(cloud, [job('j1', 'Acme', 'Staff Engineer', 30)], { j1: 1 });
  const two = tab(cloud, [job('j1', 'Acme', 'Staff Engineer', 30)], { j1: 1 });
  const read = deferred();
  cloud.hold.read = read.promise; // both read the account before either writes
  one.sync.start(A);
  two.sync.start(A);
  await settle();
  read.resolve();
  await settle(10);

  assert.equal(cloudJobs(cloud).length, 2, 'the job and ONE copy in the account');
  assert.equal(one.ids().length, 2);
  assert.deepEqual(one.ids(), two.ids(), 'both tabs hold the same two ids');
  assert.deepEqual(cloud.doc('users/A/meta/jobs').order, one.ids());
});

test('two tabs flushing the same conflict together make one copy, not two', async () => {
  const cloud = accountWithJob();
  const one = tab(cloud, [job('j1', 'Acme', 'Lead Engineer', 20)]);
  const two = tab(cloud, [job('j1', 'Acme', 'Lead Engineer', 20)]);
  one.sync.start(A);
  two.sync.start(A);
  await settle(10);
  one.edit('j1', { role: 'Staff Engineer' }, 30);
  two.edit('j1', { role: 'Staff Engineer' }, 30);
  // The other device edits again before either sends: the account holds t=25, newer than the t=20 both saw.
  cloud.data.set('users/A/jobs/j1', job('j1', 'Acme', 'Principal Engineer', 25));
  const read = deferred();
  cloud.hold.read = read.promise;
  await one.timers.fire();
  await two.timers.fire();
  read.resolve();
  await settle(10);

  assert.equal(cloudJobs(cloud).length, 2, 'the job and ONE copy in the account');
  assert.equal(cloud.doc('users/A/jobs/j1').role, 'Staff Engineer');
  assert.equal(one.ids().length, 2);
  assert.deepEqual(one.ids(), two.ids());
});
