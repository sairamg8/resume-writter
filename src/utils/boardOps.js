// Every board mutation as a pure `(board, args, ctx) → board` — the store (useBoardStore) wraps
// each one, saves the result and stamps the board's updatedAt; the pages never change a board
// any other way. A mutation that changes nothing returns the very board it was given (the store
// then saves nothing). Refusals are silent no-ops here (a column delete with no target, a second
// active sprint): the store and the pages check first and say why. The issue mutations live in
// boardIssueOps.js and are re-exported, so this is the one import. `ctx.now` is the time in ms.
// Pure: no React, no '@/' aliases (tests/unit/board-ops.unit.mjs imports it directly).
import { newId } from './ids.js';
import { ACTIVITY_CAP, CATEGORY_IDS, COLUMN_CATEGORIES, DEFAULT_SPRINT_DAYS, MODE_IDS } from '../constants/boards.js';
import {
  addDays, cleanTitle, columnById, isDoneColumn, isLocalISO, issueById, keyError, sprintById, todayISO,
} from './boardModel.js';
import { recategorized, setStatus } from './boardIssueOps.js';

export {
  addIssue, deleteIssue, duplicateIssue, makeIssue, moveIssue, removedIssue, restoreIssue, setStatus, updateIssue,
} from './boardIssueOps.js';

const nowOf = (ctx) => ctx?.now ?? Date.now();
const mapById = (list, id, fn) => list.map((x) => (x.id === id ? fn(x) : x));
const text = (v, fallback = '') => (typeof v === 'string' ? v : fallback);
const categoryName = (id) => COLUMN_CATEGORIES.find((c) => c.id === id)?.name ?? id;

/** A WIP limit: a whole number ≥ 1 (digits typed in a field too), else none (null). */
function wipOf(v) {
  const n = typeof v === 'string' && v.trim() ? Number(v) : v;
  return Number.isInteger(n) && n >= 1 ? n : null;
}

// ── The project itself ────────────────────────────────────────────────────────────────────

/**
 * Change the project's own fields: title (never blank), key (refused, with everything else in the
 * patch, while keyError finds a reason — `boards` is every project, for uniqueness), description,
 * color, starred, mode, hideDoneAfterDays (a whole number of days ≥ 0; null never hides).
 */
export function updateBoardFields(board, patch = {}, boards = []) {
  if ('key' in patch && patch.key !== board.key && keyError(patch.key, boards, board.id)) return board;
  const next = { ...board };
  if ('title' in patch && cleanTitle(patch.title)) next.title = cleanTitle(patch.title);
  if ('key' in patch) next.key = patch.key;
  if ('description' in patch) next.description = text(patch.description);
  if ('color' in patch && typeof patch.color === 'string' && patch.color) next.color = patch.color;
  if ('starred' in patch) next.starred = Boolean(patch.starred);
  if ('mode' in patch && MODE_IDS.includes(patch.mode)) next.mode = patch.mode;
  if ('hideDoneAfterDays' in patch) {
    const days = patch.hideDoneAfterDays;
    if (days === null || (Number.isInteger(days) && days >= 0)) next.hideDoneAfterDays = days;
  }
  return Object.keys(next).every((k) => next[k] === board[k]) ? board : next;
}

// ── Columns ───────────────────────────────────────────────────────────────────────────────

/**
 * Add a column: `title` (required), `category` (default 'inprogress'), `wipLimit`; at `index`, or
 * — for an open column — before the first done one, so Done stays last.
 */
export function addColumn(board, { id = newId('col'), title, category, wipLimit = null, index } = {}) {
  const name = cleanTitle(title);
  if (!name) return board;
  const column = { id, title: name, category: CATEGORY_IDS.includes(category) ? category : 'inprogress', wipLimit: wipOf(wipLimit) };
  const firstDone = board.columns.findIndex(isDoneColumn);
  let at = Number.isInteger(index) ? index : board.columns.length;
  if (!Number.isInteger(index) && column.category !== 'done' && firstDone !== -1) at = firstDone;
  const columns = [...board.columns];
  columns.splice(Math.max(0, Math.min(at, columns.length)), 0, column);
  return { ...board, columns };
}

/**
 * Rename a column, set its WIP limit (null: none) or its category. A column that becomes done
 * resolves its issues (resolvedAt now, what repeats made again, as a move to Done); one that stops
 * being done reopens them — a status change in each one's history either way (recategorized).
 */
export function updateColumn(board, columnId, patch = {}, ctx = {}) {
  const column = columnById(board, columnId);
  if (!column) return board;
  const next = { ...column };
  if ('title' in patch && cleanTitle(patch.title)) next.title = cleanTitle(patch.title);
  if ('wipLimit' in patch) next.wipLimit = wipOf(patch.wipLimit);
  if ('category' in patch && CATEGORY_IDS.includes(patch.category)) next.category = patch.category;
  if (Object.keys(next).every((k) => next[k] === column[k])) return board;
  const updated = { ...board, columns: mapById(board.columns, columnId, () => next) };
  if (isDoneColumn(next) === isDoneColumn(column)) return updated;
  const names = { from: categoryName(column.category), to: categoryName(next.category) };
  return recategorized(updated, columnId, isDoneColumn(next), names, ctx);
}

/**
 * Delete a column. Its issues move to `targetColumnId` (a status change each), so none is ever
 * lost: a column that holds issues is not deleted without a target, nor is the last column.
 */
export function deleteColumn(board, columnId, targetColumnId = null, ctx = {}) {
  if (!columnById(board, columnId) || board.columns.length < 2) return board;
  const ids = board.issues.filter((i) => i.columnId === columnId).map((i) => i.id);
  if (ids.length && (!columnById(board, targetColumnId) || targetColumnId === columnId)) return board;
  const moved = ids.length ? setStatus(board, ids, targetColumnId, ctx) : board;
  return { ...moved, columns: moved.columns.filter((c) => c.id !== columnId) };
}

/** Move a column to `toIndex` (clamped). */
export function moveColumn(board, columnId, toIndex) {
  const from = board.columns.findIndex((c) => c.id === columnId);
  if (from === -1) return board;
  const columns = board.columns.filter((c) => c.id !== columnId);
  const at = Math.max(0, Math.min(Number.isInteger(toIndex) ? toIndex : columns.length, columns.length));
  if (at === from) return board;
  columns.splice(at, 0, board.columns[from]);
  return { ...board, columns };
}

// ── Labels ────────────────────────────────────────────────────────────────────────────────

const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();

/** Add a label (`name` required, unique on the board case aside — the store hands back the existing one). */
export function addLabel(board, { id = newId('label'), name, color } = {}) {
  const n = cleanTitle(name);
  if (!n || board.labels.some((l) => sameName(l.name, n))) return board;
  return { ...board, labels: [...board.labels, { id, name: n, color: text(color) || '#6b7280' }] };
}

/** Rename or recolour a label; a name another label has is refused. */
export function updateLabel(board, labelId, patch = {}) {
  const label = board.labels.find((l) => l.id === labelId);
  if (!label) return board;
  const n = 'name' in patch ? cleanTitle(patch.name) : label.name;
  if (!n || board.labels.some((l) => l.id !== labelId && sameName(l.name, n))) return board;
  const color = typeof patch.color === 'string' && patch.color ? patch.color : label.color;
  if (n === label.name && color === label.color) return board;
  return { ...board, labels: mapById(board.labels, labelId, () => ({ ...label, name: n, color })) };
}

/** Delete a label: it comes off every issue that had it. */
export function deleteLabel(board, labelId) {
  if (!board.labels.some((l) => l.id === labelId)) return board;
  return {
    ...board,
    labels: board.labels.filter((l) => l.id !== labelId),
    issues: board.issues.map((i) => (i.labelIds.includes(labelId) ? { ...i, labelIds: i.labelIds.filter((l) => l !== labelId) } : i)),
  };
}

// ── Comments ──────────────────────────────────────────────────────────────────────────────

function mapIssue(board, issueId, fn) {
  const issue = issueById(board, issueId);
  const next = issue && fn(issue);
  return next && next !== issue ? { ...board, issues: mapById(board.issues, issueId, () => next) } : board;
}

/** Add a comment (text required) — recorded in the issue's history. */
export function addComment(board, issueId, { id = newId('cmt'), text: body } = {}, ctx = {}) {
  const t = text(body).trim();
  if (!t) return board;
  const now = nowOf(ctx);
  return mapIssue(board, issueId, (i) => ({
    ...i,
    comments: [...i.comments, { id, text: t, createdAt: now, editedAt: null }],
    activity: [...i.activity, { id: newId('act'), at: now, kind: 'comment', field: null, from: null, to: id }].slice(-ACTIVITY_CAP),
    updatedAt: now,
  }));
}

/** Edit a comment's text (never blank: delete it instead); editedAt is stamped. */
export function updateComment(board, issueId, commentId, body, ctx = {}) {
  const t = text(body).trim();
  const now = nowOf(ctx);
  return mapIssue(board, issueId, (i) => {
    const c = i.comments.find((x) => x.id === commentId);
    if (!t || !c || c.text === t) return i;
    return { ...i, comments: mapById(i.comments, commentId, () => ({ ...c, text: t, editedAt: now })), updatedAt: now };
  });
}

export function deleteComment(board, issueId, commentId, ctx = {}) {
  return mapIssue(board, issueId, (i) => (i.comments.some((c) => c.id === commentId)
    ? { ...i, comments: i.comments.filter((c) => c.id !== commentId), updatedAt: nowOf(ctx) }
    : i));
}

// ── Sprints (scrum) ───────────────────────────────────────────────────────────────────────

const dateOr = (v, fallback) => (isLocalISO(v) ? v : fallback);

/** Add a future sprint; unnamed, it is "<KEY> Sprint <n>". */
export function addSprint(board, { id = newId('sprint'), name, goal, startDate, endDate } = {}) {
  const sprint = {
    id,
    name: cleanTitle(name) || `${board.key} Sprint ${board.sprints.length + 1}`,
    goal: text(goal),
    startDate: dateOr(startDate, ''),
    endDate: dateOr(endDate, ''),
    state: 'future',
    completedAt: null,
  };
  return { ...board, sprints: [...board.sprints, sprint] };
}

/** Rename a sprint, change its goal or dates. */
export function updateSprint(board, sprintId, patch = {}) {
  const s = sprintById(board, sprintId);
  if (!s) return board;
  const next = {
    ...s,
    name: 'name' in patch && cleanTitle(patch.name) ? cleanTitle(patch.name) : s.name,
    goal: 'goal' in patch ? text(patch.goal) : s.goal,
    startDate: 'startDate' in patch ? dateOr(patch.startDate, '') : s.startDate,
    endDate: 'endDate' in patch ? dateOr(patch.endDate, '') : s.endDate,
  };
  return Object.keys(next).every((k) => next[k] === s[k]) ? board : { ...board, sprints: mapById(board.sprints, sprintId, () => next) };
}

/**
 * Start a future sprint — only while no other is active. Dates default to today and two weeks on;
 * an end before the start is the start.
 */
export function startSprint(board, sprintId, patch = {}, ctx = {}) {
  const s = sprintById(board, sprintId);
  if (!s || s.state !== 'future' || board.sprints.some((x) => x.state === 'active')) return board;
  const startDate = dateOr(patch.startDate, dateOr(s.startDate, todayISO(nowOf(ctx))));
  let endDate = dateOr(patch.endDate, dateOr(s.endDate, addDays(startDate, DEFAULT_SPRINT_DAYS)));
  if (endDate < startDate) endDate = startDate;
  const next = {
    ...s,
    name: cleanTitle(patch.name) || s.name,
    goal: 'goal' in patch ? text(patch.goal) : s.goal,
    startDate,
    endDate,
    state: 'active',
  };
  return { ...board, sprints: mapById(board.sprints, sprintId, () => next) };
}

/**
 * Complete the active sprint: its done issues keep its id (the sprint's record); its open ones go
 * to `moveOpenTo` — a future sprint's id — or to the backlog (null, or a sprint that cannot take them).
 */
export function completeSprint(board, sprintId, { moveOpenTo = null } = {}, ctx = {}) {
  const s = sprintById(board, sprintId);
  if (!s || s.state !== 'active') return board;
  const now = nowOf(ctx);
  const to = sprintById(board, moveOpenTo)?.state === 'future' ? moveOpenTo : null;
  const issues = board.issues.map((i) => {
    if (i.sprintId !== sprintId || isDoneColumn(columnById(board, i.columnId))) return i;
    return { ...i, sprintId: to, updatedAt: now };
  });
  return { ...board, issues, sprints: mapById(board.sprints, sprintId, (x) => ({ ...x, state: 'closed', completedAt: now })) };
}

/** Delete a sprint: its issues go to the backlog. */
export function deleteSprint(board, sprintId, ctx = {}) {
  if (!sprintById(board, sprintId)) return board;
  const now = nowOf(ctx);
  return {
    ...board,
    sprints: board.sprints.filter((s) => s.id !== sprintId),
    issues: board.issues.map((i) => (i.sprintId === sprintId ? { ...i, sprintId: null, updatedAt: now } : i)),
  };
}
