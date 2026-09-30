// R5-HUNT11: a timeless jobs file whose to-dos or interviews have numeric ids (how other trackers
// export them), or ids an earlier entry already used, added one more copy of each such job on every
// import. completeJob gives each such entry a new id, and mergeImport's comparison (asOver) kept that
// new id because the file had given one, so the file's job never matched the copy saved before.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeImport } from '../../src/utils/jobImport.js';

const thrice = (file) => {
  const first = mergeImport([], file, 1000);
  assert.equal(first.added, 1);
  const again = mergeImport(first.jobs, file, 2000);
  const third = mergeImport(again.jobs, file, 3000);
  return { first, again, third };
};

test('R5-HUNT11: to-dos with numeric ids, imported again, add nothing', () => {
  const { again, third } = thrice([{ id: 'j1', company: 'Acme', role: 'Dev', status: 'applied', todos: [{ id: 1, text: 'Prep', done: false }] }]);
  assert.deepEqual([again.added, again.updated, again.skipped], [0, 0, 1]);
  assert.equal(third.jobs.length, 1, 'no second Acme card');
});

test('R5-HUNT11: interviews with numeric ids, imported again, add nothing', () => {
  const { again, third } = thrice([{ id: 'j1', company: 'Acme', role: 'Dev', status: 'interview', interviews: [{ id: 7, date: '2026-10-01' }] }]);
  assert.equal(again.added, 0);
  assert.equal(third.jobs.length, 1);
});

test('R5-HUNT11: to-dos sharing one id, imported again, add nothing', () => {
  const { again, third } = thrice([{ id: 'j1', company: 'Acme', role: 'Dev', todos: [{ id: 'a', text: 'x' }, { id: 'a', text: 'y' }] }]);
  assert.equal(again.added, 0);
  assert.equal(third.jobs.length, 1);
});

test('R5-HUNT11: after an edit, the file\'s version with numeric to-do ids is kept once, then skipped', () => {
  const file = [{ id: 'j1', company: 'Acme', role: 'Dev', todos: [{ id: 1, text: 'Prep' }] }];
  const first = mergeImport([], file, 1000);
  const edited = first.jobs.map((j) => ({ ...j, notes: 'Offer soon', updatedAt: 1500 }));
  const second = mergeImport(edited, file, 2000);
  assert.equal(second.added, 1, 'the file\'s version is kept once: nothing is dropped');
  const third = mergeImport(second.jobs, file, 3000);
  assert.equal(third.added, 0);
  assert.equal(third.jobs.length, 2, 'no third Acme card');
});

test('R5-HUNT11: a to-do the file changed still makes the job a copy', () => {
  const file = [{ id: 'j1', company: 'Acme', role: 'Dev', todos: [{ id: 1, text: 'Prep' }] }];
  const first = mergeImport([], file, 1000);
  const again = mergeImport(first.jobs, [{ ...file[0], todos: [{ id: 1, text: 'Call Ann' }] }], 2000);
  assert.equal(again.added, 1);
});
