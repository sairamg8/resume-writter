// A job application from this browser's saved list or an imported .json, made safe for every job
// page — the tracker's board and list, a job's own page, the form. Both ways a job comes in go
// through normalizeJob() (useJobStore's load and importJobs), so they cannot disagree on what a
// job is (R4-7). No imports, so Node's test runner loads this file as it is
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

/** A value that is not text, as text: a number as its digits, anything else ''. */
const asText = (v) => (typeof v === 'number' && Number.isFinite(v) ? String(v) : '');

/** The to-dos the Tasks tab can show; the same array when every one of them is readable. */
function readableTodos(todos) {
  if (!Array.isArray(todos)) return [];
  const kept = todos.filter((t) => isJobEntry(t) && (isText(t.text) || typeof t.text === 'number'))
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
  if (!isJobEntry(job)) return null;
  let out = job;
  const set = (key, value) => {
    if (out === job) out = { ...job };
    if (value === undefined) delete out[key];
    else out[key] = value;
  };
  for (const key of TEXT_FIELDS) {
    if (!isText(job[key])) set(key, asText(job[key]));
  }
  if (job.status !== undefined && (typeof job.status !== 'string' || !job.status)) set('status', 'saved');
  if (job.todos != null) {
    const todos = readableTodos(job.todos);
    if (todos !== job.todos) set('todos', todos);
  }
  if (job.statusHistory != null) {
    const history = Array.isArray(job.statusHistory) ? readableHistory(job.statusHistory) : undefined;
    if (history !== job.statusHistory) set('statusHistory', history);
  }
  return out;
}
