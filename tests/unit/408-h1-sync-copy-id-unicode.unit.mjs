// H1-SYNC-9: the id of a conflict copy is made from the id of the item and its time (so two devices that find one
// conflict make one copy), keeping the characters ids use and replacing the others. Two ids that differ only in
// those others ("ジョブ" and "仕事" from an imported file, "job.1" and "job_1") gave one copy id when their times were
// equal (an import dates every job of a file without times with one `now`); the second copy was taken for the
// first (hasTwin matches an id) and never made, and the older side of the second conflict was dropped. Now an id
// with something replaced carries a short mark of the id as it was; every other id is made as it always was.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardConflictCopy, hasTwin, jobConflictCopy } from '../../src/utils/collectionSyncConflict.js';

const job = (id, role = 'Engineer', updatedAt = 7) => ({ id, company: 'Acme', role, status: 'applied', todos: [], updatedAt });

test('ids that differ only in the characters a copy id replaces make copies with ids of their own', () => {
  for (const [a, b] of [['ジョブ', '仕事'], ['job.1', 'job_1'], ['café', 'cafè'], ['a b', 'a/b']]) {
    const one = jobConflictCopy(job(a, 'Engineer'));
    const two = jobConflictCopy(job(b, 'Designer'));
    assert.notEqual(one.id, two.id, `${a} and ${b}`);
    assert.ok(!hasTwin(two, [job(a, 'Engineer'), one]), 'the second copy is not taken for the first');
  }
});

test('the copy id follows the item: the same on every device, and a path the cloud can name', () => {
  const again = jobConflictCopy(job('ジョブ')).id;
  assert.equal(jobConflictCopy(job('ジョブ')).id, again);
  assert.match(again, /^job_[\w-]+-conflict-7$/);
  assert.match(boardConflictCopy({ id: 'プロジェクト', title: 'Garden', key: 'GRD', updatedAt: 9 }).id, /^board_[\w-]+-conflict-9$/);
});

test('an id with nothing replaced makes the copy id it always made', () => {
  assert.equal(jobConflictCopy(job('j1')).id, 'job_j1-conflict-7');
  assert.equal(jobConflictCopy(job('job_abc-123')).id, 'job_abc-123-conflict-7');
  assert.equal(boardConflictCopy({ id: 'board_x', title: 'Garden', key: 'GRD', updatedAt: 9 }).id, 'board_x-conflict-9');
});
