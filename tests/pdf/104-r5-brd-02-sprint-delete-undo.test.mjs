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

  // A sprint's default name counts the sprints the board has now, so one made while the Undo is on
  // offer can take the deleted sprint's name: the sprint that comes back takes a free one.
  it('a name another sprint took meanwhile: a default name becomes the next default, any other gets " (2)"', () => {
    const named = [
      sprint('s1', 'HOME Sprint 1', 'active'),
      sprint('s2', 'HOME Sprint 3', 'future', { goal: 'The gate' }),
      sprint('s3', 'Garden week', 'future'),
    ];
    const { a, board } = actionsOver(project({ mode: 'scrum', sprints: named, issues: issues(), nextNumber: 6 }));
    const removed = a.deleteSprint('p1', 's2');
    a.addSprint('p1');
    assert.equal(board().sprints.at(-1).name, 'HOME Sprint 3', 'the new sprint takes the deleted one\'s default name (two sprints left: 3)');
    assert.equal(a.restoreSprint('p1', removed), true);
    const names = board().sprints.map((s) => s.name);
    assert.deepEqual(names, ['HOME Sprint 1', 'HOME Sprint 4', 'Garden week', 'HOME Sprint 3'], 'the sprint back at its place, under a free name');
    const back = board().sprints.find((s) => s.id === 's2');
    assert.equal(back.goal, 'The gate');
    assert.equal(back.state, 'future');
    assert.equal(sprintIds(board()), 'i1:s2 i2:s2 i3:s2 i4:s1 i5:-');

    const garden = a.deleteSprint('p1', 's3');
    a.addSprint('p1', { name: 'garden WEEK' });
    a.addSprint('p1', { name: 'Garden week (2)' });
    a.restoreSprint('p1', garden);
    assert.equal(board().sprints.find((s) => s.id === 's3').name, 'Garden week (3)', 'case aside, and past a " (2)" taken too');
    assert.equal(new Set(board().sprints.map((s) => s.name.toLowerCase())).size, board().sprints.length, 'no two sprints share a name');
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

it('the Backlog page: Delete the last sprint, Create sprint, then Undo: two sections, two names', async () => {
  const named = [sprint('s1', 'HOME Sprint 1', 'active'), sprint('s2', 'HOME Sprint 2', 'future')];
  const page = mountBacklog(project({ mode: 'scrum', sprints: named, issues: issues(), nextNumber: 6 }));
  try {
    page.click(page.byLabel('HOME Sprint 2 actions'));
    page.click(page.item('Delete sprint'));
    await tick();
    page.click(page.button('Create sprint'));
    assert.deepEqual(boardNow().sprints.map((s) => s.name), ['HOME Sprint 1', 'HOME Sprint 2']);
    page.click(page.undoOf('HOME Sprint 2 deleted'));
    assert.deepEqual(boardNow().sprints.map((s) => s.name), ['HOME Sprint 1', 'HOME Sprint 3', 'HOME Sprint 2']);
    assert.ok(page.byLabel('HOME Sprint 3 actions') && page.byLabel('HOME Sprint 2 actions'), 'each section under its own name');
    assert.match(page.section('s2').textContent, /HOME Sprint 3.*Fix the tap.*Paint the fence.*Oil the gate/);
  } finally { await page.close(); }
});
