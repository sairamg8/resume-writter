// A v2 board from this browser's saved list or an imported .json, made safe for every board page
// — the projects table, the board, the backlog, the issue modal. Both ways a board comes in go
// through readBoard() then completeBoard() (boardStorage.js, boardTransfer.js), so they cannot
// disagree on what a board is, or on what a repair lost. The same never-destroy-what-cannot-be-
// read contract as normalizeJob.js: readBoard reports `lost` whenever it left something out or
// replaced it, so the raw value is backed up before the next save (storageBackup.loadSavedList);
// completeBoard only adds what the pages address things by, and loses nothing. A v1 board is
// migrated first (boardMigrate.js). Pure (tests/unit/normalize-board.unit.mjs).
import { newId } from './ids.js';
import { deriveKey, isValidKey } from './boardModel.js';
import { isEntry, readBoardFields } from './boardReaders.js';

/** True when `v` can be a board at all: an object that is not an array. */
export const isBoardEntry = isEntry;

/**
 * The board every page can use, and whether reading it lost anything, as `{ kept, lost }` —
 * the entry reader boardStorage hands storageBackup.readSavedList. Unreadable issues, columns,
 * labels, sprints, checklist items, comments and history entries are left out; bad values of
 * the known fields become their defaults (lost when they held something). Unknown fields are
 * kept. kept is null for a value that is not a board at all.
 */
export function readBoard(board) {
  return readBoardFields(board);
}

/** readBoard's board, or null. */
export function normalizeBoard(board) {
  return readBoard(board).kept;
}

/**
 * `entries`, each with an id no earlier one has — a new `<prefix>_…` where it has none or one
 * already taken. `seen` is one set for the whole board (B-15): issues are moved and opened by id,
 * and two parts sharing one (a hand-edited or merged file) moved or deleted together.
 */
function withOwnIds(entries, prefix, seen) {
  return entries.map((e) => {
    const id = e.id && !seen.has(e.id) ? e.id : newId(prefix);
    seen.add(id);
    return id === e.id ? e : { ...e, id };
  });
}

/**
 * Issue numbers unique on the board: the first holder keeps its number, the rest get new ones —
 * from `nextNumber` up, never below it: a number under it may have been a deleted issue's, and
 * numbers are never given out twice (an old link to LIFE-7 must not open another issue).
 */
function withOwnNumbers(issues, nextNumber) {
  const taken = new Set();
  let next = issues.reduce((n, i) => Math.max(n, (i.number ?? 0) + 1), nextNumber);
  return issues.map((i) => {
    if (i.number && !taken.has(i.number)) {
      taken.add(i.number);
      return i;
    }
    taken.add(next);
    next += 1;
    return { ...i, number: next - 1 };
  });
}

/**
 * `board` (readBoard's) with what the pages address its parts by, nothing lost:
 *   ids        the board's own; every issue, column, label, sprint, checklist item, comment and
 *              history entry unique across the board, the first holder keeping its id (B-15)
 *   key        a valid key (derived from the title when it is not one; unique: addressableBoards)
 *   columns    at least one: a board with none gets To Do and Done
 *   references an issue's column that is gone → the first column; labels, epic (an epic of this
 *              board, never itself, never for an epic), sprint and next occurrence that are gone → none
 *   sprints    one active at most: later ones become future
 *   numbers    unique; nextNumber above every number, so none is reused
 */
export function completeBoard(board) {
  const seen = new Set();
  let columns = withOwnIds(board.columns, 'col', seen);
  if (!columns.length) {
    columns = [['To Do', 'todo'], ['Done', 'done']].map(([title, category]) => ({ id: newId('col'), title, category, wipLimit: null }));
  }
  const labels = withOwnIds(board.labels, 'label', seen);
  let active = false;
  const sprints = withOwnIds(board.sprints, 'sprint', seen).map((s) => {
    if (s.state !== 'active') return s;
    if (active) return { ...s, state: 'future' };
    active = true;
    return s;
  });
  const nextNumber = Number.isInteger(board.nextNumber) && board.nextNumber > 0 ? board.nextNumber : 1;
  const issues = withOwnNumbers(withOwnIds(board.issues, 'issue', seen), nextNumber).map((i) => ({
    ...i,
    checklist: withOwnIds(i.checklist, 'chk', seen),
    comments: withOwnIds(i.comments, 'cmt', seen),
    activity: withOwnIds(i.activity, 'act', seen),
  }));

  const columnIds = new Set(columns.map((c) => c.id));
  const labelIds = new Set(labels.map((l) => l.id));
  const sprintIds = new Set(sprints.map((s) => s.id));
  const epicIds = new Set(issues.filter((i) => i.type === 'epic').map((i) => i.id));
  const issueIds = new Set(issues.map((i) => i.id));
  const repaired = issues.map((i) => ({
    ...i,
    columnId: columnIds.has(i.columnId) ? i.columnId : columns[0].id,
    labelIds: i.labelIds.filter((l) => labelIds.has(l)),
    epicId: i.type !== 'epic' && i.epicId !== i.id && epicIds.has(i.epicId) ? i.epicId : null,
    sprintId: sprintIds.has(i.sprintId) ? i.sprintId : null,
    recurrenceNextId: issueIds.has(i.recurrenceNextId) ? i.recurrenceNextId : null,
  }));

  return {
    ...board,
    id: board.id || newId('board'),
    key: isValidKey(board.key) ? board.key : deriveKey(board.title),
    columns,
    labels,
    sprints,
    issues: repaired,
    nextNumber: repaired.reduce((n, i) => Math.max(n, i.number + 1), nextNumber),
  };
}

/**
 * `boards` (each completeBoard's) each with an id and a key no earlier board has — the first
 * keeps them, the one a link opens; a later one gets a new id, or a key derived from its title
 * (its issue keys change with it: `?issue=KEY-N` must name one issue). Nothing is lost.
 */
export function addressableBoards(boards) {
  const ids = new Set();
  const keys = new Set();
  const everyKey = boards.map((b) => b.key);
  return boards.map((b) => {
    let out = b;
    if (ids.has(b.id)) out = { ...out, id: newId('board') };
    ids.add(out.id);
    if (keys.has(b.key)) out = { ...out, key: deriveKey(b.title, [...keys, ...everyKey]) };
    keys.add(out.key);
    return out;
  });
}

