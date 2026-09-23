// Pure writes on a job — a new job's defaults, a status change, an edit, what the job form's save
// writes — so the store and the pages share one tested rule for each. No React and no path aliases:
// Node's test runner loads this file as it is (tests/unit/job-edits.unit.mjs).
import { todayLocalISO } from './dates.js';
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
 * `job` with `updates` merged in, `updatedAt` now. `id`, `createdAt` and `statusHistory` are never
 * taken from an edit — a stale copy of the history wrote a false entry (J-02) — and a `status`
 * goes through applyStatusChange, so history and the applied date stay consistent.
 */
export function applyEdits(job, updates, now = Date.now()) {
  const out = { ...job };
  for (const [key, value] of Object.entries(updates || {})) {
    if (!NOT_EDITABLE.has(key)) out[key] = value;
  }
  out.updatedAt = now;
  return updates && 'status' in updates ? applyStatusChange(out, updates.status, now) : out;
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
