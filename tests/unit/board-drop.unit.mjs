// Unit tests for the board page's drag-and-drop (R2-155, R2-159, R2-098): src/utils/boardView.js
// reads a v2 project as the page's lists of cards, and turns a drop into the store's move —
// applied here with the real boardOps.moveIssue / moveColumn, as the page does through the store.
// A card lands where it was dropped: before the card under it, after it when it moves down its
// own column (arrayMove's rule), at the bottom of a column's empty space (B-05); a drop on itself
// or outside moves nothing; no move ever loses or duplicates a card — even one that was saved
// sharing its id with a card in another list (R2-098, repaired by completeBoard). Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ops from '../../src/utils/boardOps.js';
import { createBoard } from '../../src/utils/boardModel.js';
import { completeBoard, readBoard } from '../../src/utils/normalizeBoard.js';
import { boardLists, dropTarget } from '../../src/utils/boardView.js';

const ctx = { now: new Date(2026, 8, 24, 10, 0).getTime() };

/** A board with columns todo / doing / done and issues `cards` (`[id, columnId]`, in rank order). */
function boardWith(cards) {
  let b = createBoard({ title: 'Life', key: 'LIFE', template: 'kanban' }, { now: ctx.now - 1000 });
  b = { ...b, columns: [
    { id: 'todo', title: 'To Do', category: 'todo', wipLimit: null },
    { id: 'doing', title: 'Doing', category: 'inprogress', wipLimit: null },
    { id: 'done', title: 'Done', category: 'done', wipLimit: null },
  ], labels: [{ id: 'home', name: 'Home', color: '#3b82f6' }] };
  for (const [id, columnId] of cards) b = ops.addIssue(b, { id, title: id, columnId }, ctx);
  return b;
}

/** What the page shows: `{ columnId: [cardId…] }`, in column order. */
const shown = (b) => Object.fromEntries(boardLists(b).map((l) => [l.id, l.cards.map((c) => c.id)]));

const card = (id) => ({ id, type: 'card' });
const overCard = (b, id) => ({ id, data: { type: 'card', listId: b.issues.find((i) => i.id === id).columnId } });
const overList = (id) => ({ id, data: { type: 'list' } });

/** Drop `active` on `over` and apply the move, as Board.jsx's onDragEnd does. */
function drop(b, active, over) {
  const move = dropTarget(b, active, over);
  if (!move) return b;
  if (move.kind === 'column') return ops.moveColumn(b, move.columnId, move.toIndex);
  return ops.moveIssue(b, move.issueId, move.target, ctx);
}

/** arrayMove, as dnd-kit's sortable list shows a drag within one list. */
const arrayMove = (list, from, to) => { const out = [...list]; out.splice(to, 0, ...out.splice(from, 1)); return out; };

test('boardLists: columns in order, each with its issues in rank order, labels resolved', () => {
  let b = boardWith([['A', 'todo'], ['B', 'doing'], ['C', 'todo']]);
  b = ops.updateIssue(b, 'A', { labelIds: ['home'] }, ctx);
  assert.deepEqual(shown(b), { todo: ['A', 'C'], doing: ['B'], done: [] });
  const a = boardLists(b)[0].cards[0];
  assert.deepEqual(a.labels, [{ id: 'home', name: 'Home', color: '#3b82f6' }]);
  assert.equal(a.title, 'A');
});

test('within one column a card reaches every index, as the sortable list shows it (arrayMove)', () => {
  const b = boardWith([['A', 'todo'], ['B', 'todo'], ['C', 'todo'], ['D', 'todo'], ['X', 'doing']]);
  const ids = ['A', 'B', 'C', 'D'];
  for (const [from, id] of ids.entries()) {
    for (const [to, target] of ids.entries()) {
      const after = drop(b, card(id), overCard(b, target));
      assert.deepEqual(shown(after).todo, arrayMove(ids, from, to), `${id} onto ${target}`);
      assert.deepEqual(shown(after).doing, ['X']);
    }
  }
});

test('into another column: before the card it is dropped on, or at the bottom of the column\'s empty space', () => {
  const b = boardWith([['A', 'todo'], ['B', 'todo'], ['P', 'doing'], ['Q', 'doing']]);
  assert.deepEqual(shown(drop(b, card('A'), overCard(b, 'P'))), { todo: ['B'], doing: ['A', 'P', 'Q'], done: [] });
  assert.deepEqual(shown(drop(b, card('A'), overCard(b, 'Q'))), { todo: ['B'], doing: ['P', 'A', 'Q'], done: [] });
  assert.deepEqual(shown(drop(b, card('A'), overList('doing'))), { todo: ['B'], doing: ['P', 'Q', 'A'], done: [] });
  assert.deepEqual(shown(drop(b, card('B'), overList('done'))), { todo: ['A'], doing: ['P', 'Q'], done: ['B'] });
  // Into Done resolves it, as any status change does.
  assert.ok(drop(b, card('B'), overList('done')).issues.find((i) => i.id === 'B').resolvedAt);
});

test('a drop that moves nothing: on itself, outside, on its own place, an unknown card or list', () => {
  const b = boardWith([['A', 'todo'], ['B', 'todo']]);
  assert.equal(dropTarget(b, card('A'), overCard(b, 'A')), null);
  assert.equal(dropTarget(b, card('A'), null), null);
  assert.equal(dropTarget(b, card('nope'), overCard(b, 'B')), null);
  assert.equal(dropTarget(b, card('A'), overList('nope')), null);
  assert.equal(dropTarget(b, { id: 'todo', type: 'list' }, overList('todo')), null);
  assert.equal(drop(b, card('B'), overList('todo')), b, 'already at the bottom: the same board, nothing saved');
});

test('a list moves to the index of the list, or of the card, it is dropped on', () => {
  const b = boardWith([['A', 'todo'], ['P', 'done']]);
  const order = (x) => x.columns.map((c) => c.id);
  assert.deepEqual(order(drop(b, { id: 'todo', type: 'list' }, overList('done'))), ['doing', 'done', 'todo']);
  assert.deepEqual(order(drop(b, { id: 'done', type: 'list' }, overCard(b, 'A'))), ['done', 'todo', 'doing']);
  assert.deepEqual(shown(drop(b, { id: 'done', type: 'list' }, overList('todo'))).done, ['P'], 'its cards go with it');
});

test('R2-098: two cards saved with one id in two lists — a drag of either loses neither', () => {
  const raw = {
    ...boardWith([]),
    issues: [
      { id: 'dup', number: 1, type: 'task', title: 'In To Do', columnId: 'todo' },
      { id: 'dup', number: 2, type: 'task', title: 'In Doing', columnId: 'doing' },
      { id: 'Z', number: 3, type: 'task', title: 'Z', columnId: 'done' },
    ],
  };
  const b = completeBoard(readBoard(raw).kept);
  const [first, second] = b.issues;
  assert.equal(first.id, 'dup', 'the first holder keeps its id');
  assert.notEqual(second.id, 'dup');
  for (const moving of [first.id, second.id]) {
    for (const over of [overCard(b, 'Z'), overList('todo'), overList('done')]) {
      const after = drop(b, card(moving), over);
      assert.deepEqual(after.issues.map((i) => i.title).sort(), ['In Doing', 'In To Do', 'Z'], `${moving} onto ${over.id}`);
      assert.equal(new Set(after.issues.map((i) => i.id)).size, 3);
    }
  }
});
