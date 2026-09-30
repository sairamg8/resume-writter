// R5-HUNT10-IMPORT-REPEAT-DUPLICATES: a file whose jobs have ids but no numeric updatedAt, imported
// again after the job was changed here, added one more copy of the file's version on every import
// (the id found only the edited original, never the copy an earlier import added). Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeImport } from '../../src/utils/jobImport.js';

const edit = (jobs, id, patch) => jobs.map((j) => (j.id === id ? { ...j, ...patch } : j));

for (const [label, extra] of [['no updatedAt', {}], ['an ISO updatedAt', { updatedAt: '2026-01-15T10:00:00Z' }]]) {
  test(`R5-HUNT10: re-importing a file (${label}) after an edit adds one copy, then never another`, () => {
    const file = [{ id: 'x1', company: 'Acme', role: 'Dev', status: 'applied', todos: [{ text: 'Call' }], ...extra }];
    const first = mergeImport([], file, 1000);
    assert.equal(first.added, 1);
    const edited = edit(first.jobs, 'x1', { status: 'phone-screen', notes: 'Spoke to Ann', updatedAt: 1500 });
    const second = mergeImport(edited, file, 2000);
    assert.equal(second.added, 1, 'the file\'s version is kept once: nothing is dropped');
    assert.equal(second.jobs.length, 2);
    const third = mergeImport(second.jobs, file, 3000);
    const fourth = mergeImport(third.jobs, file, 4000);
    assert.deepEqual([third.added, third.updated, third.skipped], [0, 0, 1]);
    assert.deepEqual([fourth.added, fourth.updated, fourth.skipped], [0, 0, 1]);
    assert.equal(fourth.jobs.length, 2, 'no third Acme card');
    assert.equal(fourth.jobs[0].notes, 'Spoke to Ann');
  });
}

test('R5-HUNT10: a file row that differs from every job here is still added as a copy', () => {
  const first = mergeImport([], [{ id: 'x1', company: 'Acme', role: 'Dev', status: 'applied' }], 1000);
  const edited = edit(first.jobs, 'x1', { status: 'offer' });
  const second = mergeImport(edited, [{ id: 'x1', company: 'Acme', role: 'Dev', status: 'applied' }], 2000);
  const third = mergeImport(second.jobs, [{ id: 'x1', company: 'Acme', role: 'Lead', status: 'applied' }], 3000);
  assert.equal(third.added, 1);
  assert.deepEqual(third.jobs.map((j) => j.role), ['Dev', 'Dev', 'Lead']);
});
