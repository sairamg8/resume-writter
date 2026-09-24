// What the board page (src/pages/Board.jsx) shows of a v2 project, and where a drag lands in it.
// The page's column and card components were written for v1 boards (lists of cards); the store
// holds v2 projects (columns, and issues that each name their column, in one rank). boardLists
// is the one place that reads a project as lists of cards, and dropTarget the one place that turns
// a drop into the store's moveColumn / moveIssue — so the page keeps no index maths of its own.
// Pure (tests/unit/board-drop.unit.mjs).

/** A label as a card shows it — `{ id, name, color }` — for each of the issue's labels that exists. */
function labelsOf(board, issue) {
  return issue.labelIds.map((id) => board.labels.find((l) => l.id === id)).filter(Boolean);
}

/**
 * The project's columns in order, each as `{ id, title, cards }`: the issues in that column in
 * rank order, each as a card — the issue with `labels` for its labelIds.
 */
export function boardLists(board) {
  return board.columns.map((c) => ({
    id: c.id,
    title: c.title,
    cards: board.issues.filter((i) => i.columnId === c.id).map((i) => ({ ...i, labels: labelsOf(board, i) })),
  }));
}

/**
 * Where a drag of `active` (`{ id, type: 'card' | 'list' }`) dropped on `over` (dnd-kit's: `{ id,
 * data: { type, listId? } }`, or null) lands, as the store's move:
 *   { kind: 'column', columnId, toIndex }                       a list, to the index of the list under it
 *   { kind: 'issue', issueId, target: { columnId, beforeId } }  a card (boardOps.moveIssue's target)
 * or null when the drop moves nothing. A card dropped on another card takes that card's place, as
 * arrayMove does: before it, but after it when it moves down its own column (the card it was
 * dropped on moves up). A card dropped on a column's empty space goes to that column's bottom.
 */
export function dropTarget(board, active, over) {
  if (!active || !over) return null;
  const lists = boardLists(board);
  const listOf = (cardId) => lists.find((l) => l.cards.some((c) => c.id === cardId));
  const overType = over.data?.type;

  if (active.type === 'list') {
    const overListId = overType === 'list' ? over.id : overType === 'card' ? listOf(over.id)?.id : undefined;
    const from = lists.findIndex((l) => l.id === active.id);
    const toIndex = lists.findIndex((l) => l.id === overListId);
    return from === -1 || toIndex === -1 || toIndex === from ? null : { kind: 'column', columnId: active.id, toIndex };
  }

  const fromList = listOf(active.id);
  if (!fromList) return null;
  if (overType === 'card') {
    if (over.id === active.id) return null;
    const toList = listOf(over.id);
    if (!toList) return null;
    let beforeId = over.id;
    if (toList.id === fromList.id) {
      const ids = toList.cards.map((c) => c.id);
      const from = ids.indexOf(active.id);
      const to = ids.indexOf(over.id);
      if (to > from) beforeId = ids[to + 1] ?? null;
    }
    return { kind: 'issue', issueId: active.id, target: { columnId: toList.id, beforeId } };
  }
  if (overType === 'list' && lists.some((l) => l.id === over.id)) {
    return { kind: 'issue', issueId: active.id, target: { columnId: over.id, beforeId: null } };
  }
  return null;
}
