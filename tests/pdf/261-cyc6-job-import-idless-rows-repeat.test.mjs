// Importing the same job file twice must not add its jobs twice. A row with no usable id (another
// tool's export, a hand-made list, ids that are numbers) had no id to find its job by, so the merge
// added every such row again on each import, each under a new id. Such a row now matches the job an
// earlier import added from it (same fields, to-dos and interviews); a row that differs is still added.
// Run: node --test tests/pdf/261-cyc6-job-import-idless-rows-repeat.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const FILE = [
  { company: 'Acme', role: 'Dev', status: 'Applied', todos: [{ text: 'Call' }], notes: 'line one\nline two' },
  { id: 7, company: 'Beta', role: 'PM', salary: 120000 },
  { id: '', company: 'Gamma', role: 'QA', interviews: [{ date: '2026-10-01', kind: 'HR Round' }] },
];

it('an id-less file imported again adds nothing, however often', async () => {
  const { mergeImport } = await loadModule('/src/utils/jobMerge.js');
  const first = mergeImport([], FILE, 1000);
  assert.deepEqual([first.added, first.updated, first.skipped], [3, 0, 0]);
  const second = mergeImport(first.jobs, FILE, 2000);
  const third = mergeImport(second.jobs, FILE, 3000);
  assert.deepEqual([second.added, second.updated, second.skipped], [0, 0, 3]);
  assert.deepEqual([third.added, third.updated, third.skipped], [0, 0, 3]);
  assert.deepEqual(third.jobs.map((j) => j.id), first.jobs.map((j) => j.id), 'the jobs are the first import\'s, untouched');
  assert.equal(third.jobs.length, 3);
});

it('a row that differs from the job here is still added, and then not again', async () => {
  const { mergeImport } = await loadModule('/src/utils/jobMerge.js');
  const first = mergeImport([], [{ company: 'Acme', role: 'Dev' }], 1000);
  const changed = [{ company: 'Acme', role: 'Dev', location: 'Berlin' }];
  const second = mergeImport(first.jobs, changed, 2000);
  assert.deepEqual([second.added, second.skipped], [1, 0]);
  const third = mergeImport(second.jobs, changed, 3000);
  assert.deepEqual([third.added, third.skipped], [0, 1]);
  assert.equal(third.jobs.length, 2);
});

it('two equal rows in one file are both added (once), and both skipped when the file comes again', async () => {
  const { mergeImport } = await loadModule('/src/utils/jobMerge.js');
  const twice = [{ company: 'Dup', role: 'Dev' }, { company: 'Dup', role: 'Dev' }];
  const first = mergeImport([], twice, 1000);
  assert.equal(first.added, 2);
  const second = mergeImport(first.jobs, twice, 2000);
  assert.deepEqual([second.added, second.skipped], [0, 2]);
  assert.equal(second.jobs.length, 2);
});
