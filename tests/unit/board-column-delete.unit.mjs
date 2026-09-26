// Deleting a column (R4-BRD-01): what columnDeletion (src/utils/boardView.js) says the delete does —
// how many issues go and where. The board counted only its cards, so a Done column whose issues were
// all resolved before hideDoneAfterDays (or a scrum column holding only backlog issues and epics)
// looked empty: it went without a question, and every hidden resolved issue moved into the column
// beside it and was reopened. Now every issue the column holds counts, and they go to another column
// of the same category when there is one, so the delete neither reopens nor resolves them.
// Run: node --test tests/unit/board-column-delete.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { columnDeletion } from '../../src/utils/boardView.js';
import * as ops from '../../src/utils/boardOps.js';

const NOW = new Date(2026, 8, 26, 10, 0).getTime();
const DAY = 24 * 60 * 60 * 1000;
const col = (id, title, category) => ({ id, title, category, wipLimit: null });
const issue = (id, number, columnId, extra = {}) => ({
  id, number, type: 'task', title: id, columnId, labelIds: [], checklist: [], comments: [], activity: [],
  sprintId: null, epicId: null, recurrence: 'none', recurrenceNextId: null, resolvedAt: null, ...extra,
});
const board = (columns, issues, extra = {}) => ({
  id: 'p1', key: 'LIFE', title: 'Life', mode: 'kanban', columns, labels: [], sprints: [], issues,
  nextNumber: issues.length + 1, hideDoneAfterDays: 14, ...extra,
});
const COLUMNS = [col('todo', 'To Do', 'todo'), col('doing', 'In Progress', 'inprogress'), col('done', 'Done', 'done')];

test('every issue the column holds counts: done ones hidden by hideDoneAfterDays, epics, other sprints\' issues', () => {
  const b = board(COLUMNS, [
    issue('old', 1, 'done', { resolvedAt: NOW - 30 * DAY }),
    issue('older', 2, 'done', { resolvedAt: NOW - 60 * DAY }),
    issue('epic', 3, 'done', { type: 'epic', resolvedAt: NOW - DAY }),
    issue('a', 4, 'todo'),
  ]);
  const d = columnDeletion(b, 'done');
  assert.equal(d.count, 3, 'the Done column looks empty on the board but holds three issues');
  assert.equal(d.target.id, 'doing');
  assert.equal(d.change, 'reopen', 'the only other columns are open: the move reopens them, and the question says so');
});

test('the target: the nearest column of the same category, else the one beside it (after, else before)', () => {
  const cols = [col('todo', 'To Do', 'todo'), col('doing', 'In Progress', 'inprogress'), col('done', 'Done', 'done'), col('shipped', 'Shipped', 'done'), col('later', 'Later', 'todo')];
  const b = board(cols, []);
  assert.equal(columnDeletion(b, 'done').target.id, 'shipped');
  assert.equal(columnDeletion(b, 'done').change, null);
  assert.equal(columnDeletion(b, 'shipped').target.id, 'done');
  assert.equal(columnDeletion(b, 'todo').target.id, 'later', 'another to-do column, though not beside it');
  assert.equal(columnDeletion(b, 'doing').target.id, 'done', 'no other in-progress column: the one after');
  assert.equal(columnDeletion(b, 'doing').change, 'resolve');
  assert.equal(columnDeletion(board(COLUMNS.slice(0, 2), []), 'doing').target.id, 'todo', 'the last column: the one before');
  assert.equal(columnDeletion(board([...COLUMNS, col('review', 'Review', 'inprogress')], []), 'review').target.id, 'doing', 'the other in-progress column, though not beside it');
  const two = [col('a', 'A', 'todo'), col('b', 'B', 'todo'), col('c', 'C', 'todo')];
  assert.equal(columnDeletion(board(two, []), 'b').target.id, 'c', 'a tie goes to the one after');
});

test('the only column has no target; an unknown column counts nothing', () => {
  assert.deepEqual(columnDeletion(board([COLUMNS[0]], [issue('a', 1, 'todo')]), 'todo'), { count: 1, target: null, change: null });
  assert.deepEqual(columnDeletion(board(COLUMNS, []), 'nope'), { count: 0, target: null, change: null });
});

test('deleted into its target, a hidden resolved issue stays resolved when the target is done too', () => {
  const cols = [...COLUMNS, col('shipped', 'Shipped', 'done')];
  const b = board(cols, [issue('old', 1, 'done', { resolvedAt: NOW - 30 * DAY })]);
  const { target } = columnDeletion(b, 'done');
  const after = ops.deleteColumn(b, 'done', target.id, { now: NOW });
  const moved = after.issues.find((i) => i.id === 'old');
  assert.equal(moved.columnId, 'shipped');
  assert.equal(moved.resolvedAt, NOW - 30 * DAY, 'not reopened, and its resolution date kept');
});
