// R5-HUNT5-SCRUM-BACKLOG-FOOT-DROP-ABOVE-CLOSED-SPRINT-ROWS: a Scrum backlog section also lists the
// open issues still in a closed sprint (reopened after it closed). A drop at the section's foot sends
// moveIssue { sprintId: null, beforeId: null }, which ranked the row after the last issue in no sprint
// at all: it landed above such a reopened issue, or, already the last issue in no sprint, did not
// move. Now the backlog is every issue in no open sprint, as its section shows, and the row lands at
// its foot. Run: node --test tests/unit/r5-hunt5-scrum-backlog-foot-drop.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ops from '../../src/utils/boardOps.js';
import { backlogSections } from '../../src/utils/boardQuery.js';
import { createBoard } from '../../src/utils/boardModel.js';

const ctx = { now: new Date(2026, 8, 29, 10, 0).getTime() };

/** A Scrum board: issues `ids` in To Do, in that rank; Q reopened, still in closed sprint S; A in active sprint T. */
function scrum(ids) {
  let b = createBoard({ title: 'Life', key: 'LIFE', template: 'scrum' }, { now: ctx.now - 1000 });
  b = { ...b, mode: 'scrum', sprints: [
    { id: 'S', name: 'Sprint 1', goal: '', startDate: '', endDate: '', state: 'closed', completedAt: 1 },
    { id: 'T', name: 'Sprint 2', goal: '', startDate: '', endDate: '', state: 'active', completedAt: null },
  ] };
  for (const id of ids) b = ops.addIssue(b, { id, title: id }, ctx);
  const sprintOf = { Q: 'S', A: 'T' };
  return { ...b, issues: b.issues.map((i) => (sprintOf[i.id] ? { ...i, sprintId: sprintOf[i.id] } : i)) };
}
const backlog = (b) => backlogSections(b).find((s) => s.kind === 'backlog').issues.map((i) => i.id);

test('a drop at the backlog\'s foot lands below a reopened issue of a closed sprint', () => {
  const b = scrum(['R', 'P', 'Q']);
  assert.deepEqual(backlog(b), ['R', 'P', 'Q'], 'the section shows Q, in the closed sprint');
  const next = ops.moveIssue(b, 'R', { sprintId: null, beforeId: null }, ctx);
  assert.deepEqual(backlog(next), ['P', 'Q', 'R']);
});

test('the last issue in no sprint dropped at the foot still moves below the reopened one', () => {
  const b = scrum(['P', 'R', 'Q']);
  const next = ops.moveIssue(b, 'R', { sprintId: null, beforeId: null }, ctx);
  assert.notEqual(next, b, 'the drop is not a no-op');
  assert.deepEqual(backlog(next), ['P', 'Q', 'R']);
});

test('a sprint\'s issue moved to the backlog lands at its foot too; a drop at the foot of its last row is a no-op', () => {
  const b = scrum(['A', 'P', 'Q']);
  const next = ops.moveIssue(b, 'A', { sprintId: null, beforeId: null }, ctx);
  assert.deepEqual(backlog(next), ['P', 'Q', 'A']);
  assert.equal(next.issues.find((i) => i.id === 'A').sprintId, null);
  assert.equal(ops.moveIssue(next, 'A', { sprintId: null, beforeId: null }, ctx), next);
});

test('a drop at the foot of the active sprint still ranks among that sprint\'s issues only', () => {
  const b = scrum(['A', 'P', 'Q']);
  const next = ops.moveIssue(b, 'P', { sprintId: 'T', beforeId: null }, ctx);
  assert.deepEqual(next.issues.map((i) => i.id), ['A', 'P', 'Q']);
  assert.equal(next.issues.find((i) => i.id === 'P').sprintId, 'T');
});
