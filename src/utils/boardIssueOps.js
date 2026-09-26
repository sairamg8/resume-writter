// The issue half of the pure board mutations (boardOps.js re-exports every one): each takes a
// board and returns the next board — the same object when nothing changed, so the store neither
// saves nor stamps a no-op — and stamps the issues it changes (updatedAt) and their history
// (activity). `ctx.now` is the time in ms (Date.now() by default); tests pass a fixed one.
// Pure: no React, no '@/' aliases (tests/unit/board-ops.unit.mjs imports it directly).
import { newId } from './ids.js';
import { richTextToPlain } from './richText.js';
import { ACTIVITY_CAP, PRIORITY_IDS, RECURRENCE_IDS, TYPE_IDS } from '../constants/boards.js';
import {
  cleanTitle, columnById, defaultColumnId, firstColumnOf, isDoneColumn, isLocalISO, issueById, issueKey,
  nextDue, sprintById, statusColumn, todayISO,
} from './boardModel.js';
import { matchesGroup } from './boardQuery.js';

const nowOf = (ctx) => ctx?.now ?? Date.now();

/** Consecutive edits of one field within this long are one history entry (a description typed in bursts). */
const MERGE_MS = 5 * 60 * 1000;

/**
 * `issue` with one more history entry, the newest ACTIVITY_CAP kept. A change to the field the
 * newest entry records, made within MERGE_MS, updates that entry instead (from stays the first
 * value); when that brings the field back where it started, the entry goes.
 */
function logged(issue, entry, now) {
  const activity = issue.activity || [];
  const last = activity[activity.length - 1];
  if (entry.kind === 'field' && last?.kind === 'field' && last.field === entry.field && now - last.at < MERGE_MS) {
    const merged = { ...last, at: now, to: entry.to };
    const rest = activity.slice(0, -1);
    return { ...issue, activity: merged.from === merged.to ? rest : [...rest, merged] };
  }
  return { ...issue, activity: [...activity, { id: newId('act'), at: now, field: null, from: null, to: null, ...entry }].slice(-ACTIVITY_CAP) };
}

const fieldEntry = (field, from, to) => ({ kind: 'field', field, from, to });

/** A column, sprint, epic or label list as the history shows it: the name at the time. */
const sprintName = (board, id) => (id ? sprintById(board, id)?.name ?? '' : 'Backlog');
const epicName = (board, id) => (id ? issueById(board, id)?.title ?? '' : '');
const labelNames = (board, ids) => ids.map((id) => board.labels.find((l) => l.id === id)?.name).filter(Boolean).join(', ');
const checklistCount = (list) => `${list.filter((c) => c.done).length}/${list.length}`;
/** A description in the history: its first 140 characters as plain text, not the whole HTML each time. */
const excerpt = (html) => richTextToPlain(html || '').replace(/\s+/g, ' ').trim().slice(0, 140);

/** A sprint an issue may be put in: one that exists and is not closed. */
const openSprintId = (board, id) => (id && sprintById(board, id) && sprintById(board, id).state !== 'closed' ? id : null);

/** An epic `issue` may belong to: an epic on this board, not itself; epics belong to none. */
function epicIdFor(board, type, id, selfId) {
  if (type === 'epic' || !id || id === selfId) return null;
  return issueById(board, id)?.type === 'epic' ? id : null;
}

/** Checklist items as given, each with an id and a boolean done; items without text are left out. */
function checklistOf(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  return items.filter((c) => c && (typeof c.text === 'string' || typeof c.text === 'number')).map((c) => {
    const id = typeof c.id === 'string' && c.id && !seen.has(c.id) ? c.id : newId('chk');
    seen.add(id);
    return { id, text: String(c.text), done: Boolean(c.done) };
  });
}

/** An estimate (story points): a number ≥ 0 (numeric text too), else null. */
function estimateOf(v) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * A new issue on `board` from `fields` (anything missing gets its default), numbered
 * board.nextNumber — the caller advances it. `createdFrom` names the issue it repeats or copies.
 */
export function makeIssue(board, fields, { id = newId('issue'), now, createdFrom = null } = {}) {
  const type = TYPE_IDS.includes(fields.type) ? fields.type : 'task';
  const columnId = columnById(board, fields.columnId) ? fields.columnId : defaultColumnId(board);
  return {
    id,
    number: board.nextNumber,
    type,
    title: cleanTitle(fields.title),
    description: typeof fields.description === 'string' ? fields.description : '',
    columnId,
    priority: PRIORITY_IDS.includes(fields.priority) ? fields.priority : 'medium',
    labelIds: [...new Set((fields.labelIds || []).filter((l) => board.labels.some((x) => x.id === l)))],
    due: isLocalISO(fields.due) ? fields.due : '',
    startDate: isLocalISO(fields.startDate) ? fields.startDate : '',
    estimate: estimateOf(fields.estimate),
    epicId: epicIdFor(board, type, fields.epicId, id),
    sprintId: openSprintId(board, fields.sprintId),
    checklist: checklistOf(fields.checklist),
    comments: [],
    activity: [{ id: newId('act'), at: now, kind: 'created', field: null, from: createdFrom, to: null }],
    recurrence: RECURRENCE_IDS.includes(fields.recurrence) ? fields.recurrence : 'none',
    recurrenceNextId: null,
    createdAt: now,
    updatedAt: now,
    resolvedAt: isDoneColumn(columnById(board, columnId)) ? now : null,
  };
}

/** Add an issue (`fields.title` required: nothing is added without one) at the end of the rank. */
export function addIssue(board, fields = {}, ctx = {}) {
  if (!cleanTitle(fields.title) || !board.columns.length) return board;
  const issue = makeIssue(board, fields, { id: fields.id, now: nowOf(ctx) });
  const next = { ...board, nextNumber: board.nextNumber + 1, issues: [...board.issues, issue] };
  return issue.resolvedAt ? spawnNext(next, issue.id, ctx) : next;
}

/** `issue` in column `columnId`: resolvedAt set on entering a done column, cleared on leaving. */
function withStatus(board, issue, columnId, now) {
  const from = statusColumn(board, issue);
  const to = columnById(board, columnId);
  if (!to || to.id === issue.columnId) return issue;
  let resolvedAt = issue.resolvedAt ?? null;
  if (isDoneColumn(to) && !isDoneColumn(from)) resolvedAt = now;
  if (!isDoneColumn(to)) resolvedAt = null;
  return logged({ ...issue, columnId, resolvedAt, updatedAt: now }, fieldEntry('status', from?.title ?? '', to.title), now);
}

/**
 * A recurring issue just resolved: its next occurrence, in the first to-do column — same type,
 * title, description, priority, labels, epic, estimate, sprint (while open) and checklist
 * (unticked), `due` stepped by the rule (nextDue). Once per resolution: an issue whose next
 * occurrence still exists spawns no second one when it is reopened and resolved again.
 */
function spawnNext(board, issueId, ctx) {
  const issue = issueById(board, issueId);
  if (!issue || !RECURRENCE_IDS.includes(issue.recurrence) || issue.recurrence === 'none') return board;
  if (issue.recurrenceNextId && issueById(board, issue.recurrenceNextId)) return board;
  const now = nowOf(ctx);
  // An open column, never a done one: made in one it would be born resolved and never repeat again
  // (a board's only to-do column turned Done, R4-BRD-09).
  const column = firstColumnOf(board, 'todo') ?? board.columns.find((c) => !isDoneColumn(c)) ?? board.columns[0];
  const next = makeIssue(board, {
    ...issue,
    columnId: column.id,
    due: nextDue(issue.due, issue.recurrence, todayISO(now)),
    startDate: '',
    checklist: issue.checklist.map((c) => ({ text: c.text, done: false })),
  }, { now, createdFrom: issueKey(board, issue) });
  const issues = board.issues.map((i) => (i.id === issueId ? { ...i, recurrenceNextId: next.id } : i));
  return { ...board, nextNumber: board.nextNumber + 1, issues: [...issues, next] };
}

/** Move the issues `ids` into column `columnId` (a status change each), spawning what recurs. */
export function setStatus(board, ids, columnId, ctx = {}) {
  const now = nowOf(ctx);
  const resolved = [];
  const issues = board.issues.map((i) => {
    if (!ids.includes(i.id)) return i;
    const next = withStatus(board, i, columnId, now);
    if (next.resolvedAt && !i.resolvedAt) resolved.push(i.id);
    return next;
  });
  if (issues.every((i, n) => i === board.issues[n])) return board;
  return resolved.reduce((b, id) => spawnNext(b, id, ctx), { ...board, issues });
}

/**
 * The issues of column `columnId` once its category changed so that it is done (`done` true) or no
 * longer done, `from` and `to` naming the categories as the history shows them. Resolved, each one's
 * next occurrence is made, as a move into a done column makes it; reopened, resolvedAt clears. A
 * status entry goes in each one's history either way (R4-BRD-09: the resolution was written straight
 * onto the issues, so a repeating one never came back and the history said nothing).
 */
export function recategorized(board, columnId, done, { from, to }, ctx = {}) {
  const now = nowOf(ctx);
  const resolved = [];
  const issues = board.issues.map((i) => {
    if (i.columnId !== columnId) return i;
    if (done && !i.resolvedAt) resolved.push(i.id);
    return logged({ ...i, resolvedAt: done ? i.resolvedAt ?? now : null, updatedAt: now }, fieldEntry('status', from, to), now);
  });
  return resolved.reduce((b, id) => spawnNext(b, id, ctx), { ...board, issues });
}

/**
 * Move an issue: into `columnId` (a status change) and/or `sprintId` (null: the backlog), and
 * to a place in the rank — before `beforeId`, or after the last issue of the target group (the
 * issues in that column and/or sprint) when beforeId is null; into an empty group it keeps its
 * rank. So a drop below a column's last card appends it (B-05), and every index of the column
 * can be reached. A column or sprint that does not exist (or a closed sprint) is not a target.
 */
export function moveIssue(board, issueId, { columnId, sprintId, beforeId = null } = {}, ctx = {}) {
  const from = board.issues.findIndex((i) => i.id === issueId);
  if (from === -1) return board;
  const now = nowOf(ctx);
  const group = {
    columnId: columnId !== undefined && columnById(board, columnId) ? columnId : undefined,
    sprintId: sprintId === null || (sprintId !== undefined && openSprintId(board, sprintId)) ? sprintId : undefined,
  };
  const issue = board.issues[from];
  let moved = group.columnId !== undefined ? withStatus(board, issue, group.columnId, now) : issue;
  if (group.sprintId !== undefined && group.sprintId !== (issue.sprintId ?? null)) {
    const entry = fieldEntry('sprint', sprintName(board, issue.sprintId), sprintName(board, group.sprintId));
    moved = logged({ ...moved, sprintId: group.sprintId, updatedAt: now }, entry, now);
  }
  const rest = board.issues.filter((_, n) => n !== from);
  let at = beforeId && beforeId !== issueId ? rest.findIndex((i) => i.id === beforeId) : -1;
  if (at === -1) {
    const last = rest.findLastIndex((i) => matchesGroup(i, group));
    at = last === -1 ? from : last + 1; // an empty group: its place in the rank is as good as any
  }
  const issues = [...rest.slice(0, at), moved, ...rest.slice(at)];
  // Same fields, same order within the group the view shows: nothing to save.
  const order = (list) => list.filter((i) => i.id === issueId || matchesGroup(i, group)).map((i) => i.id).join('\n');
  if (moved === issue && order(issues) === order(board.issues)) return board;
  const next = { ...board, issues };
  return moved.resolvedAt && !issue.resolvedAt ? spawnNext(next, issueId, ctx) : next;
}

/** Each field updateIssue takes: the value it stores for `v`, and how the history shows a value. */
const FIELDS = {
  title: { read: (b, v, i) => cleanTitle(v) || i.title },
  description: { read: (b, v) => (typeof v === 'string' ? v : ''), show: (b, v) => excerpt(v) },
  type: { read: (b, v, i) => (TYPE_IDS.includes(v) ? v : i.type) },
  priority: { read: (b, v, i) => (PRIORITY_IDS.includes(v) ? v : i.priority) },
  labelIds: { read: (b, v) => [...new Set((Array.isArray(v) ? v : []).filter((l) => b.labels.some((x) => x.id === l)))], show: labelNames, field: 'labels' },
  due: { read: (b, v) => (isLocalISO(v) ? v : '') },
  startDate: { read: (b, v) => (isLocalISO(v) ? v : '') },
  estimate: { read: (b, v) => estimateOf(v) },
  // null (or '') takes the issue out; an epic or sprint it cannot join leaves the field as it was —
  // a form sending a done issue's closed sprint back with an edit must not drop that record.
  epicId: { read: (b, v, i) => (v == null || v === '' ? null : epicIdFor(b, i.type, v, i.id) ?? i.epicId), show: epicName, field: 'epic' },
  sprintId: {
    read: (b, v, i) => (v == null || v === '' ? null : v === i.sprintId ? v : openSprintId(b, v) ?? i.sprintId),
    show: sprintName,
    field: 'sprint',
  },
  checklist: { read: (b, v) => checklistOf(v), show: (b, v) => checklistCount(v) },
  recurrence: { read: (b, v, i) => (RECURRENCE_IDS.includes(v) ? v : i.recurrence) },
};

const same = (a, b) => (Array.isArray(a) && Array.isArray(b) ? JSON.stringify(a) === JSON.stringify(b) : a === b);

/**
 * Change an issue's fields (FIELDS; `columnId` is a status change, as moveIssue makes it, rank
 * kept). Every field that really changes is recorded in its history. An issue that becomes an
 * epic leaves its epic; an epic that stops being one lets its children go.
 */
export function updateIssue(board, issueId, patch = {}, ctx = {}) {
  const original = issueById(board, issueId);
  if (!original) return board;
  const now = nowOf(ctx);
  let issue = original;
  for (const [key, spec] of Object.entries(FIELDS)) {
    if (!(key in patch)) continue;
    const value = spec.read(board, patch[key], issue);
    if (same(value, issue[key])) continue;
    const show = spec.show ?? ((b, v) => v);
    issue = logged({ ...issue, [key]: value, updatedAt: now }, fieldEntry(spec.field ?? key, show(board, issue[key]), show(board, value)), now);
  }
  if (issue.type === 'epic' && issue.epicId) issue = { ...issue, epicId: null };
  let next = issue === original ? board : { ...board, issues: board.issues.map((i) => (i.id === issueId ? issue : i)) };
  if (original.type === 'epic' && issue.type !== 'epic') {
    next = { ...next, issues: next.issues.map((i) => (i.epicId === issueId ? { ...i, epicId: null } : i)) };
  }
  return 'columnId' in patch ? setStatus(next, [issueId], patch.columnId, ctx) : next;
}

/** What deleteIssue takes away, for its Undo (restoreIssue): the issue, its place, its children. */
export function removedIssue(board, issueId) {
  const index = board.issues.findIndex((i) => i.id === issueId);
  if (index === -1) return null;
  return { issue: board.issues[index], index, childIds: board.issues.filter((i) => i.epicId === issueId).map((i) => i.id) };
}

/** Delete an issue; an epic's children stay, unlinked. Its number is never given out again. */
export function deleteIssue(board, issueId) {
  if (!issueById(board, issueId)) return board;
  const issues = board.issues.filter((i) => i.id !== issueId).map((i) => (i.epicId === issueId ? { ...i, epicId: null } : i));
  return { ...board, issues };
}

/**
 * Put back what deleteIssue took (`removed` from removedIssue): at its old place, its children
 * relinked where nothing else claimed them; a column, sprint or label gone since is let go.
 */
export function restoreIssue(board, removed) {
  if (!removed?.issue || issueById(board, removed.issue.id)) return board;
  const i = removed.issue;
  const issue = {
    ...i,
    columnId: columnById(board, i.columnId) ? i.columnId : defaultColumnId(board),
    sprintId: sprintById(board, i.sprintId) ? i.sprintId : null,
    labelIds: i.labelIds.filter((l) => board.labels.some((x) => x.id === l)),
  };
  const children = new Set(removed.childIds || []);
  const issues = board.issues.map((x) => (children.has(x.id) && !x.epicId ? { ...x, epicId: i.id } : x));
  const at = Math.max(0, Math.min(removed.index ?? issues.length, issues.length));
  return {
    ...board,
    nextNumber: Math.max(board.nextNumber, i.number + 1),
    issues: [...issues.slice(0, at), issue, ...issues.slice(at)],
  };
}

/** A copy of an issue right after it in the rank: new number, "(copy)" title, no comments or history. */
export function duplicateIssue(board, issueId, ctx = {}, { id } = {}) {
  const original = issueById(board, issueId);
  if (!original) return board;
  const fields = { ...original, title: `${original.title} (copy)`, checklist: original.checklist.map(({ text, done }) => ({ text, done })) };
  const copy = makeIssue(board, fields, { id, now: nowOf(ctx), createdFrom: issueKey(board, original) });
  const at = board.issues.indexOf(original) + 1;
  return { ...board, nextNumber: board.nextNumber + 1, issues: [...board.issues.slice(0, at), copy, ...board.issues.slice(at)] };
}

