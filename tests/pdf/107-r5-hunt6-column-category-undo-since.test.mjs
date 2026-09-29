// R5-HUNT6-CATEGORY-UNDO-LEAVES-STALE-DATES (review of R5-HUNT6-DONE-COLUMN-RECATEGORIZE-NO-UNDO):
// the category change's Undo put back only the issues untouched since. An issue edited since, or
// moved or created in the column since, kept what the change (or its move) gave it while the
// category went back: after a reopen's Undo it sat in the Done column with no resolved date (the
// issue view showed no "Resolved", and a repeating one was never made again); after a resolve's
// Undo it sat open in a To do column still "Resolved", counted as completed by the project summary.
// Now each such issue is resolved or reopened as any category change does it, and one that was done
// before the change gets back the day it was really done. The store's actions are driven over an
// in-memory list (createBoardActions). Fictional data only.
// Run: node --test tests/pdf/107-r5-hunt6-column-category-undo-since.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createBoardActions } from '../../src/utils/boardActions.js';

const NOW = new Date(2026, 8, 26, 10, 0).getTime();
const DAY = 24 * 60 * 60 * 1000;
const col = (id, title, category) => ({ id, title, category, wipLimit: null });
const issue = (id, number, title, columnId, extra = {}) => ({
  id, number, type: 'task', title, description: '', columnId, priority: 'medium', labelIds: [], due: '', startDate: '',
  estimate: null, epicId: null, sprintId: null, checklist: [], comments: [],
  activity: [{ id: `act-${id}`, at: NOW - 60 * DAY, kind: 'created', field: null, from: null, to: null }],
  recurrence: 'none', recurrenceNextId: null, createdAt: NOW - 60 * DAY, updatedAt: NOW - 40 * DAY, resolvedAt: null, ...extra,
});
const project = () => ({
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1', mode: 'kanban', description: '',
  columns: [col('c1', 'To Do', 'todo'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')],
  labels: [], sprints: [],
  issues: [
    issue('i1', 1, 'Fix the tap', 'c3', { resolvedAt: NOW - 40 * DAY }),
    issue('i2', 2, 'Paint the fence', 'c3', { resolvedAt: NOW - 30 * DAY }),
    issue('i3', 3, 'Buy nails', 'c1'),
    issue('i4', 4, 'Water the plants', 'c2', { recurrence: 'weekly', due: '2026-09-26' }),
  ],
  nextNumber: 5, hideDoneAfterDays: 14, createdAt: NOW - 60 * DAY, updatedAt: NOW - 40 * DAY,
});

function actionsOver(boards) {
  let list = boards;
  let at = NOW;
  const a = createBoardActions({ boardsNow: () => list, setBoards: (fn) => { list = fn(list); }, now: () => { at += 1000; return at; } });
  return { a, board: () => list.find((b) => b.id === 'p1') };
}
const byId = (b, id) => b.issues.find((i) => i.id === id);
const lastStatus = (i) => i.activity.filter((e) => e.field === 'status').at(-1);

describe('R5-HUNT6: a category change\'s Undo leaves no issue half done', () => {
  it('after a reopen\'s Undo, an issue edited since is done again, on the day it was really done', () => {
    const { a, board } = actionsOver([project()]);
    const changed = a.setColumnCategory('p1', 'c3', 'todo');
    a.updateIssue('p1', 'i2', { title: 'Paint the fence white' });
    assert.equal(a.restoreCategory(changed), true);
    const i2 = byId(board(), 'i2');
    assert.equal(board().columns[2].category, 'done');
    assert.equal(i2.title, 'Paint the fence white', 'the edit is kept');
    assert.equal(i2.resolvedAt, NOW - 30 * DAY, 'it sat in the Done column with no resolved date');
    assert.deepEqual([lastStatus(i2).from, lastStatus(i2).to], ['To do', 'Done'], 'its history says it is done again');
  });

  it('after a reopen\'s Undo, an issue moved into the column since is resolved, and a repeating one made again', () => {
    const { a, board } = actionsOver([project()]);
    const changed = a.setColumnCategory('p1', 'c3', 'todo');
    a.moveIssue('p1', 'i3', { columnId: 'c3' });
    a.moveIssue('p1', 'i4', { columnId: 'c3' });
    const count = board().issues.length;
    assert.equal(a.restoreCategory(changed), true);
    assert.ok(byId(board(), 'i3').resolvedAt, 'it sat open in the Done column with no resolved date');
    const i4 = byId(board(), 'i4');
    assert.ok(i4.resolvedAt);
    assert.ok(i4.recurrenceNextId && byId(board(), i4.recurrenceNextId), 'the repeating issue\'s next occurrence is made');
    assert.equal(board().issues.length, count + 1);
    assert.equal(byId(board(), i4.recurrenceNextId).columnId, 'c1', 'in the To do column');
  });

  it('after a resolve\'s Undo, an issue edited since is open again, not "Resolved" in a To do column', () => {
    const { a, board } = actionsOver([project()]);
    const changed = a.setColumnCategory('p1', 'c1', 'done');
    assert.ok(byId(board(), 'i3').resolvedAt, 'resolved by the change');
    a.updateIssue('p1', 'i3', { priority: 'high' });
    assert.equal(a.restoreCategory(changed), true);
    const i3 = byId(board(), 'i3');
    assert.equal(board().columns[0].category, 'todo');
    assert.equal(i3.priority, 'high', 'the edit is kept');
    assert.equal(i3.resolvedAt, null, 'it stayed resolved while open');
    assert.deepEqual([lastStatus(i3).from, lastStatus(i3).to], ['Done', 'To do']);
  });

  it('the untouched issues are still put back exactly as they were', () => {
    const original = project();
    const { a, board } = actionsOver([original]);
    const changed = a.setColumnCategory('p1', 'c3', 'todo');
    a.updateIssue('p1', 'i2', { title: 'Paint the fence white' });
    a.restoreCategory(changed);
    assert.deepEqual(byId(board(), 'i1'), original.issues[0]);
    assert.deepEqual(byId(board(), 'i3'), original.issues[2]);
  });
});
