// BRD-REV-02 (review of R4-SW-B-01 / R5-BRD-01b): a column delete moves its issues first and drops
// the column after, so a repeating issue the move resolves made its next occurrence in the first
// to-do column while the column being deleted was still on the board. When that was the deleted
// column, the occurrence kept its id and was shown in no board column and not in the backlog.
// Now it goes where it would be made without that column (the first to-do column left, else the
// first open one, else the first), and the column's Undo still takes it away. The store's actions
// over an in-memory list (createBoardActions). Fictional data only.
// Run: node --test tests/pdf/104-r5-brd-rev-02-delete-column-orphan.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createBoardActions } from '../../src/utils/boardActions.js';

const NOW = new Date(2026, 8, 26, 10, 0).getTime();
const col = (id, title, category) => ({ id, title, category, wipLimit: null });
const issue = (id, number, title, columnId, extra = {}) => ({
  id, number, type: 'task', title, description: '', columnId, priority: 'medium', labelIds: [], due: '', startDate: '',
  estimate: null, epicId: null, sprintId: null, checklist: [], comments: [],
  activity: [{ id: `act-${id}`, at: NOW - 1000, kind: 'created', field: null, from: null, to: null }],
  recurrence: 'none', recurrenceNextId: null, createdAt: NOW - 1000, updatedAt: NOW - 1000, resolvedAt: null, ...extra,
});
const project = (columns) => ({
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1', mode: 'kanban', description: '',
  columns, labels: [], sprints: [],
  issues: [
    issue('i1', 1, 'Water the plants', 'c1', { recurrence: 'weekly', due: '2026-09-28' }),
    issue('i2', 2, 'Buy nails', 'c1'),
  ],
  nextNumber: 3, hideDoneAfterDays: 14, createdAt: NOW - 1000, updatedAt: NOW - 1000,
});

function actionsOver(board) {
  let list = [board];
  let at = NOW;
  const a = createBoardActions({ boardsNow: () => list, setBoards: (fn) => { list = fn(list); }, now: () => { at += 1000; return at; } });
  return { a, board: () => list[0] };
}
const onBoard = (b) => b.issues.every((i) => b.columns.some((c) => c.id === i.columnId));

describe('BRD-REV-02: deleting the first to-do column into Done leaves no issue in a column that is gone', () => {
  it('To Do, Doing, Done: the next occurrence lands in Doing, open; Undo takes it away', () => {
    const original = project([col('c1', 'To Do', 'todo'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')]);
    const { a, board } = actionsOver(original);
    const removed = a.deleteColumn('p1', 'c1', 'c3');
    assert.ok(removed);
    const b = board();
    assert.equal(b.issues.length, 3, 'the repeating issue made its next occurrence');
    const next = b.issues.find((i) => i.id === b.issues.find((x) => x.id === 'i1').recurrenceNextId);
    assert.equal(next.columnId, 'c2', 'in the first open column left');
    assert.equal(next.resolvedAt, null);
    assert.ok(onBoard(b), 'every issue in a column on the board');
    assert.equal(a.restoreColumn(removed), true);
    assert.deepEqual(board().issues.map((i) => `${i.id}:${i.columnId}`), ['i1:c1', 'i2:c1'], 'Undo: as it was');
  });

  it('To Do, Done (the reviewer\'s case): the next occurrence lands in Done, the only column left, not in the deleted one', () => {
    const { a, board } = actionsOver(project([col('c1', 'To Do', 'todo'), col('c3', 'Done', 'done')]));
    a.deleteColumn('p1', 'c1', 'c3');
    const b = board();
    assert.equal(b.issues.length, 3);
    assert.ok(onBoard(b), 'every issue in a column on the board');
    assert.ok(b.issues.every((i) => i.resolvedAt), 'in Done: resolved, as a done column\'s issues are');
  });

  it('a second to-do column after the deleted one takes the next occurrence', () => {
    const { a, board } = actionsOver(project([col('c1', 'To Do', 'todo'), col('c4', 'Later', 'todo'), col('c3', 'Done', 'done')]));
    a.deleteColumn('p1', 'c1', 'c3');
    const b = board();
    assert.equal(b.issues.at(-1).columnId, 'c4');
    assert.ok(onBoard(b));
  });
});
