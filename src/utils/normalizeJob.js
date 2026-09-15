// A job application from this browser's saved list or an imported .json, made safe for every job
// page — the tracker's board and list, a job's own page, the form. Both ways a job comes in go
// through readJob() then completeJob() (useJobStore's load and importJobs), so they cannot
// disagree on what a job is (R4-7), or on what a repair lost (VM4-5). Its imports have none of
// their own, so Node's test runner loads this file as it is (tests/unit/normalize-job.unit.mjs).
import { newId } from './ids.js';
import { JOB_STATUSES } from '../constants/jobs.js';

/** The fields the job pages print or search as text. */
const TEXT_FIELDS = [
  'company', 'role', 'location', 'salary', 'contact', 'notes', 'url',
  'appliedDate', 'deadline', 'resumeId', 'stage',
];

/** True when `j` can be a job at all: an object that is not an array. */
export function isJobEntry(j) {
  return Boolean(j && typeof j === 'object' && !Array.isArray(j));
}

/** Text the pages can print as it is: a string, or nothing (null / undefined). */
const isText = (v) => typeof v === 'string' || v == null;

/** A number that reads back as its digits, and loses nothing as them. */
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

/** A value that is not text, as text: a number as its digits, anything else ''. */
const asText = (v) => (isNumber(v) ? String(v) : '');

/** A status name compared as the tracker's: case, spaces, dashes and underscores aside. */
const statusKey = (v) => v.trim().toLowerCase().replace(/[\s_-]+/g, '_');
const STATUS_IDS = new Map(JOB_STATUSES.flatMap((s) => [[statusKey(s.id), s.id], [statusKey(s.label), s.id]]));

/**
 * The id of the tracker status `value` names — its id or its label, in any case ('Applied',
 * 'Phone Screen', 'on-hold'); null when it names none. The board shows a job only in the
 * column of its status, so a job with any other status was on no column (VM4-4).
 */
export function statusId(value) {
  return typeof value === 'string' ? STATUS_IDS.get(statusKey(value)) ?? null : null;
}

/** The to-dos the Tasks tab can show; the same array when every one of them is readable. */
function readableTodos(todos) {
  if (!Array.isArray(todos)) return [];
  const kept = todos.filter((t) => isJobEntry(t) && (typeof t.text === 'string' || isNumber(t.text)))
    .map((t) => (typeof t.text === 'string' ? t : { ...t, text: String(t.text) }));
  return kept.length === todos.length && kept.every((t, i) => t === todos[i]) ? todos : kept;
}

/**
 * The to-dos, each with an id no other one in the list has; the same array when they all do.
 * The Tasks tab ticks, renames and deletes a to-do by its id: to-dos from a file with none
 * shared `undefined`, so deleting one deleted them all (VM4-2).
 */
function addressableTodos(todos) {
  const seen = new Set();
  const out = todos.map((t) => {
    const id = typeof t.id === 'string' && t.id && !seen.has(t.id) ? t.id : newId('td');
    seen.add(id);
    return id === t.id ? t : { ...t, id };
  });
  return out.every((t, i) => t === todos[i]) ? todos : out;
}

/** The status changes the history can show; the same array when every one is readable. */
function readableHistory(history) {
  const kept = history.filter((h) => isJobEntry(h) && typeof h.status === 'string');
  return kept.length === history.length ? history : kept;
}

/**
 * `job` in a shape every job page can use: the same object when it already is — a readable
 * saved job is never touched — else a repaired copy; null when it is not a job at all.
 *   a text field holding a number     → its digits; holding anything else (an object, a list,
 *                                        true) → ''
 *   a status that is none of the       → 'saved' (not text, empty, or another word: 'ghosted');
 *   tracker's, in any case               one in other case ('Applied') is completeJob's
 *   todos that are not a list          → []; to-dos that are not objects, or have no text (or
 *                                        text that is not text), are left out
 *   statusHistory that is not a list   → removed (the next status change starts a new one);
 *                                        entries without a status are left out
 * Missing fields stay missing: the pages already treat them as empty. A saved job with
 * todos: [null] used to throw on every visit to the tracker, until storage was cleared.
 */
export function normalizeJob(job) {
  return readJob(job).kept;
}

/**
 * normalizeJob, and whether its repair lost anything, as `{ kept, lost }`: kept what normalizeJob
 * returns; lost false when the job was readable, or needed only repairs that keep what it held —
 * a number (in a text field, or as a to-do's text) turned into its digits, an empty status
 * (null or '') made 'saved'; an empty slot in the list (null) held nothing either. Older builds'
 * import saved jobs as they came (salary: 120000), and they displayed fine: loading them needs no
 * backup and no notice, and importing them does not say something was left out (VM4-5). lost is
 * true when anything was left out, or replaced by '' or 'saved'.
 */
export function readJob(job) {
  if (!isJobEntry(job)) return { kept: null, lost: job != null };
  let out = job;
  let lost = false;
  const set = (key, value, loses) => {
    if (out === job) out = { ...job };
    if (value === undefined) delete out[key];
    else out[key] = value;
    if (loses) lost = true;
  };
  for (const key of TEXT_FIELDS) {
    if (!isText(job[key])) set(key, asText(job[key]), !isNumber(job[key]));
  }
  if (job.status !== undefined && !statusId(job.status)) {
    // Replacing a status that held nothing (null, '') loses nothing; 'ghosted' or { id } it does.
    const blank = job.status === null || (typeof job.status === 'string' && !job.status.trim());
    set('status', 'saved', !blank);
  }
  if (job.todos != null) {
    const todos = readableTodos(job.todos);
    // Only a to-do left out is a loss: one whose text is a number keeps it, as its digits.
    if (todos !== job.todos) set('todos', todos, !Array.isArray(job.todos) || todos.length < job.todos.length);
  }
  if (job.statusHistory != null) {
    const history = Array.isArray(job.statusHistory) ? readableHistory(job.statusHistory) : undefined;
    if (history !== job.statusHistory) set('statusHistory', history, true);
  }
  return { kept: out, lost };
}

/**
 * `job` (readable: readJob) with what the pages address it by, where it has none — the same
 * object when it has it all. Nothing is lost here, so it is not reported as a repair (a file from
 * another tool has no ids of ours, and its import must not say something was left out):
 *   no id, or not a string             → a new one (the router opens a job by its id)
 *   no status                          → 'saved' (a build before this one imported a job with
 *                                        none; the board showed it on no column)
 *   a status in other case or spacing  → the id it names ('Applied' → 'applied', statusId)
 *   a to-do with no id, or with one    → a new one (addressableTodos)
 *   an earlier to-do already has
 */
export function completeJob(job) {
  let out = job;
  const set = (key, value) => {
    if (out === job) out = { ...job };
    out[key] = value;
  };
  if (typeof job.id !== 'string' || !job.id) set('id', newId('job'));
  const status = statusId(job.status) || 'saved';
  if (status !== job.status) set('status', status);
  if (Array.isArray(job.todos)) {
    const todos = addressableTodos(job.todos);
    if (todos !== job.todos) set('todos', todos);
  }
  return out;
}
