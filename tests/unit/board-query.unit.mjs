// Unit tests for what the board pages compute (src/utils/boardQuery.js): the filter bar, the
// board view's columns, hidden done issues and swimlanes, sorting, WIP limits, the backlog's
// sections and totals, epics, and "Your work" — all with a fixed `now`. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as q from '../../src/utils/boardQuery.js';
import * as ops from '../../src/utils/boardOps.js';
import { createBoard } from '../../src/utils/boardModel.js';

const NOW = new Date(2026, 8, 23, 10, 0).getTime(); // Wed 23 Sep 2026
const DAY = 24 * 60 * 60 * 1000;
const ctx = { now: NOW };

/** LIFE: To Do / In Progress / Done, labels Home + Work, an epic and a spread of issues. */
function life() {
  let b = createBoard({ title: 'Life', key: 'LIFE' }, { now: NOW });
  b = { ...b, columns: [
    { id: 'todo', title: 'To Do', category: 'todo', wipLimit: 2 },
    { id: 'doing', title: 'In Progress', category: 'inprogress', wipLimit: 1 },
    { id: 'done', title: 'Done', category: 'done', wipLimit: null },
  ], labels: [{ id: 'home', name: 'Home', color: '#000' }, { id: 'work', name: 'Work', color: '#111' }] };
  const add = (id, fields) => { b = ops.addIssue(b, { id, title: id, ...fields }, ctx); };
  add('epic', { title: 'Move flat', type: 'epic', priority: 'high' });
  add('van', { title: 'Book the van', epicId: 'epic', due: '2026-09-20', priority: 'highest', labelIds: ['home'], estimate: 2 });
  add('tap', { title: 'Fix the tap', type: 'bug', due: '2026-09-23', labelIds: ['home'], columnId: 'doing', estimate: 1 });
  add('tax', { title: 'File taxes', description: '<p>Ask the <b>accountant</b></p>', due: '2026-09-28', labelIds: ['work'], estimate: 5 });
  add('read', { title: 'Read a book', type: 'story', priority: 'low', columnId: 'doing' });
  add('old', { title: 'Old chore', columnId: 'done', due: '2026-09-01' });
  b = ops.updateIssue(b, 'epic', {}, ctx);
  return b;
}
const ids = (list) => list.map((i) => i.id);

test('filterIssues: text over key, title and plain description; types, priorities, labels, epics, due, open', () => {
  const b = life();
  assert.deepEqual(ids(q.filterIssues(b, { text: 'life-3' }, ctx)), ['tap']);
  assert.deepEqual(ids(q.filterIssues(b, { text: ' TAP ' }, ctx)), ['tap']);
  assert.deepEqual(ids(q.filterIssues(b, { text: 'accountant' }, ctx)), ['tax'], 'the description as text, tags aside');
  assert.deepEqual(ids(q.filterIssues(b, { text: '<b>' }, ctx)), [], 'markup is not text');
  assert.deepEqual(ids(q.filterIssues(b, { types: ['bug', 'story'] }, ctx)), ['tap', 'read']);
  assert.deepEqual(ids(q.filterIssues(b, { priorities: ['highest', 'high'] }, ctx)), ['epic', 'van']);
  assert.deepEqual(ids(q.filterIssues(b, { labelIds: ['home', 'work'] }, ctx)), ['van', 'tap', 'tax']);
  assert.deepEqual(ids(q.filterIssues(b, { epicIds: ['epic'] }, ctx)), ['van']);
  assert.deepEqual(ids(q.filterIssues(b, { epicIds: ['none'] }, ctx)), ['epic', 'tap', 'tax', 'read', 'old']);
  assert.deepEqual(ids(q.filterIssues(b, { due: 'overdue' }, ctx)), ['van'], 'a done issue is never overdue');
  assert.deepEqual(ids(q.filterIssues(b, { due: 'today' }, ctx)), ['tap']);
  assert.deepEqual(ids(q.filterIssues(b, { due: 'week' }, ctx)), ['tap', 'tax'], 'today counts as this week');
  assert.deepEqual(ids(q.filterIssues(b, { due: 'none' }, ctx)), ['epic', 'read']);
  assert.deepEqual(ids(q.filterIssues(b, { onlyOpen: true }, ctx)), ['epic', 'van', 'tap', 'tax', 'read']);
  assert.deepEqual(ids(q.filterIssues(b, { types: [], priorities: [], text: '' }, ctx)), ids(b.issues), 'empty filters: all');
  assert.deepEqual(ids(q.filterIssues(b, { labelIds: ['home'], due: 'today' }, ctx)), ['tap'], 'filters combine');
});

test('dueBucket: overdue, today, the next 7 days, later, none', () => {
  const t = '2026-09-23';
  assert.deepEqual(['2026-09-22', t, '2026-09-24', '2026-09-30', '2026-10-01', ''].map((d) => q.dueBucket(d, t)),
    ['overdue', 'today', 'week', 'week', 'later', 'none']);
});

test('visibleOnBoard: kanban hides done issues resolved more than N days ago; scrum shows the active sprint', () => {
  let b = life();
  b = { ...b, issues: b.issues.map((i) => (i.id === 'old' ? { ...i, resolvedAt: NOW - 20 * DAY } : i)) };
  assert.ok(!ids(q.visibleOnBoard(b, ctx)).includes('old'));
  assert.ok(ids(q.visibleOnBoard({ ...b, hideDoneAfterDays: 30 }, ctx)).includes('old'));
  assert.ok(ids(q.visibleOnBoard({ ...b, hideDoneAfterDays: null }, ctx)).includes('old'));
  let s = ops.addSprint({ ...b, mode: 'scrum' }, { id: 's1' });
  assert.deepEqual(q.visibleOnBoard(s, ctx), [], 'no active sprint: nothing on the board');
  s = ops.startSprint(ops.moveIssue(s, 'tap', { sprintId: 's1' }, ctx), 's1', {}, ctx);
  assert.deepEqual(ids(q.visibleOnBoard(s, ctx)), ['tap']);
});

test('groupIntoColumns and columnCounts: rank order per column, WIP state', () => {
  const b = life();
  assert.deepEqual(q.groupIntoColumns(b).map((g) => [g.column.id, ids(g.issues)]),
    [['todo', ['epic', 'van', 'tax']], ['doing', ['tap', 'read']], ['done', ['old']]]);
  assert.deepEqual(q.columnCounts(b), {
    todo: { count: 3, limit: 2, state: 'over' },
    doing: { count: 2, limit: 1, state: 'over' },
    done: { count: 1, limit: null, state: null },
  });
  assert.equal(q.columnCounts(b, b.issues.filter((i) => i.id !== 'read')).doing.state, 'at');
  const dangling = { ...b, issues: [{ ...b.issues[0], columnId: 'gone' }] };
  assert.deepEqual(ids(q.groupIntoColumns(dangling)[0].issues), ['epic'], 'a lost column shows in the first');
});

test('swimlanes: by epic (No epic last), priority and type — only lanes that hold issues', () => {
  const b = life();
  assert.deepEqual(q.swimlanes(b, b.issues, 'epic').map((l) => [l.title, ids(l.issues)]),
    [['Move flat', ['van']], ['No epic', ['epic', 'tap', 'tax', 'read', 'old']]]);
  assert.deepEqual(q.swimlanes(b, b.issues, 'priority').map((l) => l.id), ['highest', 'high', 'medium', 'low']);
  assert.deepEqual(q.swimlanes(b, b.issues, 'type').map((l) => [l.id, l.issues.length]), [['task', 3], ['bug', 1], ['story', 1], ['epic', 1]]);
  assert.deepEqual(q.swimlanes(b, b.issues).map((l) => l.issues.length), [6]);
});

test('sortIssues: every column, ties by rank, blanks last both ways', () => {
  const b = life();
  assert.deepEqual(ids(q.sortIssues(b, b.issues, 'due')), ['old', 'van', 'tap', 'tax', 'epic', 'read']);
  assert.deepEqual(ids(q.sortIssues(b, b.issues, 'due', 'desc')), ['tax', 'tap', 'van', 'old', 'epic', 'read']);
  assert.deepEqual(ids(q.sortIssues(b, b.issues, 'priority')), ['van', 'epic', 'tap', 'tax', 'old', 'read']);
  assert.deepEqual(ids(q.sortIssues(b, b.issues, 'status')), ['epic', 'van', 'tax', 'tap', 'read', 'old']);
  assert.deepEqual(ids(q.sortIssues(b, b.issues, 'key', 'desc')), ['old', 'read', 'tax', 'tap', 'van', 'epic']);
  assert.deepEqual(ids(q.sortIssues(b, b.issues, 'estimate')), ['tap', 'van', 'tax', 'epic', 'read', 'old']);
  assert.deepEqual(ids(q.sortIssues(b, b.issues, 'title')), ['van', 'tax', 'tap', 'epic', 'old', 'read']);
  assert.deepEqual(ids(q.sortIssues(b, [...b.issues].reverse(), 'rank')), ids(b.issues));
});

test('backlogSections and sprintStats: active, future, backlog (open only), with points', () => {
  let b = ops.addSprint(ops.addSprint({ ...life(), mode: 'scrum' }, { id: 'f1', name: 'Later' }), { id: 'a1', name: 'Now' });
  b = ops.moveIssue(ops.moveIssue(b, 'van', { sprintId: 'a1' }, ctx), 'tap', { sprintId: 'a1' }, ctx);
  b = ops.moveIssue(b, 'tax', { sprintId: 'f1' }, ctx);
  b = ops.startSprint(b, 'a1', {}, ctx);
  b = ops.moveIssue(b, 'tap', { columnId: 'done' }, ctx);
  const sections = q.backlogSections(b);
  assert.deepEqual(sections.map((s) => [s.id, ids(s.issues)]), [['a1', ['van', 'tap']], ['f1', ['tax']], ['backlog', ['epic', 'read']]]);
  assert.deepEqual(q.sprintStats(b, 'a1'), { issues: 2, open: 1, done: 1, points: 3, donePoints: 1 });
  assert.deepEqual(q.sprintStats(b, null).issues, 2, 'the backlog leaves resolved issues out');
});

test('epics: children and progress', () => {
  let b = life();
  b = ops.moveIssue(b, 'van', { columnId: 'done' }, ctx);
  assert.deepEqual(ids(q.epicsOf(b)), ['epic']);
  assert.deepEqual(ids(q.childrenOf(b, 'epic')), ['van']);
  assert.deepEqual(q.epicProgress(b, 'epic'), { total: 1, done: 1, points: 2, donePoints: 2 });
  assert.deepEqual(q.issueCounts(b), { total: 6, open: 4, done: 2 });
});

test('yourWork: overdue, today, this week, in progress and recent, across projects, with keys', () => {
  const a = life();
  let web = createBoard({ title: 'Website', key: 'WEB' }, { now: NOW });
  web = ops.addIssue(web, { id: 'w1', title: 'Launch', due: '2026-09-25' }, { now: NOW + 5 });
  web = ops.addIssue(web, { id: 'w2', title: 'Old bug', due: '2026-09-10' }, { now: NOW - 3 * DAY });
  const work = q.yourWork([a, web], NOW);
  const keys = (rows) => rows.map((r) => r.key);
  assert.deepEqual(keys(work.overdue), ['WEB-2', 'LIFE-2'], 'oldest due first');
  assert.deepEqual(keys(work.today), ['LIFE-3']);
  assert.deepEqual(keys(work.week), ['WEB-1', 'LIFE-4']);
  assert.deepEqual(keys(work.inProgress), ['LIFE-5'], 'LIFE-3 is already under Due today');
  assert.equal(work.recent[0].key, 'WEB-1', 'newest update first');
  assert.equal(work.recent.length, 8);
  assert.equal(work.overdue[0].board, web);
});

test('matchesGroup: a column, a sprint (null: the backlog), both, or anything', () => {
  const i = { columnId: 'todo', sprintId: null };
  assert.equal(q.matchesGroup(i, { columnId: 'todo' }), true);
  assert.equal(q.matchesGroup(i, { sprintId: null }), true);
  assert.equal(q.matchesGroup({ columnId: 'todo' }, { sprintId: null }), true, 'no sprint at all is the backlog');
  assert.equal(q.matchesGroup(i, { columnId: 'todo', sprintId: 's1' }), false);
  assert.equal(q.matchesGroup(i, {}), true);
});

test('B-05: beforeIdAt turns a drop index into moveIssue\'s beforeId — the bottom is null (append)', () => {
  assert.equal(q.beforeIdAt(['a', 'b'], 0, 'c'), 'a');
  assert.equal(q.beforeIdAt(['a', 'b'], 1, 'c'), 'b');
  assert.equal(q.beforeIdAt(['a', 'b'], 2, 'c'), null, 'below the last card of a 2-card column: append');
  assert.equal(q.beforeIdAt(['a', 'b', 'c'], 2, 'a'), null, 'same column, dragged to the end (arrayMove index 2)');
  assert.equal(q.beforeIdAt(['a', 'b', 'c'], 1, 'a'), 'c');
  assert.equal(q.beforeIdAt([], 0, 'x'), null, 'an empty column');
  const b = life();
  const todo = q.groupIntoColumns(b)[0].issues.map((i) => i.id); // epic, van, tax
  for (let index = 0; index <= todo.length; index += 1) {
    const moved = ops.moveIssue(b, 'read', { columnId: 'todo', beforeId: q.beforeIdAt(todo, index, 'read') }, ctx);
    assert.equal(q.groupIntoColumns(moved)[0].issues.map((i) => i.id).indexOf('read'), index, `dropped at ${index}`);
  }
});
