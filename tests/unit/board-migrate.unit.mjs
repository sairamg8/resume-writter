// Unit tests for the v1 → v2 migration (src/utils/boardMigrate.js through normalizeBoard): lists
// become columns, cards become issues in the same order, labels become board labels, nothing a
// card held is dropped, and what cannot be read is reported so it is backed up. The store keeps
// the v1 key as it was (board-store.unit.mjs). Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isUntouchedV1Demo, migrateV1 } from '../../src/utils/boardMigrate.js';
import { completeBoard, readBoard } from '../../src/utils/normalizeBoard.js';

const migrate = (v1) => {
  const { kept, lost } = readBoard(migrateV1(v1));
  return { board: kept && completeBoard(kept), lost };
};

const V1 = {
  id: 'board_1', title: 'Product launch', color: '#0ea5e9', createdAt: 100, updatedAt: 900,
  lists: [
    { id: 'l_todo', title: 'To do', cards: [
      { id: 'c1', title: 'Draft copy', description: '<p>Hook</p>', due: '2026-10-01', createdAt: 110, updatedAt: 120,
        labels: [{ name: 'Orange', color: '#f97316' }, { name: 'Blue', color: '#3b82f6' }],
        checklist: [{ id: 'k1', text: 'Outline', done: true }, { id: 'k2', text: 'Write', done: false }] },
      { id: 'c2', title: 'Pick image', labels: [{ name: 'Orange', color: '#f97316' }], checklist: [], createdAt: 130, updatedAt: 130 },
    ] },
    { id: 'l_doing', title: 'In progress', cards: [{ id: 'c3', title: 'Pricing', labels: [{ name: 'Urgent', color: '#f97316' }], createdAt: 140, updatedAt: 150 }] },
    { id: 'l_review', title: 'Review', cards: [] },
    { id: 'l_done', title: 'Done ✓', cards: [{ id: 'c4', title: 'Analytics', createdAt: 160, updatedAt: 170 }] },
  ],
};

test('v1 → v2: lists become columns (first to do, done-like done, the rest in progress), cards issues in order', () => {
  const { board, lost } = migrate(V1);
  assert.equal(lost, false);
  assert.deepEqual(board.columns.map((c) => [c.id, c.title, c.category]), [
    ['l_todo', 'To do', 'todo'], ['l_doing', 'In progress', 'inprogress'], ['l_review', 'Review', 'inprogress'], ['l_done', 'Done ✓', 'done'],
  ]);
  assert.deepEqual(board.issues.map((i) => [i.id, i.number, i.columnId, i.title]), [
    ['c1', 1, 'l_todo', 'Draft copy'], ['c2', 2, 'l_todo', 'Pick image'], ['c3', 3, 'l_doing', 'Pricing'], ['c4', 4, 'l_done', 'Analytics'],
  ]);
  assert.equal(board.nextNumber, 5);
  assert.deepEqual([board.id, board.key, board.title, board.color, board.mode, board.dataVersion], ['board_1', 'PL', 'Product launch', '#0ea5e9', 'kanban', 2]);
  assert.deepEqual([board.createdAt, board.updatedAt], [100, 900]);
});

test('v1 → v2: everything a card held is kept — description, due, checklist, timestamps, labels', () => {
  const { board } = migrate(V1);
  const c1 = board.issues[0];
  assert.deepEqual([c1.description, c1.due, c1.createdAt, c1.updatedAt, c1.type, c1.priority], ['<p>Hook</p>', '2026-10-01', 110, 120, 'task', 'medium']);
  assert.deepEqual(c1.checklist.map((k) => [k.id, k.text, k.done]), [['k1', 'Outline', true], ['k2', 'Write', false]]);
  assert.deepEqual(board.labels.map((l) => [l.name, l.color]), [['Orange', '#f97316'], ['Blue', '#3b82f6'], ['Urgent', '#f97316']],
    'one label per colour and name: two cards\' Orange is one label, Urgent (same colour) another');
  const name = (id) => board.labels.find((l) => l.id === id).name;
  assert.deepEqual(board.issues.map((i) => i.labelIds.map(name)), [['Orange', 'Blue'], ['Orange'], ['Urgent'], []]);
  assert.deepEqual(board.issues.map((i) => i.resolvedAt), [null, null, null, 170], 'a card in Done is resolved when it was last updated');
});

test('B-02: a v1 list whose cards are missing or null migrates to an empty column, and nothing counts as lost', () => {
  const { board, lost } = migrate({ id: 'b', title: 'B', lists: [{ id: 'l', title: 'x' }, { id: 'm', title: 'y', cards: null }] });
  assert.equal(lost, false);
  assert.deepEqual(board.columns.map((c) => c.id), ['l', 'm']);
  assert.deepEqual(board.issues, []);
  assert.equal(migrate({ id: 'b', title: 'B', lists: [{ id: 'l', title: 'x', cards: 'junk' }] }).lost, true, 'cards that are not a list held something');
});

test('B-15: v1 cards sharing an id across lists (or with a list) get ids of their own, none lost', () => {
  const card = (id, title) => ({ id, title, checklist: [{ id: 'k', text: title }] });
  const { board } = migrate({ id: 'b', title: 'B', lists: [
    { id: 'l1', title: 'One', cards: [card('dup', 'Card in One')] },
    { id: 'l2', title: 'Two', cards: [card('dup', 'Card in Two'), card('z', 'Z')] },
    { id: 'x', title: 'X', cards: [card('x', 'Card sharing the list id')] },
  ] });
  const ids = [...board.columns, ...board.issues, ...board.issues.flatMap((i) => i.checklist)].map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, ids.join());
  assert.deepEqual(board.issues.map((i) => i.title), ['Card in One', 'Card in Two', 'Z', 'Card sharing the list id']);
  assert.equal(board.issues[0].id, 'dup');
  assert.deepEqual(board.issues.map((i) => i.columnId), ['l1', 'l2', 'l2', 'x']);
});

test('what v1 held that cannot be read is left out and reported (backed up by the store)', () => {
  for (const bad of [
    { lists: [{ id: 'l', title: 'x', cards: [null, 'text', { id: 'c', title: 'ok' }] }] },
    { lists: [{ id: 'l', title: 'x', cards: [{ id: 'c', title: 'ok', labels: [{ name: 'no colour' }] }] }] },
    { lists: [{ id: 'l', title: 'x', cards: [{ id: 'c', title: { t: 1 } }] }] },
    { lists: [7, { id: 'l', title: 'x', cards: [] }] },
    { lists: 'junk' },
  ]) {
    assert.equal(migrate({ id: 'b', title: 'B', ...bad }).lost, true, JSON.stringify(bad));
  }
  const { board } = migrate({ id: 'b', title: 'B', lists: [{ id: 'l', title: 'x', cards: [null, { id: 'c', title: 'ok' }] }] });
  assert.deepEqual(board.issues.map((i) => [i.title, i.number]), [['ok', 1]]);
  assert.equal(migrateV1('junk'), 'junk', 'not a board: handed on for readBoard to leave out');
});

test('isUntouchedV1Demo: the shipped demo only — one the user renamed or added to is theirs (B-14)', () => {
  assert.equal(isUntouchedV1Demo({ id: 'demo_board_1', updatedAt: 1749686400000, title: 'Product launch' }), true);
  assert.equal(isUntouchedV1Demo({ id: 'demo_board_1', updatedAt: 1758000000000, title: 'My launch' }), false);
  assert.equal(isUntouchedV1Demo({ id: 'board_x', updatedAt: 1749686400000 }), false);
  assert.equal(isUntouchedV1Demo(null), false);
});
