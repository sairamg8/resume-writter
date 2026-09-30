// R5-HUNT9-POINT-SUMS-FLOAT-NOISE: an estimate is any number ≥ 0, and the backlog's point
// bubbles and the Epic panel added them as raw floats — 0.1 + 0.2 read '0.30000000000000004'.
// The totals are now rounded to 2 decimals for display. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as q from '../../src/utils/boardQuery.js';
import { createBoard } from '../../src/utils/boardModel.js';

const NOW = new Date(2026, 8, 23, 10, 0).getTime();

function board(estimates, { epic = false } = {}) {
  const b = createBoard({ title: 'Life', key: 'LIFE' }, { now: NOW });
  const columns = [
    { id: 'todo', title: 'To Do', category: 'todo', wipLimit: null },
    { id: 'doing', title: 'In Progress', category: 'inprogress', wipLimit: null },
    { id: 'done', title: 'Done', category: 'done', wipLimit: null },
  ];
  const base = { type: 'task', priority: 'medium', labels: [], sprintId: null, createdAt: NOW, updatedAt: NOW };
  const issues = estimates.map(([estimate, columnId], n) => ({
    ...base, id: `i${n}`, number: n + 2, title: `Issue ${n}`, columnId, estimate, epicId: epic ? 'e1' : null,
  }));
  if (epic) issues.unshift({ ...base, id: 'e1', number: 1, type: 'epic', title: 'Epic', columnId: 'todo', estimate: null, epicId: null });
  return { ...b, columns, issues };
}

test('the point bubbles round a sum of decimal estimates', () => {
  const b = board([[0.1, 'todo'], [0.2, 'todo'], [1.1, 'doing'], [2.2, 'doing'], [0.7, 'done'], [0.1, 'done']]);
  const sum = q.pointsByCategory(b, b.issues);
  assert.deepEqual(sum, { todo: 0.3, inprogress: 3.3, done: 0.8 });
  assert.equal(String(sum.todo), '0.3');
});

test('issueStats (the Epic panel line and section totals) rounds its point sums', () => {
  const b = board([[0.1, 'done'], [0.2, 'done']], { epic: true });
  const p = q.epicProgress(b, 'e1');
  assert.equal(`${p.donePoints}/${p.points}`, '0.3/0.3');
  const s = q.issueStats(b, b.issues.filter((i) => i.type !== 'epic'));
  assert.equal(s.points, 0.3);
  assert.equal(s.donePoints, 0.3);
});

test('whole and half points add as before', () => {
  const b = board([[0.5, 'todo'], [1.5, 'todo'], [3, 'done'], [null, 'done']]);
  assert.deepEqual(q.pointsByCategory(b, b.issues), { todo: 2, inprogress: 0, done: 3 });
});
