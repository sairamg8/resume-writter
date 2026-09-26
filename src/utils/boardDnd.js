// What a card dragged on the board page (src/pages/Board.jsx) is over (B-17). dnd-kit's
// closestCorners always names the nearest droppable, however far away it is: a card released over
// the page header, the toolbar, the gap between two columns or the "Add column" button still moved,
// to whichever card or column was nearest, so no drop could ever be called off. The board asks what
// is under the pointer instead: outside every column nothing is, onDragEnd gets `over` null, and the
// drop moves nothing. Tested in tests/unit/board-collision.unit.mjs.
import { closestCorners, pointerWithin } from '@dnd-kit/core';

const isCard = (collision) => collision.data?.droppableContainer?.data?.current?.type === 'card';

/**
 * dnd-kit collision detection for the board: the droppables under the pointer — the card under it
 * before the column that holds it, so a drop on a card takes that card's place — or none when the
 * pointer is outside every column. A drag with no pointer (a keyboard's) has nothing to be under,
 * so it keeps closestCorners.
 */
export function boardCollision(args) {
  if (!args.pointerCoordinates) return closestCorners(args);
  const hits = pointerWithin(args);
  return [...hits.filter(isCard), ...hits.filter((c) => !isCard(c))];
}
