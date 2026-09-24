// Unit tests for making a saved or imported v2 board readable (src/utils/normalizeBoard.js,
// boardReaders.js): the same never-destroy contract as normalize-job.unit.mjs — what cannot be
// read is left out and reported (lost, so it is backed up first), repairs that keep everything
// are not a loss, ids are unique across the whole board (B-15), references that point nowhere
// are let go. The v1 → v2 migration has its own file (board-migrate.unit.mjs). Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addressableBoards, completeBoard, isBoardEntry, normalizeBoard, readBoard } from '../../src/utils/normalizeBoard.js';

const issue = (id, extra = {}) => ({
  id, number: 1, type: 'task', title: id, description: '', columnId: 'todo', priority: 'medium', labelIds: [], due: '',
  startDate: '', estimate: null, epicId: null, sprintId: null, checklist: [], comments: [], activity: [], recurrence: 'none',
  recurrenceNextId: null, createdAt: 1, updatedAt: 1, resolvedAt: null, ...extra,
});
const board = (extra = {}) => ({
  id: 'b', key: 'LIFE', title: 'Life', description: '', color: '#6366f1', starred: false, mode: 'kanban',
  columns: [{ id: 'todo', title: 'To Do', category: 'todo', wipLimit: null }, { id: 'done', title: 'Done', category: 'done', wipLimit: null }],
  labels: [{ id: 'home', name: 'Home', color: '#3b82f6' }],
  sprints: [], issues: [issue('i1')], nextNumber: 2, hideDoneAfterDays: 14, createdAt: 1, updatedAt: 1, dataVersion: 2, ...extra,
});
const complete = (raw) => completeBoard(readBoard(raw).kept);

test('a readable board reads back as it was, with nothing lost; unknown fields are kept', () => {
  const b = board({ archived: true, issues: [issue('i1', { flagged: true })] });
  const { kept, lost } = readBoard(b);
  assert.equal(lost, false);
  assert.deepEqual(complete(b), b);
  assert.equal(kept.archived, true, 'a later build\'s field survives this one');
  assert.equal(kept.issues[0].flagged, true);
});

test('only an object that is not a list is a board', () => {
  for (const v of [null, undefined, 'junk', 5, true, [], [board()]]) {
    assert.equal(normalizeBoard(v), null, JSON.stringify(v));
    assert.equal(isBoardEntry(v), false);
  }
  assert.equal(readBoard('junk').lost, true);
  assert.equal(readBoard(null).lost, false);
});

test('B-02: missing or null parts read as empty lists and lose nothing; a part that is not a list is a loss', () => {
  const read = readBoard({ id: 'b', key: 'LIFE', title: 'B', columns: null });
  assert.equal(read.lost, false);
  const b = completeBoard(read.kept);
  for (const part of ['labels', 'sprints', 'issues']) assert.deepEqual(b[part], [], part);
  assert.deepEqual(b.columns.map((c) => [c.title, c.category]), [['To Do', 'todo'], ['Done', 'done']], 'a board with no columns gets two');
  assert.equal(readBoard(board({ issues: 'junk' })).lost, true);
  assert.equal(readBoard(board({ issues: [issue('i1', { checklist: 'x' })] })).lost, true);
  assert.equal(readBoard(board({ issues: [issue('i1', { checklist: null, comments: undefined })] })).lost, false);
});

test('B-15: ids are unique across the whole board — issues, columns, labels, sprints, checklist items, comments', () => {
  const b = complete(board({
    columns: [{ id: 'dup', title: 'A', category: 'todo' }, { id: 'done', title: 'Done', category: 'done' }],
    labels: [{ id: 'dup', name: 'L', color: '#000' }],
    sprints: [{ id: 'dup', name: 'S', state: 'future' }],
    issues: [
      issue('dup', { columnId: 'dup', checklist: [{ id: 'dup', text: 'a' }, { id: 'c1', text: 'b' }], comments: [{ id: 'c1', text: 'hi' }] }),
      issue('i2', { number: 2, columnId: 'done', checklist: [{ id: 'c1', text: 'c' }] }),
      issue('i2', { number: 3, title: 'second i2' }),
    ],
  }));
  const all = [
    ...b.columns, ...b.labels, ...b.sprints, ...b.issues,
    ...b.issues.flatMap((i) => [...i.checklist, ...i.comments, ...i.activity]),
  ].map((x) => x.id);
  assert.equal(new Set(all).size, all.length, all.join());
  assert.equal(b.columns[0].id, 'dup', 'the first holder (a column) keeps it');
  assert.equal(b.issues[0].columnId, 'dup', 'and what points at it still finds it');
  assert.deepEqual(b.issues.map((i) => i.title), ['dup', 'i2', 'second i2'], 'nothing left out');
  assert.equal(b.issues[1].id, 'i2');
});

test('references that point nowhere are let go: column → first column, labels, epic, sprint, next occurrence', () => {
  const b = complete(board({
    sprints: [{ id: 's1', name: 'S1', state: 'future' }],
    issues: [
      issue('e', { type: 'epic', epicId: 'e' }),
      issue('t', { number: 2, columnId: 'gone', labelIds: ['home', 'gone', 'home', 7], epicId: 'e', sprintId: 's1', recurrenceNextId: 'e' }),
      issue('u', { number: 3, epicId: 't', sprintId: 'gone', recurrenceNextId: 'gone' }),
      issue('v', { number: 4, epicId: 'u2' }),
    ],
  }));
  const [e, t, u, v] = b.issues;
  assert.equal(e.epicId, null, 'an epic is in no epic');
  assert.deepEqual([t.columnId, t.labelIds, t.epicId, t.sprintId, t.recurrenceNextId], ['todo', ['home'], 'e', 's1', 'e']);
  assert.deepEqual([u.epicId, u.sprintId, u.recurrenceNextId], [null, null, null], 't is not an epic');
  assert.equal(v.epicId, null);
});

test('bad values: a missing one takes its default quietly; a wrong one takes it and is reported', () => {
  const quiet = readBoard(board({ issues: [{ id: 'x', title: 'X' }], mode: undefined }));
  assert.equal(quiet.lost, false);
  const x = quiet.kept.issues[0];
  assert.deepEqual([x.type, x.priority, x.recurrence, x.due, x.estimate, x.labelIds], ['task', 'medium', 'none', '', null, []]);
  for (const [field, value, expected] of [
    ['type', 'feature', 'task'], ['priority', 'urgent', 'medium'], ['recurrence', 'hourly', 'none'],
    ['due', '2026-02-30', ''], ['due', 'tomorrow', ''], ['estimate', 'lots', null], ['title', { a: 1 }, ''],
  ]) {
    const r = readBoard(board({ issues: [issue('i', { [field]: value })] }));
    assert.equal(r.lost, true, `${field}: ${JSON.stringify(value)}`);
    assert.deepEqual(r.kept.issues[0][field], expected, field);
  }
  const kept = readBoard(board({ issues: [issue('i', { title: 42, estimate: '3', due: '2026-09-23' })] }));
  assert.equal(kept.lost, false, 'a number as its digits, numeric text as a number: nothing lost');
  assert.deepEqual([kept.kept.issues[0].title, kept.kept.issues[0].estimate], ['42', 3]);
  assert.equal(readBoard(board({ mode: 'waterfall' })).kept.mode, 'kanban');
  assert.equal(readBoard(board({ columns: [{ id: 'c', title: 'C', category: 'blocked' }] })).lost, true);
});

test('unreadable entries are left out and reported: a non-object issue, a checklist item with no text', () => {
  const r = readBoard(board({ issues: [null, issue('i1', { checklist: [{ id: 'a', text: 'ok' }, { id: 'b' }, 'x'] }), 7] }));
  assert.equal(r.lost, true);
  assert.deepEqual(r.kept.issues.map((i) => i.id), ['i1']);
  assert.deepEqual(r.kept.issues[0].checklist.map((c) => c.text), ['ok']);
  assert.equal(readBoard(board({ issues: [issue('i', { checklist: [{ text: 5, done: 1 }] })] })).lost, false);
});

test('numbers: unique on the board, missing ones given, nextNumber above them all', () => {
  const b = complete(board({ nextNumber: 2, issues: [issue('a', { number: 5 }), issue('b', { number: 5 }), issue('c', { number: null }), issue('d', { number: 2 })] }));
  assert.deepEqual(b.issues.map((i) => i.number), [5, 6, 7, 2]);
  assert.equal(b.nextNumber, 8);
  assert.equal(complete(board({ nextNumber: 40 })).nextNumber, 40, 'a higher nextNumber stays: deleted numbers are not reused');
  const gap = complete(board({ nextNumber: 40, issues: [issue('a', { number: 5 }), issue('b', { number: null }), issue('c', { number: 5 })] }));
  assert.deepEqual(gap.issues.map((i) => i.number), [5, 40, 41], 'a number to give is never under nextNumber: 6…39 were deleted issues\'');
  assert.equal(gap.nextNumber, 42);
});

test('sprints: one active at most; keys: a bad one is derived, a lower-case one upper-cased', () => {
  const b = complete(board({ sprints: [{ id: 's1', name: 'A', state: 'active' }, { id: 's2', name: 'B', state: 'active' }] }));
  assert.deepEqual(b.sprints.map((s) => s.state), ['active', 'future']);
  assert.equal(complete(board({ key: 'life' })).key, 'LIFE');
  assert.equal(complete(board({ key: '1-bad', title: 'Website Relaunch' })).key, 'WR');
  assert.equal(complete(board({ key: undefined, title: 'Home' })).key, 'HOME');
});

test('history keeps the newest 200 entries; an entry needs a time', () => {
  const activity = Array.from({ length: 230 }, (_, n) => ({ id: `a${n}`, at: n, kind: 'field', field: 'title', from: 'x', to: 'y' }));
  const r = readBoard(board({ issues: [issue('i', { activity: [...activity, { id: 'bad', kind: 'field' }] })] }));
  assert.equal(r.kept.issues[0].activity.length, 200);
  assert.equal(r.kept.issues[0].activity[0].id, 'a30');
  assert.equal(r.lost, true, 'the entry with no time is the loss, not the cap');
});

test('addressableBoards: ids and keys unique across projects, the first keeping them', () => {
  const [a, b, c] = addressableBoards([complete(board()), complete(board({ title: 'Life too' })), complete(board({ id: 'c', key: 'LT' }))]);
  assert.deepEqual([a.id, a.key], ['b', 'LIFE']);
  assert.notEqual(b.id, 'b');
  assert.ok(!['LIFE', 'LT'].includes(b.key), b.key);
  assert.deepEqual([c.id, c.key], ['c', 'LT'], 'a later board keeps its own key');
});
