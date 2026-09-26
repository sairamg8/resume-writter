// Unit tests for a card dragged into another column on the board page (B-05): src/utils/boardView.js's
// dragPreview says where the card shows while it is over that column, previewLists shows it there
// (the target column's sortable list then opens a gap where it will land, and its own column closes
// up), and dropTarget reads the drop off those same lists. Before, the target column never held the
// card, so a drop on its last card always went above it: the bottom of a column holding 2 or more
// cards could not be reached from another column, and nothing showed where the card would land.
// Each drag here is played as Board.jsx plays it — onDragOver for each card or column the pointer
// crosses, then onDragEnd — and the move applied with the real boardOps.moveIssue. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ops from '../../src/utils/boardOps.js';
import { createBoard } from '../../src/utils/boardModel.js';
import { boardLists, dragPreview, dropTarget, previewLists } from '../../src/utils/boardView.js';

const ctx = { now: new Date(2026, 8, 24, 10, 0).getTime() };

/** A board with columns todo / doing / done and issues `cards` (`[id, columnId]`, in rank order). */
function boardWith(cards) {
  let b = createBoard({ title: 'Launch', key: 'LAUNCH', template: 'kanban' }, { now: ctx.now - 1000 });
  b = { ...b, columns: [
    { id: 'todo', title: 'To Do', category: 'todo', wipLimit: null },
    { id: 'doing', title: 'In Progress', category: 'inprogress', wipLimit: null },
    { id: 'done', title: 'Done', category: 'done', wipLimit: null },
  ] };
  for (const [id, columnId] of cards) b = ops.addIssue(b, { id, title: id, columnId }, ctx);
  return b;
}

/** `{ columnId: [cardId…] }` for `lists`. */
const ids = (lists) => Object.fromEntries(lists.map((l) => [l.id, l.cards.map((c) => c.id)]));
/** What the page shows of `b`. */
const shown = (b) => ids(boardLists(b, { now: ctx.now }));

// dnd-kit's `over` as Board.jsx hands it to boardView: a card, or a column's body.
const overCard = (id) => ({ id, data: { type: 'card' } });
const overList = (id) => ({ id, data: { type: 'list' } });

/**
 * Drag card `id` across `steps` (each `{ over, below }`: what the pointer is over, and whether the
 * dragged card's middle is below the hovered card's) and drop it on `drop`, as Board.jsx does.
 * Returns the board after the drop and the lists as they showed at the drop.
 */
function drag(b, id, steps, drop) {
  const lists = boardLists(b, { now: ctx.now });
  let preview = null;
  for (const { over, below = false } of steps) preview = dragPreview(lists, id, over, preview, { below });
  const at = previewLists(lists, id, preview);
  const move = dropTarget(b, { id, type: 'card' }, drop, { now: ctx.now, lists: at });
  return { board: move ? ops.moveIssue(b, move.issueId, move.target, ctx) : b, showing: ids(at) };
}

test('B-05: a card dropped below the last card of another column with 2 cards lands at its bottom', () => {
  const b = boardWith([['copy', 'todo'], ['hero', 'todo'], ['pricing', 'doing']]);
  // The overlay's middle below 'hero': the gap opens under it, and the drop lands in the gap.
  const r = drag(b, 'pricing', [{ over: overCard('hero'), below: true }], overCard('pricing'));
  assert.deepEqual(r.showing, { todo: ['copy', 'hero', 'pricing'], doing: [], done: [] }, 'the gap is at the bottom');
  assert.deepEqual(shown(r.board), { todo: ['copy', 'hero', 'pricing'], doing: [], done: [] });
  // Entering over 'hero' from above opens the gap above it; moving on down over 'hero' — now in the
  // same sortable list — takes 'hero's place, as arrayMove does: the bottom again.
  const s = drag(b, 'pricing', [{ over: overCard('hero') }, { over: overCard('pricing') }, { over: overCard('hero') }], overCard('hero'));
  assert.deepEqual(s.showing.todo, ['copy', 'pricing', 'hero'], 'the gap opened above hero');
  assert.deepEqual(shown(s.board).todo, ['copy', 'hero', 'pricing']);
});

test('into a column of 4, a dragged card reaches every place, the bottom included, where its gap showed', () => {
  const four = ['c1', 'c2', 'c3', 'c4'];
  const b = boardWith([...four.map((id) => [id, 'todo']), ['X', 'doing'], ['Y', 'doing']]);
  for (let k = 0; k <= four.length; k += 1) {
    const step = k < four.length ? { over: overCard(four[k]) } : { over: overCard('c4'), below: true };
    const r = drag(b, 'X', [step], overCard('X'));
    const want = [...four.slice(0, k), 'X', ...four.slice(k)];
    assert.deepEqual(r.showing.todo, want, `gap at ${k}`);
    assert.deepEqual(shown(r.board), { todo: want, doing: ['Y'], done: [] }, `dropped at ${k}`);
  }
  // Dropped on the column's empty space (below its cards, over "Create issue"): its bottom.
  const e = drag(b, 'X', [{ over: overList('todo') }], overList('todo'));
  assert.deepEqual(e.showing.todo, [...four, 'X']);
  assert.deepEqual(shown(e.board).todo, [...four, 'X']);
});

test('the preview: the card leaves its own column and shows in the one it is over, and comes back', () => {
  const b = boardWith([['A', 'todo'], ['B', 'todo'], ['P', 'doing']]);
  const lists = boardLists(b, { now: ctx.now });
  const into = dragPreview(lists, 'A', overCard('P'), null);
  assert.deepEqual(into, { columnId: 'doing', beforeId: 'P' });
  assert.deepEqual(ids(previewLists(lists, 'A', into)), { todo: ['B'], doing: ['A', 'P'], done: [] });
  // Over the column it already shows in (a card there, or its own gap): the sortable list moves the
  // cards aside itself, so the preview stays as it is.
  assert.equal(dragPreview(lists, 'A', overCard('P'), into), into);
  assert.equal(dragPreview(lists, 'A', overCard('A'), into), into);
  assert.equal(dragPreview(lists, 'A', overList('doing'), into), into);
  // Over an empty column: its bottom; back over its own column, or outside every column: its own place.
  assert.deepEqual(dragPreview(lists, 'A', overList('done'), into), { columnId: 'done', beforeId: null });
  assert.equal(dragPreview(lists, 'A', overCard('B'), into), null);
  assert.equal(dragPreview(lists, 'A', overList('todo'), into), null);
  assert.equal(dragPreview(lists, 'A', null, into), null);
  // Within its own column there is no preview: the lists are the page's own.
  assert.equal(dragPreview(lists, 'A', overCard('B'), null), null);
  assert.equal(previewLists(lists, 'A', null), lists);
  assert.equal(previewLists(lists, 'A', { columnId: 'nope', beforeId: null }), lists);
});

test('a drag that goes into another column and comes back moves nothing, and no drop loses a card', () => {
  const b = boardWith([['A', 'todo'], ['B', 'todo'], ['P', 'doing'], ['Q', 'doing']]);
  const back = drag(b, 'A', [{ over: overCard('Q') }, { over: overCard('B') }], overCard('A'));
  assert.equal(back.board, b, 'dropped on itself at home: the same board, nothing saved');
  for (const over of ['P', 'Q']) {
    for (const below of [false, true]) {
      for (const drop of [overCard('A'), overCard('P'), overCard('Q'), overList('doing')]) {
        const r = drag(b, 'A', [{ over: overCard(over), below }], drop);
        assert.deepEqual(Object.values(shown(r.board)).flat().sort(), ['A', 'B', 'P', 'Q'], `${over} ${below} ${drop.id}`);
        assert.equal(r.board.issues.find((i) => i.id === 'A').columnId, 'doing');
      }
    }
  }
});
