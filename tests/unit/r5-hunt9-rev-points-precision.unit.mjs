// R5-HUNT9-REV-POINTS-ROUNDED-2DP: the fix for float noise in point totals rounded every sum to a
// fixed 2 decimals, so an estimate typed with more places was misread in the totals — a lone
// 0.125-point issue read 0.13 in its section's bubble (its own pill reads 0.125), and 0.004 read 0,
// which hid the Epic panel's points line. The sum is now the exact decimal total. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as q from '../../src/utils/boardQuery.js';
import { createBoard } from '../../src/utils/boardModel.js';

const NOW = new Date(2026, 8, 23, 10, 0).getTime();

function board(estimates) {
  const b = createBoard({ title: 'Life', key: 'LIFE' }, { now: NOW });
  const columns = [
    { id: 'todo', title: 'To Do', category: 'todo', wipLimit: null },
    { id: 'doing', title: 'In Progress', category: 'inprogress', wipLimit: null },
    { id: 'done', title: 'Done', category: 'done', wipLimit: null },
  ];
  const base = { type: 'task', priority: 'medium', labels: [], sprintId: null, createdAt: NOW, updatedAt: NOW };
  const issues = estimates.map(([estimate, columnId], n) => ({
    ...base, id: `i${n}`, number: n + 2, title: `Issue ${n}`, columnId, estimate, epicId: 'e1',
  }));
  issues.unshift({ ...base, id: 'e1', number: 1, type: 'epic', title: 'Epic', columnId: 'todo', estimate: null, epicId: null });
  return { ...b, columns, issues };
}

test('the point bubbles keep an estimate typed with three or more decimals', () => {
  const b = board([[0.125, 'todo'], [0.004, 'doing'], [0.0625, 'done'], [0.0625, 'done']]);
  const children = b.issues.filter((i) => i.type !== 'epic');
  assert.deepEqual(q.pointsByCategory(b, children), { todo: 0.125, inprogress: 0.004, done: 0.125 });
});

test('the Epic panel and section totals keep them too, and a tiny total is not read as none', () => {
  const b = board([[0.004, 'todo'], [0.001, 'done']]);
  const p = q.epicProgress(b, 'e1');
  assert.equal(`${p.donePoints}/${p.points}`, '0.001/0.005');
  const s = q.issueStats(b, b.issues.filter((i) => i.type !== 'epic'));
  assert.equal(s.points, 0.005);
});

test('float noise is still gone', () => {
  const b = board([[0.1, 'todo'], [0.2, 'todo'], [0.125, 'done'], [0.25, 'done'], [null, 'done']]);
  const children = b.issues.filter((i) => i.type !== 'epic');
  assert.deepEqual(q.pointsByCategory(b, children), { todo: 0.3, inprogress: 0, done: 0.375 });
  assert.equal(String(q.issueStats(b, children).points), '0.675');
  assert.equal(q.sumPoints(Array(10).fill(0.1)), 1);
});
