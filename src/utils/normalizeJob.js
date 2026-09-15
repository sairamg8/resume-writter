// A job application from this browser's saved list or an imported .json, made safe for every job
// page — the tracker's board and list, a job's own page, the form. Both ways a job comes in go
// through readJob() (useJobStore's load and importJobs), so they cannot disagree on what a job is
// (R4-7), or on what a repair lost (VM4-5). No imports, so Node's test runner loads this file as it is
// (tests/unit/normalize-job.unit.mjs).

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

/** The to-dos the Tasks tab can show; the same array when every one of them is readable. */
function readableTodos(todos) {
  if (!Array.isArray(todos)) return [];
  const kept = todos.filter((t) => isJobEntry(t) && (isText(t.text) || isNumber(t.text)))
    .map((t) => (isText(t.text) ? t : { ...t, text: String(t.text) }));
  return kept.length === todos.length && kept.every((t, i) => t === todos[i]) ? todos : kept;
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
 *                                        true) → ''; a status that is not text, or empty → 'saved'
 *                                        (the board shows a job only in its status's column)
 *   todos that are not a list          → []; to-dos that are not objects, or whose text is not
 *                                        text, are left out
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
  if (job.status !== undefined && (typeof job.status !== 'string' || !job.status)) {
    set('status', 'saved', job.status !== null && job.status !== '');
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
