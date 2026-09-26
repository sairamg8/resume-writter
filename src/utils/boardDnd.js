// What a card dragged on the board page (src/pages/Board.jsx), or a row dragged on the backlog
// (src/pages/Backlog.jsx), is over (B-17, R4-BRD-07). dnd-kit's closestCorners and closestCenter
// always name the nearest droppable, however far away it is: a card released over the page header,
// the toolbar, the gap between two columns or the "Add column" button still moved, to whichever card
// or column was nearest, and a backlog row released over the toolbar, the Epic panel or below the
// last section still moved too, so no drop could ever be called off. Both pages ask what is under
// the pointer instead: outside every column (every section) nothing is, onDragEnd gets `over` null,
// and the drop moves nothing. Tested in tests/unit/board-collision.unit.mjs.
import { closestCorners, pointerWithin } from '@dnd-kit/core';

// The draggable items: a board's cards and a backlog's rows (their lists and sections hold them).
const ITEM_TYPES = new Set(['card', 'row']);
const isItem = (collision) => ITEM_TYPES.has(collision.data?.droppableContainer?.data?.current?.type);

/**
 * dnd-kit collision detection for the board and the backlog: the droppables under the pointer —
 * the card (row) under it before the column (section) that holds it, so a drop on a card takes
 * that card's place — or none when the pointer is outside every column. A drag with no pointer (a
 * keyboard's) has nothing to be under, so it keeps closestCorners.
 */
export function boardCollision(args) {
  if (!args.pointerCoordinates) return closestCorners(args);
  const hits = pointerWithin(args);
  return [...hits.filter(isItem), ...hits.filter((c) => !isItem(c))];
}
