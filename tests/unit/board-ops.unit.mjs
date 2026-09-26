// Unit tests for every board mutation (src/utils/boardOps.js, boardIssueOps.js): the moveIssue
// maths (B-05: a drop can land at every index of a column, the bottom included), resolvedAt and
// history on a status change, recurrence, column delete with a target, epics, labels, the sprint
// lifecycle, and numbers that are never reused. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ops from '../../src/utils/boardOps.js';
import { createBoard } from '../../src/utils/boardModel.js';

const NOW = new Date(2026, 8, 23, 10, 0).getTime(); // Wed 23 Sep 2026, 10:00 local
const ctx = { now: NOW };
const MIN = 60 * 1000;

/** A kanban board with columns todo / doing / done, labels Home / Work, and issues `titles` (in To Do). */
function boardWith(titles = [], extra = {}) {
  let b = createBoard({ title: 'Life', key: 'LIFE', template: 'kanban' }, { now: NOW - 1000 });
  b = { ...b, columns: [
    { id: 'todo', title: 'To Do', category: 'todo', wipLimit: null },
    { id: 'doing', title: 'In Progress', category: 'inprogress', wipLimit: null },
    { id: 'done', title: 'Done', category: 'done', wipLimit: null },
  ], labels: [{ id: 'home', name: 'Home', color: '#3b82f6' }, { id: 'work', name: 'Work', color: '#f97316' }], ...extra };
  for (const t of titles) b = ops.addIssue(b, { id: t, title: t }, ctx);
  return b;
}
const titlesIn = (b, columnId) => b.issues.filter((i) => i.columnId === columnId).map((i) => i.title);
const get = (b, id) => b.issues.find((i) => i.id === id);

test('addIssue: numbered 1…n, defaults filled, the first to-do column, a created entry; no title, no issue', () => {
  const b = boardWith(['A', 'B']);
  assert.deepEqual(b.issues.map((i) => i.number), [1, 2]);
  assert.equal(b.nextNumber, 3);
  const a = get(b, 'A');
  assert.deepEqual(
    [a.type, a.priority, a.columnId, a.labelIds, a.due, a.estimate, a.epicId, a.sprintId, a.recurrence, a.resolvedAt],
    ['task', 'medium', 'todo', [], '', null, null, null, 'none', null],
  );
  assert.deepEqual(a.activity.map((e) => e.kind), ['created']);
  assert.equal(ops.addIssue(b, { title: '   ' }, ctx), b);
  const c = ops.addIssue(b, { id: 'C', title: 'C', labelIds: ['home', 'nope'], due: '2026-02-30', estimate: '3', epicId: 'A' }, ctx);
  assert.deepEqual([get(c, 'C').labelIds, get(c, 'C').due, get(c, 'C').estimate, get(c, 'C').epicId], [['home'], '', 3, null], 'A is not an epic');
  const inDone = ops.addIssue(b, { id: 'D', title: 'D', columnId: 'done' }, ctx);
  assert.equal(get(inDone, 'D').resolvedAt, NOW, 'made straight into Done: resolved');
});

test('B-05: moveIssue lands a card at every index of another column — the bottom included', () => {
  const b0 = ops.moveIssue(ops.moveIssue(boardWith(['A', 'B', 'C']), 'C', { columnId: 'doing' }, ctx), 'X', {}, ctx);
  assert.deepEqual(titlesIn(b0, 'todo'), ['A', 'B']);
  const targets = [['A', ['C', 'A', 'B']], ['B', ['A', 'C', 'B']], [null, ['A', 'B', 'C']]];
  for (const [beforeId, expected] of targets) {
    const b = ops.moveIssue(b0, 'C', { columnId: 'todo', beforeId }, ctx);
    assert.deepEqual(titlesIn(b, 'todo'), expected, `before ${beforeId}`);
    assert.deepEqual(titlesIn(b, 'doing'), []);
  }
});

test('B-05: within one column a card reaches the bottom too, and other columns keep their order', () => {
  let b = boardWith(['A', 'B', 'C', 'D']);
  b = ops.moveIssue(b, 'B', { columnId: 'doing' }, ctx); // into an empty column: rank kept, A B C D
  assert.deepEqual(titlesIn(ops.moveIssue(b, 'A', { columnId: 'todo', beforeId: null }, ctx), 'todo'), ['C', 'D', 'A']);
  assert.deepEqual(titlesIn(ops.moveIssue(b, 'D', { columnId: 'todo', beforeId: 'A' }, ctx), 'todo'), ['D', 'A', 'C']);
  const e = ops.addIssue(b, { id: 'E', title: 'E', columnId: 'doing' }, ctx);
  const moved = ops.moveIssue(e, 'A', { columnId: 'doing', beforeId: null }, ctx);
  assert.deepEqual(titlesIn(moved, 'doing'), ['B', 'E', 'A'], 'after the last issue of the target column');
  assert.equal(ops.moveIssue(b, 'A', { columnId: 'todo', beforeId: 'C' }, ctx), b, 'already there: the same board');
  assert.equal(ops.moveIssue(b, 'D', { columnId: 'todo', beforeId: null }, ctx), b, 'already last: the same board');
});

test('moveIssue: into Done resolves (resolvedAt) and records the status with column titles; out of it reopens', () => {
  let b = ops.moveIssue(boardWith(['A']), 'A', { columnId: 'done' }, ctx);
  assert.equal(get(b, 'A').resolvedAt, NOW);
  const entry = get(b, 'A').activity.at(-1);
  assert.deepEqual([entry.kind, entry.field, entry.from, entry.to], ['field', 'status', 'To Do', 'Done']);
  b = ops.moveIssue(b, 'A', { columnId: 'doing' }, { now: NOW + 10 * MIN });
  assert.equal(get(b, 'A').resolvedAt, null);
  assert.equal(get(b, 'A').updatedAt, NOW + 10 * MIN);
});

test('moveIssue: to a sprint (null: the backlog), after the last issue of that sprint; a closed sprint is no target', () => {
  let b = boardWith(['A', 'B', 'C'], { mode: 'scrum' });
  b = ops.addSprint(b, { id: 's1', name: 'Sprint 1' });
  b = ops.moveIssue(b, 'B', { sprintId: 's1' }, ctx);
  b = ops.moveIssue(b, 'A', { sprintId: 's1', beforeId: null }, ctx);
  assert.deepEqual(b.issues.filter((i) => i.sprintId === 's1').map((i) => i.title), ['B', 'A']);
  assert.equal(get(b, 'A').activity.at(-1).field, 'sprint');
  b = ops.moveIssue(b, 'A', { sprintId: null }, ctx);
  assert.equal(get(b, 'A').sprintId, null);
  const closed = { ...b, sprints: [{ ...b.sprints[0], state: 'closed' }] };
  assert.equal(get(ops.moveIssue(closed, 'C', { sprintId: 's1' }, ctx), 'C').sprintId, null);
});

test('recurrence: done spawns the next occurrence once — first to-do column, due stepped, checklist unticked', () => {
  let b = boardWith([]);
  b = ops.addIssue(b, {
    id: 'R', title: 'Take out the recycling', type: 'task', priority: 'low', labelIds: ['home'], estimate: 1,
    columnId: 'doing', due: '2026-09-23', recurrence: 'weekly', checklist: [{ text: 'Paper', done: true }, { text: 'Glass', done: true }],
  }, ctx);
  b = ops.moveIssue(b, 'R', { columnId: 'done' }, ctx);
  assert.equal(b.issues.length, 2);
  const next = b.issues[1];
  assert.deepEqual(
    [next.title, next.number, next.columnId, next.due, next.priority, next.labelIds, next.estimate, next.recurrence, next.resolvedAt],
    ['Take out the recycling', 2, 'todo', '2026-09-30', 'low', ['home'], 1, 'weekly', null],
  );
  assert.deepEqual(next.checklist.map((c) => [c.text, c.done]), [['Paper', false], ['Glass', false]]);
  assert.ok(next.checklist.every((c) => !get(b, 'R').checklist.some((o) => o.id === c.id)), 'new checklist ids');
  assert.equal(next.activity[0].from, 'LIFE-1', 'history says which issue it repeats');
  assert.equal(get(b, 'R').recurrenceNextId, next.id);
  b = ops.moveIssue(b, 'R', { columnId: 'todo' }, ctx);
  b = ops.moveIssue(b, 'R', { columnId: 'done' }, ctx);
  assert.equal(b.issues.length, 2, 'reopened and resolved again: no second occurrence');
  b = ops.deleteIssue(ops.moveIssue(b, 'R', { columnId: 'todo' }, ctx), next.id);
  b = ops.moveIssue(b, 'R', { columnId: 'done' }, ctx);
  assert.equal(b.issues.length, 2, 'its occurrence deleted: resolving it again repeats it again');
  assert.equal(b.issues[1].number, 3, 'numbers are never reused');
});

test('updateIssue: a status change through columnId spawns too; a plain issue done spawns nothing', () => {
  let b = ops.addIssue(boardWith(['P']), { id: 'D', title: 'Daily', recurrence: 'daily' }, ctx);
  b = ops.updateIssue(b, 'D', { columnId: 'done' }, ctx);
  assert.equal(b.issues.length, 3);
  assert.equal(b.issues[2].due, '2026-09-24');
  assert.equal(ops.updateIssue(b, 'P', { columnId: 'done' }, ctx).issues.length, 3);
});

test('updateIssue: each changed field is recorded; bursts on one field are one entry; a no-op is the same board', () => {
  let b = boardWith(['A']);
  b = ops.updateIssue(b, 'A', { title: 'A2', priority: 'high', labelIds: ['home', 'work'], due: '2026-10-01' }, ctx);
  const fields = get(b, 'A').activity.slice(1).map((e) => [e.field, e.from, e.to]);
  assert.deepEqual(fields, [['title', 'A', 'A2'], ['priority', 'medium', 'high'], ['labels', '', 'Home, Work'], ['due', '', '2026-10-01']]);
  b = ops.updateIssue(b, 'A', { description: '<p>one</p>' }, { now: NOW + MIN });
  b = ops.updateIssue(b, 'A', { description: '<p>one two</p>' }, { now: NOW + 2 * MIN });
  assert.equal(get(b, 'A').activity.filter((e) => e.field === 'description').length, 1);
  assert.equal(ops.updateIssue(b, 'A', { title: 'A2', priority: 'high' }, ctx), b);
  assert.equal(get(ops.updateIssue(b, 'A', { title: '  ' }, ctx), 'A').title, 'A2', 'a blank title keeps the old one');
  assert.deepEqual(get(b, 'A').activity.at(-1), { ...get(b, 'A').activity.at(-1), field: 'description', from: '', to: 'one two' });
  b = ops.updateIssue(b, 'A', { priority: 'low' }, { now: NOW + 10 * MIN });
  b = ops.updateIssue(b, 'A', { priority: 'high' }, { now: NOW + 11 * MIN });
  assert.equal(get(b, 'A').activity.filter((e) => e.field === 'priority').length, 1, 'changed and changed back: that entry goes');
});

test('updateIssue: history keeps the newest 200 entries', () => {
  let b = boardWith(['A']);
  for (let n = 0; n < 230; n += 1) b = ops.updateIssue(b, 'A', { estimate: n + 1 }, { now: NOW + n * 10 * MIN });
  assert.equal(get(b, 'A').activity.length, 200);
  assert.equal(get(b, 'A').activity.at(-1).to, 230);
});

test('epics: only an epic can be one; deleting it unlinks its children, restoring relinks them', () => {
  let b = boardWith(['E', 'C1', 'C2']);
  b = ops.updateIssue(b, 'E', { type: 'epic' }, ctx);
  b = ops.updateIssue(b, 'C1', { epicId: 'E' }, ctx);
  b = ops.updateIssue(b, 'C2', { epicId: 'E' }, ctx);
  assert.equal(ops.updateIssue(b, 'E', { epicId: 'E' }, ctx), b, 'an epic belongs to no epic');
  assert.equal(get(b, 'C1').activity.at(-1).to, 'E', 'the history names the epic');
  const removed = ops.removedIssue(b, 'E');
  assert.deepEqual([removed.index, removed.childIds], [0, ['C1', 'C2']]);
  const gone = ops.deleteIssue(b, 'E');
  assert.deepEqual(gone.issues.map((i) => i.epicId), [null, null]);
  const back = ops.restoreIssue(gone, removed);
  assert.deepEqual(back.issues.map((i) => [i.id, i.epicId]), [['E', null], ['C1', 'E'], ['C2', 'E']]);
  assert.equal(ops.restoreIssue(back, removed), back, 'restored twice: once');
  const demoted = ops.updateIssue(b, 'E', { type: 'task' }, ctx);
  assert.deepEqual(demoted.issues.map((i) => i.epicId), [null, null, null], 'an epic that stops being one lets its children go');
});

test('numbers are never reused: delete the newest, the next issue still gets a new number', () => {
  let b = ops.deleteIssue(boardWith(['A', 'B']), 'B');
  b = ops.addIssue(b, { id: 'C', title: 'C' }, ctx);
  assert.equal(get(b, 'C').number, 3);
});

test('duplicateIssue: right after the original, a new number, new checklist ids, no comments', () => {
  let b = boardWith(['A', 'B']);
  b = ops.updateIssue(b, 'A', { checklist: [{ id: 'k1', text: 'x', done: true }] }, ctx);
  b = ops.addComment(b, 'A', { text: 'hi' }, ctx);
  b = ops.duplicateIssue(b, 'A', ctx, { id: 'A2' });
  assert.deepEqual(b.issues.map((i) => i.id), ['A', 'A2', 'B']);
  const copy = get(b, 'A2');
  assert.deepEqual([copy.title, copy.number, copy.comments, copy.checklist[0].done], ['A (copy)', 3, [], true]);
  assert.notEqual(copy.checklist[0].id, 'k1');
});

test('columns: add before Done, rename, WIP, category resolves or reopens, move', () => {
  let b = ops.addColumn(boardWith(['A']), { id: 'rev', title: 'Review' });
  assert.deepEqual(b.columns.map((c) => c.id), ['todo', 'doing', 'rev', 'done']);
  b = ops.updateColumn(b, 'rev', { title: ' In review ', wipLimit: '3' });
  assert.deepEqual([b.columns[2].title, b.columns[2].wipLimit], ['In review', 3]);
  assert.equal(ops.updateColumn(b, 'rev', { wipLimit: 0 }).columns[2].wipLimit, null);
  b = ops.updateColumn(b, 'todo', { category: 'done' }, ctx);
  assert.equal(get(b, 'A').resolvedAt, NOW);
  b = ops.updateColumn(b, 'todo', { category: 'todo' }, ctx);
  assert.equal(get(b, 'A').resolvedAt, null);
  assert.deepEqual(ops.moveColumn(b, 'done', 0).columns.map((c) => c.id), ['done', 'todo', 'doing', 'rev']);
  assert.equal(ops.moveColumn(b, 'todo', 0), b);
});

test('a column that becomes done resolves its issues as a move to Done does: what repeats comes back, the history says so (R4-BRD-09)', () => {
  let b = ops.addColumn(boardWith(['A']), { id: 'rev', title: 'Review' });
  b = ops.addIssue(b, { id: 'R', title: 'Water the plants', columnId: 'rev', due: '2026-09-23', recurrence: 'weekly' }, ctx);
  b = ops.updateColumn(b, 'rev', { category: 'done' }, { now: NOW + MIN });
  const r = get(b, 'R');
  assert.equal(r.resolvedAt, NOW + MIN);
  assert.deepEqual(r.activity.at(-1), { ...r.activity.at(-1), kind: 'field', field: 'status', from: 'In progress', to: 'Done' });
  const next = b.issues.find((i) => i.id === r.recurrenceNextId);
  assert.ok(next, 'the next occurrence was made');
  assert.deepEqual([next.title, next.columnId, next.due, next.resolvedAt], ['Water the plants', 'todo', '2026-09-30', null]);
  assert.equal(b.issues.filter((i) => i.title === 'Water the plants').length, 2, 'once');
  assert.equal(get(b, 'A').activity.length, 1, 'an issue of another column is untouched');

  const reopened = ops.updateColumn(b, 'rev', { category: 'inprogress' }, { now: NOW + 2 * MIN });
  assert.equal(get(reopened, 'R').resolvedAt, null);
  assert.deepEqual([get(reopened, 'R').activity.at(-1).from, get(reopened, 'R').activity.at(-1).to], ['Done', 'In progress']);
  const again = ops.updateColumn(reopened, 'rev', { category: 'done' }, { now: NOW + 3 * MIN });
  assert.equal(again.issues.filter((i) => i.title === 'Water the plants').length, 2, 'its next occurrence still exists: no second one');
  assert.equal(ops.updateColumn(b, 'rev', { category: 'done' }, ctx), b, 'no change, nothing saved');
});

test('the only to-do column turned Done: the next occurrence goes to an open column, not born resolved (R4-BRD-09)', () => {
  let b = ops.addIssue(boardWith([]), { id: 'R', title: 'Water the plants', due: '2026-09-23', recurrence: 'weekly' }, ctx);
  b = ops.updateColumn(b, 'todo', { category: 'done' }, ctx);
  const next = b.issues.find((i) => i.id === get(b, 'R').recurrenceNextId);
  assert.deepEqual([next?.columnId, next?.resolvedAt], ['doing', null]);
});

test('an unnamed sprint takes the next free number, never a name a sprint has (R4-BRD-11)', () => {
  let b = boardWith([], { mode: 'scrum' });
  b = ops.addSprint(b, { id: 's1' });
  b = ops.addSprint(b, { id: 's2' });
  b = ops.deleteSprint(b, 's1', ctx);
  b = ops.addSprint(b, { id: 's3' });
  assert.deepEqual(b.sprints.map((s) => s.name), ['LIFE Sprint 2', 'LIFE Sprint 3']);
  b = ops.addSprint(b, { id: 's4', name: 'life sprint 4' });
  b = ops.addSprint(b, { id: 's5', name: 'Holiday' });
  b = ops.addSprint(b, { id: 's6' });
  assert.equal(b.sprints.at(-1).name, 'LIFE Sprint 5', 'past every number taken, case aside');
  b = ops.deleteSprint(b, 's3', ctx);
  assert.equal(ops.addSprint(b, { id: 's7' }).sprints.at(-1).name, 'LIFE Sprint 6', 'one past the highest number left');
  const renamed = ops.addSprint(boardWith([], { mode: 'scrum', sprints: [{ id: 'x', name: 'Alpha', goal: '', startDate: '', endDate: '', state: 'future', completedAt: null }] }), { id: 'y' });
  assert.equal(renamed.sprints.at(-1).name, 'LIFE Sprint 2', 'a sprint of another name still counts');
});

test('deleteColumn: its issues move to the target (never lost); no target, no delete; never the last column', () => {
  const b = boardWith(['A', 'B']);
  assert.equal(ops.deleteColumn(b, 'todo'), b, 'holds issues, no target');
  assert.equal(ops.deleteColumn(b, 'todo', 'todo'), b);
  const d = ops.deleteColumn(b, 'todo', 'done', ctx);
  assert.deepEqual(d.columns.map((c) => c.id), ['doing', 'done']);
  assert.deepEqual(titlesIn(d, 'done'), ['A', 'B']);
  assert.ok(d.issues.every((i) => i.resolvedAt === NOW && i.activity.at(-1).field === 'status'));
  assert.equal(ops.deleteColumn(b, 'doing').columns.length, 2, 'an empty column needs no target');
  const one = { ...b, columns: [b.columns[0]] };
  assert.equal(ops.deleteColumn(one, 'todo', 'x'), one);
});

test('labels: unique names, renamed, deleted off every issue', () => {
  let b = ops.updateIssue(boardWith(['A']), 'A', { labelIds: ['home', 'work'] }, ctx);
  assert.equal(ops.addLabel(b, { name: 'home' }), b, 'a name taken, case aside');
  b = ops.addLabel(b, { id: 'fin', name: 'Finance', color: '#f59e0b' });
  assert.equal(b.labels.length, 3);
  assert.equal(ops.updateLabel(b, 'fin', { name: 'Work' }), b);
  b = ops.updateLabel(b, 'fin', { name: 'Money' });
  assert.equal(b.labels[2].name, 'Money');
  b = ops.deleteLabel(b, 'home');
  assert.deepEqual(get(b, 'A').labelIds, ['work']);
});

test('comments: added (and in the history), edited with editedAt, deleted; blank is refused', () => {
  let b = ops.addComment(boardWith(['A']), 'A', { id: 'c1', text: ' Call first ' }, ctx);
  assert.deepEqual(get(b, 'A').comments, [{ id: 'c1', text: 'Call first', createdAt: NOW, editedAt: null }]);
  assert.equal(get(b, 'A').activity.at(-1).kind, 'comment');
  assert.equal(ops.addComment(b, 'A', { text: ' ' }, ctx), b);
  b = ops.updateComment(b, 'A', 'c1', 'Call after 5', { now: NOW + MIN });
  assert.deepEqual([get(b, 'A').comments[0].text, get(b, 'A').comments[0].editedAt], ['Call after 5', NOW + MIN]);
  assert.equal(ops.updateComment(b, 'A', 'c1', '', ctx), b);
  assert.deepEqual(get(ops.deleteComment(b, 'A', 'c1', ctx), 'A').comments, []);
});

test('sprints: one active at a time; complete keeps done issues, sends open ones on; delete empties to the backlog', () => {
  let b = boardWith(['A', 'B', 'C'], { mode: 'scrum' });
  b = ops.addSprint(b, { id: 's1' });
  b = ops.addSprint(b, { id: 's2', name: 'Next' });
  assert.equal(b.sprints[0].name, 'LIFE Sprint 1');
  for (const id of ['A', 'B', 'C']) b = ops.moveIssue(b, id, { sprintId: 's1' }, ctx);
  b = ops.startSprint(b, 's1', { goal: 'Ship it' }, ctx);
  assert.deepEqual([b.sprints[0].state, b.sprints[0].startDate, b.sprints[0].endDate, b.sprints[0].goal], ['active', '2026-09-23', '2026-10-07', 'Ship it']);
  assert.equal(ops.startSprint(b, 's2', {}, ctx), b, 'a second active sprint is refused');
  b = ops.moveIssue(b, 'A', { columnId: 'done' }, ctx);
  const sprintOf = (x) => ['A', 'B', 'C'].map((id) => get(x, id).sprintId);
  const toNext = ops.completeSprint(b, 's1', { moveOpenTo: 's2' }, { now: NOW + MIN });
  assert.deepEqual(sprintOf(toNext), ['s1', 's2', 's2']);
  assert.deepEqual([toNext.sprints[0].state, toNext.sprints[0].completedAt], ['closed', NOW + MIN]);
  const toBacklog = ops.completeSprint(b, 's1', {}, ctx);
  assert.deepEqual(sprintOf(toBacklog), ['s1', null, null]);
  assert.equal(ops.completeSprint(toBacklog, 's1', {}, ctx), toBacklog, 'only the active sprint completes');
  const deleted = ops.deleteSprint(b, 's1', ctx);
  assert.deepEqual([deleted.sprints.map((s) => s.id), deleted.issues.map((i) => i.sprintId)], [['s2'], [null, null, null]]);
  assert.equal(ops.updateSprint(b, 's2', { name: 'Renamed', endDate: 'soon' }).sprints[1].name, 'Renamed');
});

test('updateIssue: a sprint or epic that cannot be taken leaves the field as it was; null clears it', () => {
  let b = boardWith(['A', 'B', 'E'], { mode: 'scrum' });
  b = ops.updateIssue(b, 'E', { type: 'epic' }, ctx);
  b = ops.addSprint(b, { id: 's1' });
  b = ops.moveIssue(b, 'A', { sprintId: 's1', columnId: 'done' }, ctx);
  b = ops.updateIssue(b, 'B', { epicId: 'E' }, ctx);
  b = ops.completeSprint(ops.startSprint(b, 's1', {}, ctx), 's1', {}, ctx);
  // The issue modal saves its form: a done issue's closed sprint comes back unchanged with the edit.
  const edited = ops.updateIssue(b, 'A', { title: 'A2', sprintId: 's1' }, ctx);
  assert.deepEqual([get(edited, 'A').title, get(edited, 'A').sprintId], ['A2', 's1'], 'the closed sprint is its record');
  assert.equal(ops.updateIssue(b, 'B', { sprintId: 's1' }, ctx), b, 'a closed sprint is no target: nothing changes');
  assert.equal(ops.updateIssue(b, 'B', { sprintId: 'gone' }, ctx), b);
  assert.equal(ops.updateIssue(b, 'B', { epicId: 'A' }, ctx), b, 'A is not an epic: B stays in E');
  assert.equal(ops.updateIssue(b, 'B', { epicId: 'gone' }, ctx), b);
  assert.equal(get(ops.updateIssue(b, 'B', { epicId: null }, ctx), 'B').epicId, null, 'null takes it out');
  assert.equal(get(ops.updateIssue(b, 'A', { sprintId: null }, ctx), 'A').sprintId, null, 'null: the backlog');
});

test('updateBoardFields: a key is validated and unique; the rest of the patch waits for a valid one', () => {
  const b = boardWith([]);
  const other = { id: 'x', key: 'WEB', title: 'Website' };
  assert.equal(ops.updateBoardFields(b, { key: 'WEB', title: 'New' }, [b, other]), b);
  assert.equal(ops.updateBoardFields(b, { key: 'we' }, [b]), b);
  const next = ops.updateBoardFields(b, { key: 'HOME', title: ' Home ', starred: true, hideDoneAfterDays: 7 }, [b, other]);
  assert.deepEqual([next.key, next.title, next.starred, next.hideDoneAfterDays], ['HOME', 'Home', true, 7]);
  assert.equal(ops.updateBoardFields(b, { title: 'Life' }, [b]), b, 'nothing changed: the same board');
});
