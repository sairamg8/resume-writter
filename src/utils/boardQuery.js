// What the board pages show, computed from a board and never stored: the filter bar's matches,
// the columns and swimlanes of the board view, the backlog's sprint sections, the list view's
// sort, WIP limits, sprint and epic totals, and "Your work" across every project. Everything
// keeps the rank (the issues' array order) unless a sort says otherwise, and takes `now` (ms)
// from the caller, so the tests can fix the day. Pure: no React, no '@/' aliases
// (tests/unit/board-query.unit.mjs imports it directly).
import { richTextToPlain } from './richText.js';
import { ISSUE_TYPES, PRIORITIES } from '../constants/boards.js';
import { activeSprint, addDays, isIssueDone, issueKey, statusColumn, todayISO } from './boardModel.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const PRIORITY_RANK = new Map(PRIORITIES.map((p) => [p.id, p.rank]));
const TYPE_RANK = new Map(ISSUE_TYPES.map((t, n) => [t.id, n]));
// Titles sort as the job list's text columns do (jobQuery, J-18): case and accents aside, numbers
// in them as numbers — 'Éclair' before 'Zoo', 'Step 2' before 'Step 10' (R5-HUNT5).
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/**
 * True when `issue` is in the group a drop or a new issue targets: the column `columnId` and/or
 * the sprint `sprintId` (null: the backlog); a dimension left undefined matches anything. The
 * board view groups by column and the backlog by sprint, so moveIssue places an issue "after
 * the last of its group" with this same test.
 */
export function matchesGroup(issue, { columnId, sprintId } = {}) {
  return (columnId === undefined || issue.columnId === columnId)
    && (sprintId === undefined || (issue.sprintId ?? null) === sprintId);
}

/**
 * The `beforeId` moveIssue takes for a drop at `index` of a column or section as the view shows
 * it (`visibleIds`, rank order): the issue at that index once the dragged one (`activeId`) is
 * out of the list — dnd-kit's arrayMove index, or the hovered index in another column — and
 * null at or past the end, which appends (B-05).
 */
export function beforeIdAt(visibleIds, index, activeId = null) {
  const others = visibleIds.filter((id) => id !== activeId);
  return Number.isInteger(index) && index >= 0 ? others[index] ?? null : null;
}

/**
 * Where a due date falls from `today`: 'overdue', 'today', 'week' (the next 7 days after today),
 * 'later', or 'none' without one.
 */
export function dueBucket(due, today) {
  if (!due) return 'none';
  if (due < today) return 'overdue';
  if (due === today) return 'today';
  return due <= addDays(today, 7) ? 'week' : 'later';
}

const anyOf = (list) => Array.isArray(list) && list.length > 0;

/**
 * `filters` without the epic and label ids that no longer name one of `board`'s epics or labels:
 * the filters are page state, and an epic deleted (or retyped) from the issue view, or a label
 * deleted, left an id that matched nothing and that no option could untick. The same object when
 * nothing is stale.
 */
export function liveFilters(board, filters = {}) {
  const epics = new Set(board.issues.filter((i) => i.type === 'epic').map((i) => i.id));
  const labels = new Set(board.labels.map((l) => l.id));
  const epicIds = Array.isArray(filters.epicIds) ? filters.epicIds.filter((id) => id === 'none' || epics.has(id)) : filters.epicIds;
  const labelIds = Array.isArray(filters.labelIds) ? filters.labelIds.filter((id) => labels.has(id)) : filters.labelIds;
  const same = (a, b) => a === b || (Array.isArray(a) && Array.isArray(b) && a.length === b.length);
  return same(epicIds, filters.epicIds) && same(labelIds, filters.labelIds) ? filters : { ...filters, epicIds, labelIds };
}

/**
 * The issues of `board` (or the given `issues`) that match the filter bar, in rank order:
 *   text       over the key ('life-12'), the title and the description as plain text, case aside
 *   types / priorities / labelIds   any of them (empty: all); labelIds — an issue with any of them
 *   epicIds    children of any of these epics; 'none' for issues in no epic
 *   due        'overdue' (open and past due), 'today', 'week' (today to 7 days on), 'none'
 *   onlyOpen   leave out resolved issues (in a done column)
 */
export function filterIssues(board, raw = {}, { now = Date.now(), issues = board.issues } = {}) {
  const filters = liveFilters(board, raw); // an epic or label since deleted filters nothing
  const today = todayISO(now);
  const q = typeof filters.text === 'string' ? filters.text.trim().toLowerCase() : '';
  return issues.filter((i) => {
    if (filters.onlyOpen && isIssueDone(board, i)) return false;
    if (anyOf(filters.types) && !filters.types.includes(i.type)) return false;
    if (anyOf(filters.priorities) && !filters.priorities.includes(i.priority)) return false;
    if (anyOf(filters.labelIds) && !i.labelIds.some((l) => filters.labelIds.includes(l))) return false;
    if (anyOf(filters.epicIds) && !filters.epicIds.includes(i.epicId ?? 'none')) return false;
    if (filters.due) {
      const bucket = dueBucket(i.due, today);
      if (filters.due === 'overdue' && (bucket !== 'overdue' || isIssueDone(board, i))) return false;
      if (filters.due === 'today' && bucket !== 'today') return false;
      if (filters.due === 'week' && bucket !== 'today' && bucket !== 'week') return false;
      if (filters.due === 'none' && bucket !== 'none') return false;
    }
    if (!q) return true;
    return issueKey(board, i).toLowerCase().includes(q) || i.title.toLowerCase().includes(q)
      || richTextToPlain(i.description || '').toLowerCase().includes(q);
  });
}

/**
 * The issues the board view shows: on a scrum board the active sprint's (none without one); on a
 * kanban board all but the done ones resolved more than hideDoneAfterDays ago (null: all).
 */
export function visibleOnBoard(board, { now = Date.now(), issues = board.issues } = {}) {
  if (board.mode === 'scrum') {
    const sprint = activeSprint(board);
    return sprint ? issues.filter((i) => i.sprintId === sprint.id) : [];
  }
  const days = board.hideDoneAfterDays;
  if (days === null || days === undefined) return issues;
  const cutoff = now - days * DAY_MS;
  return issues.filter((i) => !isIssueDone(board, i) || (i.resolvedAt ?? i.updatedAt ?? now) >= cutoff);
}

/** `issues` per column, in column order and rank order: `[{ column, issues }]`. */
export function groupIntoColumns(board, issues = board.issues) {
  const byColumn = new Map(board.columns.map((c) => [c.id, []]));
  for (const i of issues) {
    const column = statusColumn(board, i);
    if (column) byColumn.get(column.id).push(i);
  }
  return board.columns.map((column) => ({ column, issues: byColumn.get(column.id) }));
}

/**
 * `issues` in swimlanes, `by` 'none' | 'epic' | 'priority' | 'type': `[{ id, title, kind, issues }]`
 * — only lanes that hold issues; by epic, one lane per epic in rank order, "No epic" last.
 */
export function swimlanes(board, issues = board.issues, by = 'none') {
  const lane = (id, title, kind, list) => ({ id, title, kind, issues: list });
  if (by === 'epic') {
    const epics = board.issues.filter((i) => i.type === 'epic');
    const lanes = epics.map((e) => lane(e.id, e.title, 'epic', issues.filter((i) => i.epicId === e.id)));
    const ids = new Set(epics.map((e) => e.id));
    lanes.push(lane('none', 'No epic', 'epic', issues.filter((i) => !ids.has(i.epicId))));
    return lanes.filter((l) => l.issues.length);
  }
  if (by === 'priority') {
    return PRIORITIES.map((p) => lane(p.id, p.name, 'priority', issues.filter((i) => i.priority === p.id))).filter((l) => l.issues.length);
  }
  if (by === 'type') {
    return ISSUE_TYPES.map((t) => lane(t.id, t.name, 'type', issues.filter((i) => i.type === t.id))).filter((l) => l.issues.length);
  }
  return [lane('all', 'All issues', 'none', issues)];
}

/**
 * `issues` sorted `by` 'rank' | 'key' | 'type' | 'title' | 'status' | 'priority' | 'due' |
 * 'estimate' | 'updated' | 'created', `dir` 'asc' | 'desc'. Ties keep the rank; an issue with no
 * due date or no estimate sorts last either way; titles as text (collator).
 */
export function sortIssues(board, issues, by = 'rank', dir = 'asc') {
  const rank = new Map(board.issues.map((i, n) => [i.id, n]));
  const column = new Map(board.columns.map((c, n) => [c.id, n]));
  const value = {
    rank: (i) => rank.get(i.id) ?? Infinity,
    key: (i) => i.number,
    type: (i) => TYPE_RANK.get(i.type) ?? 99,
    title: (i) => i.title,
    status: (i) => column.get(statusColumn(board, i)?.id) ?? 99,
    priority: (i) => PRIORITY_RANK.get(i.priority) ?? 99,
    due: (i) => i.due || null,
    estimate: (i) => i.estimate ?? null,
    updated: (i) => i.updatedAt ?? 0,
    created: (i) => i.createdAt ?? 0,
  }[by] ?? ((i) => rank.get(i.id));
  const sign = dir === 'desc' ? -1 : 1;
  return [...issues].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null || vb === null) return va === vb ? rank.get(a.id) - rank.get(b.id) : va === null ? 1 : -1;
    const cmp = by === 'title' ? collator.compare(va, vb) : va === vb ? 0 : va < vb ? -1 : 1;
    if (cmp) return cmp * sign;
    return rank.get(a.id) - rank.get(b.id);
  });
}

/**
 * Per column id, `{ count, limit, state }`: state 'over' past the WIP limit, 'at' on it, 'under'
 * below it, null with no limit. Counts the given issues (the ones the board shows).
 */
export function columnCounts(board, issues = board.issues) {
  const out = {};
  for (const { column, issues: list } of groupIntoColumns(board, issues)) {
    const limit = column.wipLimit ?? null;
    let state = null;
    if (limit !== null) state = list.length > limit ? 'over' : list.length === limit ? 'at' : 'under';
    out[column.id] = { count: list.length, limit, state };
  }
  return out;
}

/**
 * A sum of story points as it is shown: an estimate is any number ≥ 0, so 0.1 + 0.2 added as
 * floats is 0.30000000000000004 — rounded to 2 decimals it reads 0.3 (R5-HUNT9-POINT-SUMS-FLOAT-NOISE).
 */
export const roundPoints = (n) => Math.round(n * 100) / 100;

/** `{ issues, open, done, points, donePoints }` over `issues` (story points from estimates). */
export function issueStats(board, issues) {
  const stats = { issues: issues.length, open: 0, done: 0, points: 0, donePoints: 0 };
  for (const i of issues) {
    const done = isIssueDone(board, i);
    stats[done ? 'done' : 'open'] += 1;
    stats.points += i.estimate ?? 0;
    if (done) stats.donePoints += i.estimate ?? 0;
  }
  stats.points = roundPoints(stats.points);
  stats.donePoints = roundPoints(stats.donePoints);
  return stats;
}

/** A backlog section's points by status category, the tracker's three bubbles: `{ todo, inprogress, done }`. */
export function pointsByCategory(board, issues) {
  const sum = { todo: 0, inprogress: 0, done: 0 };
  for (const i of issues) sum[statusColumn(board, i)?.category ?? 'todo'] += i.estimate ?? 0;
  for (const k of Object.keys(sum)) sum[k] = roundPoints(sum[k]);
  return sum;
}

/**
 * The backlog's sections, in order: the active sprint, each future sprint, then the backlog —
 * `[{ id, kind: 'sprint' | 'backlog', sprint, issues, stats }]`. The backlog holds the open
 * issues in no sprint (or in one that is gone or closed); resolved ones stay out of it.
 */
export function backlogSections(board, issues = board.issues) {
  const sprints = [...board.sprints.filter((s) => s.state === 'active'), ...board.sprints.filter((s) => s.state === 'future')];
  const inSprint = new Set(sprints.map((s) => s.id));
  const sections = sprints.map((sprint) => {
    const list = issues.filter((i) => i.sprintId === sprint.id);
    return { id: sprint.id, kind: 'sprint', sprint, issues: list, stats: issueStats(board, list) };
  });
  const backlog = issues.filter((i) => !inSprint.has(i.sprintId) && !isIssueDone(board, i));
  sections.push({ id: 'backlog', kind: 'backlog', sprint: null, issues: backlog, stats: issueStats(board, backlog) });
  return sections;
}

/** Totals of sprint `sprintId`'s issues (null: the backlog section's). */
export function sprintStats(board, sprintId) {
  const section = backlogSections(board).find((s) => (sprintId ? s.id === sprintId : s.kind === 'backlog'));
  return section ? section.stats : issueStats(board, board.issues.filter((i) => i.sprintId === sprintId));
}

/** The epics of a board, in rank order. */
export const epicsOf = (board) => board.issues.filter((i) => i.type === 'epic');

/** An epic's children, in rank order. */
export const childrenOf = (board, epicId) => board.issues.filter((i) => i.epicId === epicId);

/** `{ total, done, points, donePoints }` of an epic's children (its progress bar). */
export function epicProgress(board, epicId) {
  const s = issueStats(board, childrenOf(board, epicId));
  return { total: s.issues, done: s.done, points: s.points, donePoints: s.donePoints };
}

/**
 * "Your work" across every project, as rows `{ board, issue, key }`:
 *   overdue     open, due before today (oldest first)      today   open, due today
 *   week        open, due in the next 7 days (soonest first)
 *   inProgress  open, in an in-progress column, not in the three above (latest update first)
 *   recent      the 15 most recently updated issues, open or not
 */
export function yourWork(boards, now = Date.now()) {
  const today = todayISO(now);
  const out = { overdue: [], today: [], week: [], inProgress: [], recent: [] };
  const all = [];
  for (const board of boards) {
    for (const issue of board.issues) {
      const row = { board, issue, key: issueKey(board, issue) };
      all.push(row);
      if (isIssueDone(board, issue)) continue;
      const bucket = dueBucket(issue.due, today);
      if (bucket === 'overdue' || bucket === 'today' || bucket === 'week') out[bucket].push(row);
      else if (statusColumn(board, issue)?.category === 'inprogress') out.inProgress.push(row);
    }
  }
  const byDue = (a, b) => (a.issue.due < b.issue.due ? -1 : a.issue.due > b.issue.due ? 1 : 0);
  const byPriority = (a, b) => (PRIORITY_RANK.get(a.issue.priority) ?? 9) - (PRIORITY_RANK.get(b.issue.priority) ?? 9);
  const byUpdated = (a, b) => (b.issue.updatedAt ?? 0) - (a.issue.updatedAt ?? 0);
  out.overdue.sort(byDue);
  out.today.sort(byPriority);
  out.week.sort(byDue);
  out.inProgress.sort(byUpdated);
  out.recent = all.sort(byUpdated).slice(0, 15);
  return out;
}

/** `{ total, open, done }` of a project (the projects table). */
export function issueCounts(board) {
  const s = issueStats(board, board.issues);
  return { total: s.issues, open: s.open, done: s.done };
}
