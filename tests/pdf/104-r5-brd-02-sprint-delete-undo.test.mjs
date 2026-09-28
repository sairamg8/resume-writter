// R5-BRD-02: a sprint's delete ("⋯ > Delete sprint") toasted '<Sprint> deleted' with no Undo; its
// name, dates, goal and state were gone, and which issues were in it, while an issue's and a
// project's delete both offer Undo. Now the toast has Undo: the sprint comes back at its place as it
// was, with its issues that are still in the backlog (one moved elsewhere since stays where it is).
// A deleted active sprint comes back future when another was started meanwhile, so a project never
// has two active. The store's actions over an in-memory list (createBoardActions); the real
// Backlog page over tests/pdf/fake-dom.mjs (104-r5-brd-helpers.mjs). Fictional data only.
// Run: node --test tests/pdf/104-r5-brd-02-sprint-delete-undo.test.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { createBoardActions } from '../../src/utils/boardActions.js';
import { boardNow, issue, load, mountBacklog, project, sprint, tick } from './104-r5-brd-helpers.mjs';

before(async () => { await setup(); await load(); });
after(teardown);

const sprints = () => [
  sprint('s1', 'Sprint 1', 'active', { goal: 'The fence', startDate: '2026-09-21', endDate: '2026-10-05' }),
  sprint('s2', 'Sprint 2', 'future', { goal: 'The gate', startDate: '2026-10-06', endDate: '2026-10-20' }),
  sprint('s3', 'Sprint 3', 'future'),
];
const issues = () => [
  issue('i1', 1, 'Fix the tap', 'c1', { sprintId: 's2' }),
  issue('i2', 2, 'Paint the fence', 'c1', { sprintId: 's2' }),
  issue('i3', 3, 'Oil the gate', 'c1', { sprintId: 's2' }),
  issue('i4', 4, 'Buy nails', 'c1', { sprintId: 's1' }),
  issue('i5', 5, 'Sweep the yard', 'c1', { sprintId: null }),
];

function actionsOver(board) {
  let list = [board];
  const a = createBoardActions({ boardsNow: () => list, setBoards: (fn) => { list = fn(list); }, now: () => 1 });
  return { a, board: () => list[0] };
}
const sprintIds = (b) => b.issues.map((i) => `${i.id}:${i.sprintId ?? '-'}`).join(' ');

describe('R5-BRD-02: the store puts a deleted sprint back', () => {
  it('a future sprint with three issues: back at its place, as it was, its issues in it', () => {
    const original = project({ mode: 'scrum', sprints: sprints(), issues: issues(), nextNumber: 6 });
    const { a, board } = actionsOver(original);
    const removed = a.deleteSprint('p1', 's2');
    assert.ok(removed, 'the delete returns what Undo needs');
    assert.deepEqual(board().sprints.map((s) => s.id), ['s1', 's3']);
    assert.equal(a.restoreSprint('p1', removed), true);
    assert.deepEqual(board().sprints, original.sprints, 'name, dates, goal, state and place');
    assert.equal(sprintIds(board()), sprintIds(original));
    assert.equal(a.restoreSprint('p1', removed), false, 'restored twice: once');
  });

  it('an issue moved elsewhere meanwhile stays there; an active sprint comes back future once another started', () => {
    const { a, board } = actionsOver(project({ mode: 'scrum', sprints: sprints(), issues: issues(), nextNumber: 6 }));
    const future = a.deleteSprint('p1', 's2');
    a.moveIssue('p1', 'i1', { sprintId: 's3' });
    a.restoreSprint('p1', future);
    assert.equal(sprintIds(board()), 'i1:s3 i2:s2 i3:s2 i4:s1 i5:-');

    const active = a.deleteSprint('p1', 's1');
    a.startSprint('p1', 's3', {});
    assert.equal(a.restoreSprint('p1', active), true);
    const b = board();
    assert.equal(b.sprints.find((s) => s.id === 's1').state, 'future', 'not a second active sprint');
    assert.deepEqual(b.sprints.filter((s) => s.state === 'active').map((s) => s.id), ['s3']);
    assert.equal(b.issues.find((i) => i.id === 'i4').sprintId, 's1');
  });
});

it('the Backlog page: Delete sprint, then the toast\'s Undo brings the sprint section and its issues back', async () => {
  const page = mountBacklog(project({ mode: 'scrum', sprints: sprints(), issues: issues(), nextNumber: 6 }));
  try {
    page.click(page.byLabel('Sprint 2 actions'));
    page.click(page.item('Delete sprint'));
    await tick();
    assert.ok(!page.section('s2'), 'the sprint is deleted');
    page.click(page.undoOf('Sprint 2 deleted'));
    assert.ok(page.section('s2'), 'the sprint section is back');
    assert.match(page.section('s2').textContent, /Fix the tap.*Paint the fence.*Oil the gate/);
    assert.match(page.section('s2').textContent, /\(3 issues\)/);
    assert.equal(boardNow().sprints.find((s) => s.id === 's2').goal, 'The gate');
  } finally { await page.close(); }
});
