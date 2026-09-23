// A job application from this browser's saved list or an imported .json, made safe for every job
// page — the tracker's board and list, a job's own page, the form. Both ways a job comes in go
// through readJob() then completeJob() (useJobStore's load and importJobs), so they cannot
// disagree on what a job is (R4-7), or on what a repair lost (VM4-5). Its imports have none of
// their own, so Node's test runner loads this file as it is (tests/unit/normalize-job.unit.mjs).
import { newId } from './ids.js';
import { plainTextToHtml } from './richText.js';
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

/**
 * An element the rich-text editor writes (or a browser's contentEditable, or a paste), or an
 * entity: notes holding one are HTML. Plain text that merely looks like a tag ('<tbd>') is not.
 */
const HTML_NOTES = /<\/?(p|div|br|ul|ol|li|strong|b|em|i|u|s|strike|del|ins|a|span|font|h[1-6]|blockquote|pre|code|sub|sup|hr)(\s[^>]*)?\/?>|&(amp|lt|gt|quot|nbsp|#\d+|#x[0-9a-f]+);/i;

/**
 * Notes as the rich-text editor's HTML (J-03). The job form saved notes as plain text and the
 * Notes tab as HTML, so a plain note lost its line breaks and anything tag-like ('<tbd>') on the
 * card, and was saved that way on the first keystroke in the Notes tab. Plain text becomes the
 * same text as HTML (escaped, a <br> per line: richTextToPlain reads it back unchanged); HTML and
 * blank notes come back as they are. null / undefined → ''.
 */
export function notesToHtml(notes) {
  if (typeof notes !== 'string') return '';
  if (!notes.trim() || HTML_NOTES.test(notes)) return notes;
  return plainTextToHtml(notes);
}

/**
 * A to-do the Tasks tab can show: its text as text, and `done` a boolean — an imported "false"
 * counted as done (J-19); "true" and 1 are done, anything else is not. The same object when it is.
 */
function readableTodo(t) {
  let out = typeof t.text === 'string' ? t : { ...t, text: String(t.text) };
  if (t.done != null && typeof t.done !== 'boolean') out = { ...out, done: t.done === 'true' || t.done === 1 };
  return out;
}

/** The to-dos the Tasks tab can show; the same array when every one of them is readable. */
function readableTodos(todos) {
  if (!Array.isArray(todos)) return [];
  const kept = todos.filter((t) => isJobEntry(t) && (typeof t.text === 'string' || isNumber(t.text))).map(readableTodo);
  return kept.length === todos.length && kept.every((t, i) => t === todos[i]) ? todos : kept;
}

/**
 * `entries` (objects), each with an id no other one in the list has — a new `<prefix>_…` one where
 * it has none, or one an earlier entry already has; the same array when they all do. The pages
 * address a job, and the Tasks tab a to-do, by its id: to-dos from a file with none shared
 * `undefined`, so deleting one deleted them all (VM4-2).
 */
function withOwnIds(entries, prefix) {
  const seen = new Set();
  const out = entries.map((e) => {
    const id = typeof e.id === 'string' && e.id && !seen.has(e.id) ? e.id : newId(prefix);
    seen.add(id);
    return id === e.id ? e : { ...e, id };
  });
  return out.every((e, i) => e === entries[i]) ? entries : out;
}

/** A history time as the pages print it — ms; a date or a number written as text → its ms; else null. */
function historyTime(v) {
  if (isNumber(v)) return v;
  if (typeof v !== 'string' || !v.trim()) return null;
  const ms = /^\d+$/.test(v.trim()) ? Number(v) : Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * The status changes the history can show, as `{ history, lost }`; the same array when every one
 * is readable (J-19). An entry must name a tracker status (in any case — completeJob makes it the
 * id); one that names none ('ghosted') is left out. A `changedAt` that is no time ('yesterday'
 * printed 'Invalid Date') is dropped from its entry; a date written as text becomes its time.
 */
function readableHistory(history) {
  let lost = false;
  const kept = [];
  for (const h of history) {
    if (!isJobEntry(h) || !statusId(h.status)) { lost = true; continue; }
    if (h.changedAt == null) { kept.push(h); continue; }
    const at = historyTime(h.changedAt);
    if (at === h.changedAt) kept.push(h);
    else if (at !== null) kept.push({ ...h, changedAt: at });
    else {
      lost = true;
      const rest = { ...h };
      delete rest.changedAt;
      kept.push(rest);
    }
  }
  const same = kept.length === history.length && kept.every((h, i) => h === history[i]);
  return { history: same ? history : kept, lost };
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
 *                                        entries naming no status are left out, a changedAt
 *                                        that is no time is dropped (readableHistory, J-19)
 *   a to-do's done that is not boolean → true for true / "true" / 1, else false (J-19)
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
    if (!Array.isArray(job.statusHistory)) set('statusHistory', undefined, true);
    else {
      const { history, lost: some } = readableHistory(job.statusHistory);
      if (history !== job.statusHistory) set('statusHistory', history, some);
    }
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
 *   a status in other case or spacing  → the id it names ('Applied' → 'applied', statusId);
 *                                        the history's statuses too (J-19)
 *   a to-do with no id, or with one    → a new one (withOwnIds)
 *   an earlier to-do already has
 *   notes in plain text (the form's    → the same text as editor HTML, once (notesToHtml, J-03)
 *   old textarea)
 * One job does not see the others: an id an earlier job has is replaced over the list (addressableJobs).
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
    const todos = withOwnIds(job.todos, 'td');
    if (todos !== job.todos) set('todos', todos);
  }
  if (Array.isArray(job.statusHistory)) {
    // 'Rejected' → 'rejected': the history counts and labels by id (J-19).
    const history = job.statusHistory.map((h) => {
      const id = isJobEntry(h) ? statusId(h.status) : null;
      return id && id !== h.status ? { ...h, status: id } : h;
    });
    if (history.some((h, i) => h !== job.statusHistory[i])) set('statusHistory', history);
  }
  if (typeof job.notes === 'string') {
    const notes = notesToHtml(job.notes);
    if (notes !== job.notes) set('notes', notes);
  }
  return out;
}

/**
 * `jobs` (each completeJob's), each with an id no earlier job has — the first keeps it, the one a
 * link to it opens; the same array when they all do. The pages open, edit and delete a job by its
 * id, and the board keys its cards by it: builds before 65e981d made it the millisecond, so two
 * jobs added in the same one — or a hand-edited list — shared an id, and deleting one deleted
 * both (ONB-5). Nothing is lost, so it is not a repair to report.
 */
export function addressableJobs(jobs) {
  return withOwnIds(jobs, 'job');
}
