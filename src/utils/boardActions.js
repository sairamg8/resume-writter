// Every action the board pages call, built over the store's two primitives — read the list, and
// replace it — so useBoardStore.js keeps only the storage and React wiring. Each action is a
// pure mutation from boardOps.js applied to one board; one that changes something stamps the
// board's updatedAt (per-board last-write-wins is how a later cloud sync merges two devices) and
// is saved by the store; one that changes nothing saves nothing. No React, no storage, no '@/'
// aliases: the store tests drive it through the real store (tests/unit/board-store*.unit.mjs).
import { newId } from './ids.js';
import { cleanTitle, createBoard, deriveKey, keyError as keyProblem } from './boardModel.js';
import * as ops from './boardOps.js';

/**
 * The actions, given the store's `boardsNow()` (the list now, loaded first) and
 * `setBoards(change)` (the list becomes change(list); the same list back saves nothing).
 * `now()` is the time in ms.
 */
export function createBoardActions({ boardsNow, setBoards, now = () => Date.now() }) {
  const findBoard = (id) => boardsNow().find((b) => b.id === id) ?? null;
  const findIn = (boardId, part, id) => findBoard(boardId)?.[part].find((x) => x.id === id) ?? null;

  /**
   * Apply the pure mutation `fn(board, ctx)` to board `boardId`; when it changes the board, save it
   * with a fresh updatedAt. Returns true when something changed.
   */
  function change(boardId, fn) {
    let changed = false;
    setBoards((boards) => {
      const at = now();
      const next = boards.map((b) => {
        if (b.id !== boardId) return b;
        const out = fn(b, { now: at });
        if (out === b) return b;
        changed = true;
        return { ...out, updatedAt: at };
      });
      return changed ? next : boards;
    });
    return changed;
  }

  // ── Projects ────────────────────────────────────────────────────────────────────────────

  /** Why `key` cannot be board `selfId`'s key, as a sentence; null when it can (the key field's live check). */
  const keyError = (key, selfId = null) => keyProblem(key, boardsNow(), selfId);

  /** A new project from a template (`{ title, key, template, color, description, mode }`); returns it. */
  function addBoard(fields = {}) {
    const board = createBoard(fields, { takenKeys: boardsNow().map((b) => b.key), now: now() });
    setBoards((boards) => [...boards, board]);
    return board;
  }

  /**
   * Change a project's fields (updateBoardFields); returns null, or why a new key was refused (then
   * nothing in the patch is applied).
   */
  function updateBoard(id, patch = {}) {
    const board = findBoard(id);
    if (board && 'key' in patch && patch.key !== board.key) {
      const reason = keyError(patch.key, id);
      if (reason) return reason;
    }
    change(id, (b) => ops.updateBoardFields(b, patch, boardsNow()));
    return null;
  }

  const toggleStar = (id) => change(id, (b) => ops.updateBoardFields(b, { starred: !b.starred }));

  /** Delete a project; returns `{ board, index }` for restoreBoard (the toast's Undo), or null. */
  function deleteBoard(id) {
    const boards = boardsNow();
    const index = boards.findIndex((b) => b.id === id);
    if (index === -1) return null;
    setBoards((list) => list.filter((b) => b.id !== id));
    return { board: boards[index], index };
  }

  /** Put a deleted project back where it was (a key another project took meanwhile is re-derived); true when it came back. */
  function restoreBoard(removed) {
    if (!removed?.board || findBoard(removed.board.id)) return false;
    setBoards((boards) => {
      const taken = boards.map((b) => b.key);
      const board = taken.includes(removed.board.key) ? { ...removed.board, key: deriveKey(removed.board.title, taken) } : removed.board;
      const at = Math.max(0, Math.min(removed.index ?? boards.length, boards.length));
      return [...boards.slice(0, at), board, ...boards.slice(at)];
    });
    return true;
  }

  // ── Columns, labels ─────────────────────────────────────────────────────────────────────

  /** Add a column (`{ title, category, wipLimit, index }`); returns it, or null. */
  function addColumn(boardId, fields = {}) {
    const id = newId('col');
    return change(boardId, (b) => ops.addColumn(b, { ...fields, id })) ? findIn(boardId, 'columns', id) : null;
  }
  const updateColumn = (boardId, columnId, patch) => change(boardId, (b, ctx) => ops.updateColumn(b, columnId, patch, ctx));
  /** Delete a column, its issues moving to `targetColumnId`; false when refused (no target, last column). */
  const deleteColumn = (boardId, columnId, targetColumnId) => change(boardId, (b, ctx) => ops.deleteColumn(b, columnId, targetColumnId, ctx));
  const moveColumn = (boardId, columnId, toIndex) => change(boardId, (b) => ops.moveColumn(b, columnId, toIndex));

  /** Add a label (`{ name, color }`); returns it — or the label that already has that name — or null. */
  function addLabel(boardId, fields = {}) {
    const id = newId('label');
    if (change(boardId, (b) => ops.addLabel(b, { ...fields, id }))) return findIn(boardId, 'labels', id);
    const name = cleanTitle(fields.name).toLowerCase();
    return findBoard(boardId)?.labels.find((l) => l.name.toLowerCase() === name) ?? null;
  }
  const updateLabel = (boardId, labelId, patch) => change(boardId, (b) => ops.updateLabel(b, labelId, patch));
  const deleteLabel = (boardId, labelId) => change(boardId, (b) => ops.deleteLabel(b, labelId));

  // ── Issues, comments ────────────────────────────────────────────────────────────────────

  /** Create an issue (`fields`: title required, the rest optional); returns it, or null. */
  function addIssue(boardId, fields = {}) {
    const id = newId('issue');
    return change(boardId, (b, ctx) => ops.addIssue(b, { ...fields, id }, ctx)) ? findIn(boardId, 'issues', id) : null;
  }
  const updateIssue = (boardId, issueId, patch) => change(boardId, (b, ctx) => ops.updateIssue(b, issueId, patch, ctx));
  /** Move an issue: `{ columnId, sprintId, beforeId }` (see boardOps.moveIssue). */
  const moveIssue = (boardId, issueId, target) => change(boardId, (b, ctx) => ops.moveIssue(b, issueId, target, ctx));

  /** Delete an issue; returns `{ issue, index, childIds }` for restoreIssue (the toast's Undo), or null. */
  function deleteIssue(boardId, issueId) {
    const board = findBoard(boardId);
    const removed = board && ops.removedIssue(board, issueId);
    if (!removed) return null;
    change(boardId, (b) => ops.deleteIssue(b, issueId));
    return removed;
  }
  /** Put a deleted issue back where it was, with its number; true when it came back. */
  const restoreIssue = (boardId, removed) => change(boardId, (b) => ops.restoreIssue(b, removed));

  /** Copy an issue (right after it); returns the copy, or null. */
  function duplicateIssue(boardId, issueId) {
    const id = newId('issue');
    return change(boardId, (b, ctx) => ops.duplicateIssue(b, issueId, ctx, { id })) ? findIn(boardId, 'issues', id) : null;
  }

  /** Add a comment; returns it, or null (blank text). */
  function addComment(boardId, issueId, text) {
    const id = newId('cmt');
    if (!change(boardId, (b, ctx) => ops.addComment(b, issueId, { id, text }, ctx))) return null;
    return findIn(boardId, 'issues', issueId)?.comments.find((c) => c.id === id) ?? null;
  }
  const updateComment = (boardId, issueId, commentId, text) => change(boardId, (b, ctx) => ops.updateComment(b, issueId, commentId, text, ctx));
  const deleteComment = (boardId, issueId, commentId) => change(boardId, (b, ctx) => ops.deleteComment(b, issueId, commentId, ctx));

  // ── Sprints ─────────────────────────────────────────────────────────────────────────────

  /** Add a future sprint (`{ name, goal, startDate, endDate }`); returns it, or null. */
  function addSprint(boardId, fields = {}) {
    const id = newId('sprint');
    return change(boardId, (b) => ops.addSprint(b, { ...fields, id })) ? findIn(boardId, 'sprints', id) : null;
  }
  const updateSprint = (boardId, sprintId, patch) => change(boardId, (b) => ops.updateSprint(b, sprintId, patch));
  /** Start a future sprint (`{ name, goal, startDate, endDate }`); false when another is active. */
  const startSprint = (boardId, sprintId, fields) => change(boardId, (b, ctx) => ops.startSprint(b, sprintId, fields, ctx));
  /** Complete the active sprint: open issues to `{ moveOpenTo }` (a future sprint's id) or the backlog. */
  const completeSprint = (boardId, sprintId, options) => change(boardId, (b, ctx) => ops.completeSprint(b, sprintId, options, ctx));
  /** Delete a sprint; its issues go to the backlog. */
  const deleteSprint = (boardId, sprintId) => change(boardId, (b, ctx) => ops.deleteSprint(b, sprintId, ctx));

  return {
    keyError, addBoard, updateBoard, deleteBoard, restoreBoard, toggleStar,
    addColumn, updateColumn, deleteColumn, moveColumn, addLabel, updateLabel, deleteLabel,
    addIssue, updateIssue, moveIssue, deleteIssue, restoreIssue, duplicateIssue,
    addComment, updateComment, deleteComment,
    addSprint, updateSprint, startSprint, completeSprint, deleteSprint,
  };
}
