// R5-HUNT5-RESTORE-ISSUE-DANGLING-EPIC: restoreIssue (an issue delete's Undo) let go of a column,
// sprint or label gone since the delete, but kept the issue's epic. A child deleted before its epic
// came back linked to an epic no longer on the board: no card showed it, the Epic filter's "Issues
// without an epic" left it out, and the Parent epic picker's "None" could not clear it. It now comes
// back in no epic; an epic still on the board is kept. Run: node --test tests/unit/r5-hunt5-restore-issue-dangling-epic.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ops from '../../src/utils/boardOps.js';
import { filterIssues } from '../../src/utils/boardQuery.js';
import { createBoard } from '../../src/utils/boardModel.js';

const ctx = { now: new Date(2026, 8, 29, 10, 0).getTime() };

/** A board with epic E and its child C. */
function withEpic() {
  let b = createBoard({ title: 'Life', key: 'LIFE', template: 'kanban' }, { now: ctx.now - 1000 });
  b = ops.addIssue(b, { id: 'E', title: 'Garden', type: 'epic' }, ctx);
  return ops.addIssue(b, { id: 'C', title: 'Dig the bed', epicId: 'E' }, ctx);
}
const without = (b) => filterIssues(b, { epicIds: ['none'] }, { now: ctx.now }).map((i) => i.id);

test('a child deleted, then its epic deleted, comes back by Undo in no epic', () => {
  const b = withEpic();
  assert.equal(b.issues.find((i) => i.id === 'C').epicId, 'E');
  const child = ops.removedIssue(b, 'C');
  const gone = ops.deleteIssue(ops.deleteIssue(b, 'C'), 'E');
  const back = ops.restoreIssue(gone, child);
  assert.equal(back.issues.find((i) => i.id === 'C').epicId, null, 'the gone epic is let go');
  assert.deepEqual(without(back), ['C'], '"Issues without an epic" lists it');
});

test('a child deleted, then its epic made a task, comes back in no epic', () => {
  const b = withEpic();
  const child = ops.removedIssue(b, 'C');
  const retyped = ops.updateIssue(ops.deleteIssue(b, 'C'), 'E', { type: 'task' }, ctx);
  const back = ops.restoreIssue(retyped, child);
  assert.equal(back.issues.find((i) => i.id === 'C').epicId, null);
});

test('a child whose epic is still there comes back in it', () => {
  const b = withEpic();
  const back = ops.restoreIssue(ops.deleteIssue(b, 'C'), ops.removedIssue(b, 'C'));
  assert.equal(back.issues.find((i) => i.id === 'C').epicId, 'E');
});
