// What the board page (src/pages/Board.jsx) shows of a v2 project, and where a drag lands in it.
// The page's column and card components were written for v1 boards (lists of cards); the store
// holds v2 projects (columns, and issues that each name their column, in one rank). boardLists
// is the one place that reads a project as lists of cards, and dropTarget the one place that turns
// a drop into the store's moveColumn / moveIssue — so the page keeps no index maths of its own.
// While a card is dragged into another column, dragPreview says where it shows there and
// previewLists shows it in that place (the gap it will land in, B-05); dropTarget then reads the drop
// off those same lists, so the card lands where the gap was.
// Which issues the board shows is boardQuery's (the plan's board view): a scrum board its active
// sprint's, a kanban board all but the done ones resolved longer ago than hideDoneAfterDays — and
// never an epic: an epic holds issues (the backlog page lists epics), each card naming its own.
// Pure (tests/unit/board-drop.unit.mjs).
import { activeSprint } from './boardModel.js';
import { columnCounts, groupIntoColumns, visibleOnBoard } from './boardQuery.js';

/**
 * The sprint the board shows: a scrum board's active one, else null. A scrum board with no sprint
 * started shows every issue as a kanban board does: nothing in this app starts a sprint yet (the
 * backlog page is to come), and a board that showed nothing would hide every issue on it.
 */
export function boardSprint(board) {
  return board.mode === 'scrum' ? activeSprint(board) ?? null : null;
}

/** The issues the board shows, in rank order (see boardSprint): never an epic. */
function shownIssues(board, now) {
  return visibleOnBoard(boardSprint(board) ? board : { ...board, mode: 'kanban' }, { now }).filter((i) => i.type !== 'epic');
}

/** How many done issues are off the board for being resolved longer ago than hideDoneAfterDays. */
export function hiddenDoneCount(board, { now = Date.now() } = {}) {
  if (boardSprint(board)) return 0;
  return board.issues.filter((i) => i.type !== 'epic').length - shownIssues(board, now).length;
}

/** A label as a card shows it — `{ id, name, color }` — for each of the issue's labels that exists. */
function labelsOf(board, issue) {
  return issue.labelIds.map((id) => board.labels.find((l) => l.id === id)).filter(Boolean);
}

/** The epic `issue` belongs to, as a card names it — `{ id, title }` — or null. */
function epicOf(board, issue) {
  const epic = issue.epicId ? board.issues.find((i) => i.id === issue.epicId && i.type === 'epic') : null;
  return epic ? { id: epic.id, title: epic.title } : null;
}

/** `issue` as a card shows it: with `labels` for its labelIds and `epic` for its epicId. */
export function boardCard(board, issue) {
  return { ...issue, labels: labelsOf(board, issue), epic: epicOf(board, issue) };
}

/**
 * The project's columns in order, each as `{ id, title, limit, wip, cards }`: the issues the board
 * shows in that column in rank order, each as a card — the issue with `labels` for its labelIds
 * and `epic` for its epicId —
 * and the column's WIP limit (null: none) with its state over those cards ('under' | 'at' |
 * 'over', null without a limit). `now` (ms) dates hideDoneAfterDays.
 */
export function boardLists(board, { now = Date.now() } = {}) {
  const issues = shownIssues(board, now);
  const counts = columnCounts(board, issues);
  return groupIntoColumns(board, issues).map(({ column, issues: list }) => ({
    id: column.id,
    title: column.title,
    limit: counts[column.id].limit,
    wip: counts[column.id].state,
    cards: list.map((i) => boardCard(board, i)),
  }));
}

/**
 * The lists as they show while card `activeId` is dragged, `preview` (dragPreview's) saying where:
 * the card taken out of its own column and put in `preview.columnId` before `preview.beforeId`, or
 * at its bottom when that is null. That column's sortable list then holds the card, so it opens a
 * gap where it will land, and the card's own column closes up. No preview (or one naming a column or
 * card not on the board): `lists` as they are.
 */
export function previewLists(lists, activeId, preview) {
  if (!preview) return lists;
  const card = lists.flatMap((l) => l.cards).find((c) => c.id === activeId);
  if (!card || !lists.some((l) => l.id === preview.columnId)) return lists;
  return lists.map((l) => {
    const cards = l.cards.filter((c) => c.id !== activeId);
    if (l.id !== preview.columnId) return cards.length === l.cards.length ? l : { ...l, cards };
    const at = preview.beforeId == null ? -1 : cards.findIndex((c) => c.id === preview.beforeId);
    return { ...l, cards: at === -1 ? [...cards, card] : [...cards.slice(0, at), card, ...cards.slice(at)] };
  });
}

/**
 * Where card `activeId` shows while it is dragged over `over` (dnd-kit's, as dropTarget takes it),
 * as `{ columnId, beforeId }` for previewLists, or null for its own place. `current` is where it
 * shows now. Over the column it already shows in, nothing changes: that column's sortable list moves
 * the cards aside itself. Over its own column it goes back to its own place; outside every column
 * too, so a drop there visibly moves nothing. Over another column it goes into it: before the card
 * under it — after that card when `below` (the dragged card's middle is below the hovered card's) —
 * or at the bottom over the column's empty space.
 */
export function dragPreview(lists, activeId, over, current, { below = false } = {}) {
  if (!over) return null;
  const home = lists.find((l) => l.cards.some((c) => c.id === activeId));
  if (!home) return null;
  const shown = previewLists(lists, activeId, current);
  const isCard = over.data?.type === 'card';
  const target = isCard ? shown.find((l) => l.cards.some((c) => c.id === over.id)) : shown.find((l) => l.id === over.id);
  if (!target) return current ?? null;
  if (target.cards.some((c) => c.id === activeId)) return current ?? null;
  if (target.id === home.id) return null;
  if (!isCard) return { columnId: target.id, beforeId: null };
  const ids = target.cards.map((c) => c.id);
  return { columnId: target.id, beforeId: ids[ids.indexOf(over.id) + (below ? 1 : 0)] ?? null };
}

/**
 * Where a drag of `active` (`{ id, type: 'card' | 'list' }`) dropped on `over` (dnd-kit's: `{ id,
 * data: { type, listId? } }`, or null) lands, as the store's move:
 *   { kind: 'column', columnId, toIndex }                       a list, to the index of the list under it
 *   { kind: 'issue', issueId, target: { columnId, beforeId } }  a card (boardOps.moveIssue's target)
 * or null when the drop moves nothing; `now` as boardLists takes it. `lists` are the lists as the
 * page shows them at the drop — previewLists', when the drag put the card in another column — and
 * boardLists' when not given. A card dropped on another card takes that card's place, as arrayMove
 * does: before it, but after it when it moves down the column it shows in (the card it was dropped
 * on moves up) — so a card dragged into another column reaches its bottom too (B-05). A card dropped
 * on its own gap in another column lands in that gap; on itself in its own column it moves nothing.
 * A card dropped on a column's empty space goes to that column's bottom.
 */
export function dropTarget(board, active, over, { now = Date.now(), lists = boardLists(board, { now }) } = {}) {
  if (!active || !over) return null;
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
    const toList = listOf(over.id);
    if (!toList) return null;
    const ids = toList.cards.map((c) => c.id);
    if (over.id === active.id) {
      const home = board.issues.find((i) => i.id === active.id)?.columnId;
      if (toList.id === home) return null;
      return { kind: 'issue', issueId: active.id, target: { columnId: toList.id, beforeId: ids[ids.indexOf(active.id) + 1] ?? null } };
    }
    let beforeId = over.id;
    if (toList.id === fromList.id) {
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
