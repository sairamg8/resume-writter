// Pure writes on a job — a new job's defaults, a status change, an edit, what the job form's save
// writes — so the store and the pages share one tested rule for each. No React and no path aliases:
// Node's test runner loads this file as it is (tests/unit/job-edits.unit.mjs).
import { todayLocalISO } from './dates.js';
import { newId } from './ids.js';
import { statusId } from './normalizeJob.js';
import { PIPELINE_STATUSES } from '../constants/jobs.js';

/** The fields the job form edits — the only ones its save may write (J-02). */
export const FORM_FIELDS = [
  'company', 'role', 'status', 'stage', 'url', 'location', 'salary', 'contact', 'resumeId', 'notes',
  'appliedDate', 'deadline', 'followUpDate', 'source', 'workMode', 'excitement',
];

/** A form field's empty value. */
const blank = (key) => (key === 'excitement' ? 0 : '');

/** Past Saved in the pipeline (applied … offer): the job has been applied to. */
const hasApplied = (status) => PIPELINE_STATUSES.indexOf(status) > 0;

/**
 * A new job's fields before the caller's: every text blank, and `appliedDate` today only for a
 * status past Saved — a Saved card read "Applied <the day it was saved>" (J-10). The new optional
 * fields start empty: no follow-up, source or work mode, excitement 0, no interviews.
 */
export function newJobDefaults(status = 'saved', now = new Date()) {
  const values = Object.fromEntries(FORM_FIELDS.map((k) => [k, blank(k)]));
  return {
    ...values, status, appliedDate: hasApplied(status) ? todayLocalISO(now) : '',
    interviews: [], todos: [],
  };
}

/**
 * `job` moved to `status` (an id or a label, statusId). The same job when it names no tracker
 * status or the job is already there; else a copy whose history gains exactly one entry — a job
 * with none starts it from its own status — with `updatedAt` now, and, when it moves past Saved
 * with no applied date, that day as the date: moving to Applied never set it (J-10).
 */
export function applyStatusChange(job, status, now = Date.now()) {
  const id = statusId(status);
  if (!id || id === job.status) return job;
  const history = Array.isArray(job.statusHistory) && job.statusHistory.length
    ? job.statusHistory
    : [{ status: job.status, changedAt: job.createdAt || now }];
  const out = { ...job, status: id, statusHistory: [...history, { status: id, changedAt: now }], updatedAt: now };
  if (hasApplied(id) && !job.appliedDate) out.appliedDate = todayLocalISO(new Date(now));
  return out;
}

/** What an edit may never write: the id pages open the job by, its creation, and its history. */
const NOT_EDITABLE = new Set(['id', 'createdAt', 'updatedAt', 'statusHistory', 'status']);

/**
 * `job` with `updates` merged in, `updatedAt` now — or `job` itself when no value changes. `id`, `createdAt` and `statusHistory` are never
 * taken from an edit — a stale copy of the history wrote a false entry (J-02) — and a `status`
 * goes through applyStatusChange, so history and the applied date stay consistent.
 */
export function applyEdits(job, updates, now = Date.now()) {
  const out = { ...job };
  let changed = false;
  for (const [key, value] of Object.entries(updates || {})) {
    if (NOT_EDITABLE.has(key) || (key in job && Object.is(job[key], value))) continue;
    out[key] = value;
    changed = true;
  }
  const status = updates && 'status' in updates ? statusId(updates.status) : null;
  // Nothing new — the current pipeline step clicked, a form saved unchanged — is not an edit: a
  // fresh updatedAt put the job first in "last updated" and made a backup of it look older.
  if (!changed && (!status || status === job.status)) return job;
  out.updatedAt = now;
  return status ? applyStatusChange(out, status, now) : out;
}

/**
 * The job form's values for `job` — its editable fields, missing ones blank — or, for a new job
 * (null), the defaults of one at Applied. An existing job's blank applied date stays blank: a
 * prefill there would look saved and never be.
 */
export function jobFormValues(job, now = new Date()) {
  if (!job) {
    const fresh = newJobDefaults('applied', now);
    return Object.fromEntries(FORM_FIELDS.map((k) => [k, fresh[k]]));
  }
  return Object.fromEntries(FORM_FIELDS.map((k) => [k, job[k] ?? blank(k)]));
}

/**
 * The form's values once the user picks `status`. On a new job's form an applied date that is
 * still the prefill (blank or today) follows the status: blank for Saved, today past it (J-10).
 * A date the user chose, or an existing job's, is theirs.
 */
export function withFormStatus(values, status, { isNew = false, now = new Date() } = {}) {
  const next = { ...values, status };
  const today = todayLocalISO(now);
  if (isNew && (values.appliedDate === '' || values.appliedDate === today)) {
    next.appliedDate = hasApplied(status) ? today : '';
  }
  return next;
}

/**
 * What the job form's save writes: the form fields whose value differs from when the form opened
 * (`start`), and nothing else (J-02). Saving the whole form wrote its copy of the to-dos, the
 * history and the status over what another tab — or the Tasks tab — had saved since.
 */
export function formPatch(start, form) {
  const patch = {};
  for (const key of FORM_FIELDS) {
    if (key in form && form[key] !== start[key]) patch[key] = form[key];
  }
  return patch;
}

/**
 * `jobs` with job `id` moved on the board, where the array order is the rank: to `status` when one
 * is given (applyStatusChange — one history entry, the applied date) and placed before job
 * `beforeId`, or last when that is null, unknown or the job itself. The same array when nothing
 * moves; a reorder within the status keeps the job object as it is — it is not an edit.
 */
export function moveInList(jobs, id, { status, beforeId = null } = {}, now = Date.now()) {
  const from = jobs.findIndex((j) => j.id === id);
  if (from < 0) return jobs;
  const job = jobs[from];
  const moved = status === undefined ? job : applyStatusChange(job, status, now);
  const rest = jobs.filter((_, i) => i !== from);
  const before = beforeId != null && beforeId !== id ? rest.findIndex((j) => j.id === beforeId) : -1;
  const to = before < 0 ? rest.length : before;
  if (moved === job && to === from) return jobs;
  return [...rest.slice(0, to), moved, ...rest.slice(to)];
}

/**
 * `todos` with a new, open to-do reading `text` (trimmed); the same list when there is no text. A
 * text another to-do has — even a completed one — is added too: a recurring follow-up is normal,
 * and the Tasks tab ignored it without a word (J-26). Ids keep the two apart.
 */
export function addTodo(todos, text) {
  const t = String(text ?? '').trim();
  return t ? [...todos, { id: newId('td'), text: t, done: false }] : todos;
}

/**
 * `todos` with to-do `id` ticked or unticked: ticking stamps `completedAt` (now), so the Tasks tab
 * lists it first among the completed ones (visibleDone, J-27); unticking removes it.
 */
export function toggleTodo(todos, id, now = Date.now()) {
  return todos.map((t) => {
    if (t.id !== id) return t;
    if (t.done) {
      const open = { ...t, done: false };
      delete open.completedAt;
      return open;
    }
    return { ...t, done: true, completedAt: now };
  });
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * The demo job a first visit shows, dated from `now`: applied ten days ago, the steps since on the
 * days after, the next deadline five days ahead. Fixed dates in 2025/2026 contradicted each other
 * and showed 'Deadline passed' to every new user (J-29). The id stays 'demo_1'.
 */
export function demoJobs(now = new Date()) {
  const appliedDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10);
  const at = (days, hour) => new Date(appliedDay.getFullYear(), appliedDay.getMonth(), appliedDay.getDate() + days, hour).getTime();
  const history = [
    { status: 'saved', changedAt: at(0, 9) },
    { status: 'applied', changedAt: at(0, 11) },
    { status: 'phone_screen', changedAt: at(3, 15) },
    { status: 'interview', changedAt: Math.min(at(7, 10), now.getTime()) },
  ];
  return [{
    id: 'demo_1', company: 'Google', role: 'Senior Frontend Engineer', status: 'interview',
    url: '', location: 'Mountain View, CA', salary: '$180k – $250k',
    appliedDate: todayLocalISO(appliedDay), deadline: todayLocalISO(new Date(now.getTime() + 5 * DAY)),
    contact: 'Sarah Kim (Recruiter) · sarah@google.com',
    notes: '<p>Referred by college contact. L5 level. Focus on systems design round.</p>',
    todos: [
      { id: 't1', text: 'Research recent Google products & announcements', done: true },
      { id: 't2', text: 'Prepare system design (YouTube, Google Drive)', done: true },
      { id: 't3', text: 'Practice LeetCode hard — trees & graphs', done: false },
      { id: 't4', text: 'Send thank you email after interview', done: false },
    ],
    statusHistory: history,
    createdAt: history[0].changedAt, updatedAt: history.at(-1).changedAt,
  }];
}

/**
 * Whether `job` is the demo job as demoJobs made it, never edited: every edit stamps updatedAt
 * with the time of the edit, and a status change adds a history entry, so the demo keeps its own
 * four entries and an updatedAt equal to the last one's only while nobody touched it. The cloud
 * sync lets the account's copy of the demo win over such a job (collectionSyncPlan.planFirstSync):
 * it is dated from the day it was shown, so it looked newer than the demo the user filled in.
 */
export function isUntouchedDemoJob(job) {
  const history = job?.statusHistory;
  return job?.id === 'demo_1' && Array.isArray(history) && history.length === 4
    && job.updatedAt === history[3]?.changedAt && job.createdAt === history[0]?.changedAt;
}
