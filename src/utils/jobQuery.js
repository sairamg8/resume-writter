// Pure reads over the job list for the tracker's pages: search and status filters, sorting, the KPI
// stats and the funnel. They lived inline in the JSX, where nothing could test them — the list view
// sorted every column as text (J-18). No React and no path aliases, so Node's test runner loads this
// file as it is (tests/unit/job-query.unit.mjs, with a fixed `now`).
import {
  JOB_STATUSES, STATUS_MAP, PIPELINE_STATUSES, CLOSED_STATUSES, ACTIVE_STATUSES, INTERVIEWING_STATUSES,
} from '../constants/jobs.js';
import { todayLocalISO } from './dates.js';

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Text as search compares it: lower case, accents aside ('Zürich' finds 'zurich'). */
const fold = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** The fields a search looks in. */
const SEARCH_FIELDS = ['company', 'role', 'location', 'contact', 'stage', 'salary'];

/** Open = still in the pipeline (saved … offer); on hold, rejected and withdrawn are closed. */
export const isOpen = (job) => PIPELINE_STATUSES.includes(job?.status);

/** True when `job` is open and its `followUpDate` ('YYYY-MM-DD') is today or earlier. */
export function isFollowUpDue(job, now = new Date()) {
  return isOpen(job) && ISO_DAY.test(job.followUpDate || '') && job.followUpDate <= todayLocalISO(now);
}

/**
 * The jobs `filters` keeps, in their order: `q` — every word of it in one of the search fields
 * (any case, accents aside); `statuses` — an array or Set of status ids, empty for all;
 * `followUpDue` — only jobs whose follow-up is due on `now`. The same array when nothing filters.
 */
export function filterJobs(jobs, { q = '', statuses = [], followUpDue = false, now = new Date() } = {}) {
  const words = fold(q).split(/\s+/).filter(Boolean);
  const wanted = new Set(statuses);
  if (!words.length && !wanted.size && !followUpDue) return jobs;
  return jobs.filter((j) => {
    if (wanted.size && !wanted.has(j.status)) return false;
    if (followUpDue && !isFollowUpDue(j, now)) return false;
    if (!words.length) return true;
    const text = SEARCH_FIELDS.map((k) => fold(j[k])).join('\n');
    return words.every((w) => text.includes(w));
  });
}

const SALARY = /(\d[\d,]*(?:\.\d+)?)\s*(k|mn|m|lpa|lakhs?|lacs?|l|crores?|cr)?(?![a-z])/i;
const SALARY_UNIT = { k: 1e3, m: 1e6, mn: 1e6, lpa: 1e5, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, l: 1e5, cr: 1e7, crore: 1e7, crores: 1e7 };

/**
 * The first amount in a salary as the user wrote it — '$150k – $200k' → 150000, '$120,000' →
 * 120000, '₹30 LPA' → 3000000 — or null when it names none ('Competitive'). Currencies are not
 * converted: it orders a list, it does not compare offers.
 */
export function salaryValue(text) {
  const m = SALARY.exec(String(text ?? ''));
  if (!m) return null;
  const n = Number.parseFloat(m[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n * (SALARY_UNIT[(m[2] || '').toLowerCase()] || 1) : null;
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const STATUS_RANK = new Map(JOB_STATUSES.map((s, i) => [s.id, i]));
const DATE_KEYS = new Set(['appliedDate', 'deadline', 'followUpDate']);
const TIME_KEYS = new Set(['updatedAt', 'createdAt']);

/** `job[key]` as the sort compares it; null sorts last in both directions. */
function sortValue(job, key) {
  const v = job[key];
  if (key === 'status') return STATUS_RANK.get(v) ?? null;
  if (key === 'salary') return salaryValue(v);
  if (DATE_KEYS.has(key)) return ISO_DAY.test(v || '') ? v : null;
  if (TIME_KEYS.has(key) || key === 'excitement') return Number.isFinite(v) ? v : null;
  const text = typeof v === 'string' ? v.trim() : '';
  return text || null;
}

/**
 * A sorted copy of `jobs` by `key`, `dir` 'asc' | 'desc' (J-18): status in pipeline order (then
 * the closed ones), dates as dates, updatedAt / createdAt / excitement as numbers, salary by its
 * first amount (salaryValue), anything else as text (localeCompare, sensitivity 'base', numbers
 * in text as numbers). A blank value is last in both directions, and equal values keep the
 * list's own order — the board's rank. 'rank' is that order itself (desc: reversed).
 */
export function sortJobs(jobs, key = 'updatedAt', dir = 'desc') {
  const sign = dir === 'asc' ? 1 : -1;
  if (key === 'rank') return sign > 0 ? [...jobs] : [...jobs].reverse();
  const rows = jobs.map((job, i) => ({ job, i, v: sortValue(job, key) }));
  rows.sort((a, b) => {
    if (a.v === null || b.v === null) return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1;
    const cmp = typeof a.v === 'string' ? collator.compare(a.v, b.v) : a.v - b.v;
    return cmp ? cmp * sign : a.i - b.i;
  });
  return rows.map((r) => r.job);
}

/** The local calendar day of a 'YYYY-MM-DD' or a time in ms, as its midnight; null for anything else. */
function localDay(value) {
  const m = ISO_DAY.exec(typeof value === 'string' ? value : '');
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isFinite(value)) {
    const d = new Date(value);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return null;
}

/**
 * Whole calendar days from `value` ('YYYY-MM-DD' or ms) to `now`, in the user's own time zone:
 * 0 today, 1 yesterday, negative for a day still ahead; null when `value` is no date. For
 * "Applied 5d ago" and "follow up in 2 days".
 */
export function daysSince(value, now = new Date()) {
  const day = localDay(value);
  if (!day) return null;
  const today = localDay(now instanceof Date ? now.getTime() : now);
  return Math.round((today - day) / DAY_MS); // round: a DST day is 23 or 25 hours long
}

/** The statuses a job has been through, oldest first: its history, then its status if the history lags. */
function statusesOf(job) {
  const seen = (Array.isArray(job.statusHistory) ? job.statusHistory : [])
    .map((h) => h?.status).filter((s) => STATUS_MAP[s]);
  return seen.at(-1) === job.status || !STATUS_MAP[job.status] ? seen : [...seen, job.status];
}

const APPLIED_OR_LATER = new Set(['applied', 'phone_screen', 'interview', 'offer']);
const A_RESPONSE = new Set(['phone_screen', 'interview', 'offer', 'rejected']);

/** null when the job never reached applied; else whether it later heard back (a screen, an interview, an offer, a rejection). */
function heardBack(job) {
  const statuses = statusesOf(job);
  const at = statuses.findIndex((s) => APPLIED_OR_LATER.has(s));
  return at < 0 ? null : statuses.slice(at).some((s) => A_RESPONSE.has(s));
}

/**
 * The tracker's KPI numbers on `now`:
 *   total          every job
 *   active         saved, applied, phone screen or interview (not offer, on hold, rejected, withdrawn)
 *   interviewing   phone screen + interview
 *   offers         at offer
 *   onHold, rejected, withdrawn   at that status
 *   applied        jobs that reached applied, per their status history (a later pipeline status
 *                  implies it: a job added at Interview had applied)
 *   responded      of those, the ones that later reached phone screen, interview, offer or rejected
 *   responseRate   responded / applied as a whole percent 0–100; null when nothing was applied to
 *   followUpsDue   open jobs (the pipeline) whose followUpDate is today or earlier
 */
export function jobStats(jobs, now = new Date()) {
  const at = (ids) => jobs.filter((j) => ids.includes(j.status)).length;
  let applied = 0;
  let responded = 0;
  for (const j of jobs) {
    const heard = heardBack(j);
    if (heard === null) continue;
    applied += 1;
    if (heard) responded += 1;
  }
  return {
    total: jobs.length,
    active: at(ACTIVE_STATUSES),
    interviewing: at(INTERVIEWING_STATUSES),
    offers: at(['offer']),
    onHold: at(['on_hold']),
    rejected: at(['rejected']),
    withdrawn: at(['withdrawn']),
    applied,
    responded,
    responseRate: applied ? Math.round((responded / applied) * 100) : null,
    followUpsDue: jobs.filter((j) => isFollowUpDue(j, now)).length,
  };
}

const FUNNEL = ['applied', 'phone_screen', 'interview', 'offer'];

/** The furthest pipeline step a job reached (index into PIPELINE_STATUSES), -1 for none. */
function furthestStep(job) {
  return Math.max(-1, ...statusesOf(job).map((s) => PIPELINE_STATUSES.indexOf(s)));
}

/**
 * The funnel applied → phone screen → interview → offer: for each step, `count` = jobs that
 * reached it or a later one (per history — a job rejected after its interview still counts at
 * interview), and `rate` = whole percent of the step before (null for the first, or when the
 * step before has none). `[{ id, label, count, rate }]`.
 */
export function funnelCounts(jobs) {
  const furthest = jobs.map(furthestStep);
  let prev = null;
  return FUNNEL.map((id) => {
    const step = PIPELINE_STATUSES.indexOf(id);
    const count = furthest.filter((f) => f >= step).length;
    const rate = prev ? Math.round((count / prev) * 100) : null;
    prev = count;
    return { id, label: STATUS_MAP[id].label, count, rate };
  });
}

/**
 * A job's status history as the timeline prints it, oldest first: `[{ status, label, at, closed,
 * current, reopened }]` — `at` the time in ms or null (none printed, not 'Invalid Date'), `closed`
 * on hold / rejected / withdrawn, `current` the last entry. `reopened` only when a pipeline status
 * follows a closed one: an On Hold later closed as Rejected read '→ reopened' (J-20).
 */
export function historyLabels(history) {
  const list = (Array.isArray(history) ? history : []).filter((h) => STATUS_MAP[h?.status]);
  return list.map((h, i) => {
    const closed = CLOSED_STATUSES.includes(h.status);
    const next = list[i + 1];
    return {
      status: h.status,
      label: STATUS_MAP[h.status].label,
      at: Number.isFinite(h.changedAt) ? h.changedAt : null,
      closed,
      current: i === list.length - 1,
      reopened: closed && Boolean(next) && PIPELINE_STATUSES.includes(next.status),
    };
  });
}

/**
 * The résumé a job is linked to: `{ state: 'linked', resume }`, `{ state: 'none' }` with no link,
 * or `{ state: 'deleted' }` when the résumé is gone — it read 'Not linked yet' beside an Open
 * button that bounced to the dashboard (J-21). `resume` is null unless linked.
 */
export function linkedResume(job, resumes = []) {
  const id = job?.resumeId;
  if (!id) return { state: 'none', resume: null };
  const resume = (resumes || []).find((r) => r.id === id);
  return resume ? { state: 'linked', resume } : { state: 'deleted', resume: null };
}

/**
 * A job's completed to-dos, the most recently completed first (`completedAt`; ones from before it
 * was kept follow, in their order), at most `limit` of them. The Tasks tab showed the first five in
 * list order, so with five done the task just ticked vanished behind 'Show more' (J-27).
 */
export function visibleDone(todos, limit = Infinity) {
  const when = (t) => (Number.isFinite(t.completedAt) ? t.completedAt : -Infinity);
  return (todos || [])
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.done)
    .sort((a, b) => when(b.t) - when(a.t) || a.i - b.i)
    .slice(0, limit)
    .map(({ t }) => t);
}
