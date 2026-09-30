// R5-HUNT10 review: a file whose jobs have ids but no numeric updatedAt, and interviews with no id,
// added one more copy of each such job on every import — even the same file, unchanged. completeJob
// gives an id-less interview a new id each time, and mergeImport's comparison (asOver) took the
// to-dos' ids from the job here but not the interviews', so the file's job never matched it.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeImport } from '../../src/utils/jobImport.js';

const file = [{
  id: 'x1', company: 'Acme', role: 'Dev', status: 'interview',
  interviews: [{ date: '2026-10-01', kind: 'Phone', notes: 'Ann' }, { date: '2026-10-08', kind: 'Onsite' }],
}];

test('R5-HUNT10 review: the same timeless file with id-less interviews, imported again, adds nothing', () => {
  const first = mergeImport([], file, 1000);
  assert.equal(first.added, 1);
  const again = mergeImport(first.jobs, file, 2000);
  assert.deepEqual([again.added, again.updated, again.skipped], [0, 0, 1]);
  assert.equal(again.jobs.length, 1, 'no second Acme card');
});

test('R5-HUNT10 review: after an edit, the file\'s version with id-less interviews is kept once, then skipped', () => {
  const first = mergeImport([], file, 1000);
  const edited = first.jobs.map((j) => ({ ...j, notes: 'Offer soon', updatedAt: 1500 }));
  const second = mergeImport(edited, file, 2000);
  assert.equal(second.added, 1, 'the file\'s version is kept once: nothing is dropped');
  const third = mergeImport(second.jobs, file, 3000);
  const fourth = mergeImport(third.jobs, file, 4000);
  assert.deepEqual([third.added, fourth.added], [0, 0]);
  assert.equal(fourth.jobs.length, 2, 'no third Acme card');
  assert.deepEqual(fourth.jobs[1].interviews.map((iv) => iv.id), second.jobs[1].interviews.map((iv) => iv.id));
});

test('R5-HUNT10 review: an interview the file changed still makes the job a copy', () => {
  const first = mergeImport([], file, 1000);
  const changed = [{ ...file[0], interviews: [{ ...file[0].interviews[0], notes: 'Bob' }, file[0].interviews[1]] }];
  const again = mergeImport(first.jobs, changed, 2000);
  assert.equal(again.added, 1);
  assert.deepEqual(again.jobs.map((j) => j.interviews[0].notes), ['Ann', 'Bob']);
});
