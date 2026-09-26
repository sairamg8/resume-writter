// A project's Summary page in numbers: what happened in the last 7 days, where its issues stand
// by status category, priority and type, its epics' progress, and its latest changes. Pure: the
// page renders it, tests/unit/project-summary.unit.mjs checks it with a fixed `now`.
import { ISSUE_TYPES, PRIORITIES } from '../constants/boards.js';
import { addDays, isIssueDone, issueKey, statusColumn, todayISO } from './boardModel.js';
import { epicProgress, epicsOf } from './boardQuery.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * `{ completed, updated, created, dueSoon, total, byCategory: { todo, inprogress, done },
 * byPriority: [{ id, name, count }], byType: [{ id, name, count, share }], epics: [{ issue, key,
 * total, done }], recent: [{ issue, key, entry }] }` for `board` at `now` (ms). Epics count as
 * issues in the totals, as a tracker's summary counts them; the last-7-days numbers use the
 * issues' own stamps (resolvedAt, updatedAt, createdAt); due soon is open and due in 7 days.
 */
export function projectSummary(board, now = Date.now()) {
  const since = now - WEEK_MS;
  const today = todayISO(now);
  const weekEnd = addDays(today, 7);
  const issues = board.issues;
  const byCategory = { todo: 0, inprogress: 0, done: 0 };
  let completed = 0; let updated = 0; let created = 0; let dueSoon = 0;
  for (const i of issues) {
    byCategory[statusColumn(board, i)?.category ?? 'todo'] += 1;
    if (i.resolvedAt && i.resolvedAt >= since) completed += 1;
    if (i.updatedAt && i.updatedAt >= since) updated += 1;
    if (i.createdAt && i.createdAt >= since) created += 1;
    if (i.due && i.due >= today && i.due <= weekEnd && !isIssueDone(board, i)) dueSoon += 1;
  }
  const total = issues.length;
  const byPriority = PRIORITIES.map((p) => ({ id: p.id, name: p.name, count: issues.filter((i) => i.priority === p.id).length }));
  const byType = ISSUE_TYPES.map((t) => {
    const count = issues.filter((i) => i.type === t.id).length;
    return { id: t.id, name: t.name, count, share: total ? Math.round((count / total) * 100) : 0 };
  });
  const epics = epicsOf(board).map((e) => ({ issue: e, key: issueKey(board, e), ...epicProgress(board, e.id) }));
  const recent = issues
    .flatMap((issue) => (issue.activity ?? []).map((entry) => ({ issue, key: issueKey(board, issue), entry })))
    .sort((a, b) => b.entry.at - a.entry.at)
    .slice(0, 8);
  return { completed, updated, created, dueSoon, total, byCategory, byPriority, byType, epics, recent };
}
