// H1-SYNC-10: the id of a conflict copy is made from the copied item's id and its time, so a conflict found twice is one
// copy. Two devices' DIFFERENT edits of one item can carry one time (the same millisecond on two clocks, an import
// dating a file with one `now`): the second copy met the first's id, hasTwin took it for the first (it matches an id)
// and it was never made. The edit it held was the older side of a conflict, kept nowhere else, and the winner replaced it.
// Now another content takes the next free id; the same content keeps its own (and is skipped as before).
// Found by the three-device script (410): a device with a slow clock and one with a fast clock stamped two edits alike.
// The real engine, plan and io over a fake Firestore. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { boardConflictCopy, hasTwin, jobConflictCopy } from '../../src/utils/collectionSyncConflict.js';
import { memoryMeta } from '../../src/utils/collectionSyncMeta.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';

const A = { uid: 'A', email: 'a@example.com' };

const job = (id, notes, updatedAt, extra = {}) => ({
  id, company: 'Acme', role: 'Engineer', status: 'applied', todos: [], notes,
  statusHistory: [{ status: 'applied', changedAt: 1 }], createdAt: 1, updatedAt, ...extra,
});

test('a copy of other content with the same time takes the next free id; the same content keeps its own', () => {
  const first = jobConflictCopy(job('j1', 'Y', 500));
  assert.equal(first.id, 'job_j1-conflict-500');

  const second = jobConflictCopy(job('j1', 'X', 500), [first]);
  assert.equal(second.id, 'job_j1-conflict-500-2', 'other content: its own id');
  assert.ok(!hasTwin(second, [first]), 'and it is not taken for the first');

  const again = jobConflictCopy(job('j1', 'Y', 500), [first]);
  assert.equal(again.id, first.id, 'the same content: the same copy');
  assert.ok(hasTwin(again, [first]), 'skipped as before');

  const third = jobConflictCopy(job('j1', 'W', 500), [first, second]);
  assert.equal(third.id, 'job_j1-conflict-500-3');
});

test('projects: the same', () => {
  const board = (title) => ({ id: 'b1', key: 'GRD', title, issues: [], updatedAt: 9 });
  const first = boardConflictCopy(board('Garden'), []);
  const second = boardConflictCopy(board('Garden, edited'), [first]);
  assert.notEqual(second.id, first.id);
  assert.equal(boardConflictCopy(board('Garden'), [first]).id, first.id);
});

test('two devices\' different edits of one job with one time: both older sides are kept', async () => {
  // The account holds the job as one device wrote it (X, time 500) and the copy another conflict made of a different
  // edit with that time (Y); this browser last saw the job at time 100 and has edited it since (Z, time 900).
  const cloud = fakeFirestore({
    'users/A/jobs/j1': { ...job('j1', 'X', 500), syncRev: 2, syncBy: 'dev-b' },
    'users/A/jobs/job_j1-conflict-500': { ...job('job_j1-conflict-500', 'Y', 500, { company: 'Acme (conflict copy)' }), syncRev: 1, syncBy: 'dev-c' },
    'users/A/meta/jobs': { order: ['j1', 'job_j1-conflict-500'], deleted: [] },
  });
  let list = [job('j1', 'Z', 900)];
  const listeners = new Set();
  const set = (next) => { list = next; listeners.forEach((l) => l()); };
  const store = {
    items: () => list, replace: set,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    fromCloud: (d) => d, label: (j) => j.company, conflictCopy: jobConflictCopy,
  };
  const meta = memoryMeta({ uid: 'A', versions: { j1: 100 }, revs: { j1: 1 }, device: 'dev-d', order: ['j1'], stashed: {} });
  const { report } = recorder();
  const sync = createCollectionSync({ name: 'jobs', io: collectionIo(cloud.fs, cloud.db, 'jobs'), store, meta, report, timers: manualTimers() });
  sync.start(A);
  await settle();

  const notes = [...cloud.data].filter(([p]) => p.startsWith('users/A/jobs/')).map(([, v]) => v.notes).toSorted();
  assert.deepEqual(notes, ['X', 'Y', 'Z'], 'the job and both copies');
  assert.equal(cloud.doc('users/A/jobs/j1').notes, 'Z');
  assert.equal(cloud.doc('users/A/jobs/job_j1-conflict-500').notes, 'Y', 'the copy that was there is left as it is');
});
