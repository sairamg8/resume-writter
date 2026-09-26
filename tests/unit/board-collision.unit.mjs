// Unit tests for what a card dragged on the board page is over (B-17): src/utils/boardDnd.js's
// boardCollision, run on dnd-kit's own pointerWithin and closestCorners with the board's layout —
// the page header and toolbar above two columns (each a droppable section, its cards droppables
// inside it), the gap between the columns, and the "Add column" button after them. Before, the page
// used closestCorners, which always names the nearest droppable: a card released over the header or
// "Add column" still moved to the nearest column, and no drop could be called off. Now a drop
// outside every column has no `over`, and Board.jsx's onDragEnd moves nothing. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closestCorners } from '@dnd-kit/core';
import { boardCollision } from '../../src/utils/boardDnd.js';

const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });

// The board at 1280px: header and toolbar down to y 120, then 'To Do' (x 32–304) holding two cards
// and 'In Progress' (x 312–584) holding one; "Add column" at x 592. Only the columns and cards drop.
const LAYOUT = [
  ['todo', 'list', box(32, 120, 272, 300)],
  ['copy', 'card', box(36, 164, 264, 80)],
  ['hero', 'card', box(36, 248, 264, 80)],
  ['doing', 'list', box(312, 120, 272, 216)],
  ['pricing', 'card', box(316, 164, 264, 80)],
];
const droppableContainers = LAYOUT.map(([id, type]) => ({ id, data: { current: { type } } }));
const droppableRects = new Map(LAYOUT.map(([id, , rect]) => [id, rect]));

/** What the page would be told the card is over with the pointer at (x, y), the overlay under it. */
function args(x, y) {
  return {
    active: { id: 'pricing' },
    collisionRect: box(x - 132, y - 40, 264, 80),
    droppableContainers,
    droppableRects,
    pointerCoordinates: x == null ? null : { x, y },
  };
}
const ids = (collisions) => collisions.map((c) => c.id);

test('B-17: released outside every column — header, toolbar, the gap between columns, "Add column" — nothing is under it', () => {
  for (const [where, x, y] of [['page header', 200, 20], ['toolbar', 400, 90], ['between the columns', 308, 200], ['Add column', 610, 140], ['below the columns', 200, 700]]) {
    assert.deepEqual(boardCollision(args(x, y)), [], where);
    // What the page used before: closestCorners names a droppable wherever the card is.
    assert.ok(closestCorners(args(x, y)).length > 0, `closestCorners over the ${where}`);
  }
});

test('over a card: that card first, then the column holding it', () => {
  assert.deepEqual(ids(boardCollision(args(150, 300))), ['hero', 'todo']);
  assert.deepEqual(ids(boardCollision(args(40, 170))), ['copy', 'todo'], 'at the card\'s very corner');
  assert.deepEqual(ids(boardCollision(args(450, 200))), ['pricing', 'doing']);
});

test('over a column\'s name or its empty space below its cards: that column (a drop there lands at its foot)', () => {
  assert.deepEqual(ids(boardCollision(args(150, 140))), ['todo'], 'its header');
  assert.deepEqual(ids(boardCollision(args(150, 400))), ['todo'], 'below its last card');
  assert.deepEqual(ids(boardCollision(args(450, 300))), ['doing']);
});

test('a drag with no pointer (a keyboard\'s) keeps closestCorners', () => {
  const noPointer = args(null, null);
  noPointer.collisionRect = box(316, 250, 264, 80);
  assert.deepEqual(boardCollision(noPointer), closestCorners(noPointer));
  assert.ok(boardCollision(noPointer).length > 0);
});
