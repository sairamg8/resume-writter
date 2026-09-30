// R5-HUNT11: a timeless jobs file whose entries have "todos": null added one more copy of each such
// job on every import. The job is saved with todos: null, and mergeImport's comparison (asOver) made
// the file's copy todos: [], so the two never matched.
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeImport } from '../../src/utils/jobImport.js';

const file = [{ id: 'j2', company: 'Beta', role: 'PM', todos: null }];

test('R5-HUNT11: a file with todos: null, imported again, adds nothing', () => {
  const first = mergeImport([], file, 1000);
  assert.equal(first.added, 1);
  const again = mergeImport(first.jobs, file, 2000);
  assert.deepEqual([again.added, again.updated, again.skipped], [0, 0, 1]);
  const third = mergeImport(again.jobs, file, 3000);
  assert.equal(third.jobs.length, 1, 'no second Beta card');
});

test('R5-HUNT11: after an edit, the file\'s version with todos: null is kept once, then skipped', () => {
  const first = mergeImport([], file, 1000);
  const edited = first.jobs.map((j) => ({ ...j, notes: 'Called', updatedAt: 1500 }));
  const second = mergeImport(edited, file, 2000);
  assert.equal(second.added, 1, 'the file\'s version is kept once: nothing is dropped');
  const third = mergeImport(second.jobs, file, 3000);
  assert.equal(third.added, 0);
  assert.equal(third.jobs.length, 2, 'no third Beta card');
});

// Review: a to-do added then deleted leaves the saved job with todos: [], and the file's null then
// never matched it, so the import added the job again (it was skipped before the fix above).
test('R5-HUNT11 review: todos: null in the file matches a saved job whose to-dos were emptied', () => {
  const first = mergeImport([], file, 1000);
  const emptied = first.jobs.map((j) => ({ ...j, todos: [] }));
  const again = mergeImport(emptied, file, 2000);
  assert.deepEqual([again.added, again.updated, again.skipped], [0, 0, 1]);
  assert.equal(again.jobs.length, 1, 'no second Beta card');
});

test('R5-HUNT11 review: a file with todos: [] matches a job saved with todos: null', () => {
  const first = mergeImport([], file, 1000);
  const again = mergeImport(first.jobs, [{ ...file[0], todos: [] }], 2000);
  assert.equal(again.added, 0);
  assert.equal(again.jobs.length, 1);
});
