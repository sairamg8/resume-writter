// Importing a job file: reading it, finding the jobs in its text, merging them into the list, and the
// message the tracker shows. No React and no path aliases: Node's test runner loads this file as it
// is (tests/unit/job-import.unit.mjs).
import { isJobEntry } from './normalizeJob.js';

const READ_FAILED = 'Could not read that file.';

/** The largest job file read, as the résumé imports' (importDocument.js): a list of jobs is well under it. */
export const MAX_JOB_FILE_BYTES = 20 * 1024 * 1024;
export const JOB_FILE_TOO_BIG = 'That file is too large to be a job list (over 20 MB). Pick the JSON file the Job Tracker exported.';

/**
 * Read `file` as text: `onText(text)` once it is read, `onError(message)` when the browser cannot
 * read it — a drive that went away, access revoked, an abort. Only `onload` was handled, so those
 * said nothing at all (J-23). A file over MAX_JOB_FILE_BYTES is refused before it is read: a huge
 * .json picked by mistake froze the page reading it whole. `Reader` is FileReader; tests pass a stand-in.
 */
export function readImportFile(file, { onText, onError }, Reader = globalThis.FileReader) {
  if (Number(file?.size) > MAX_JOB_FILE_BYTES) {
    onError(JOB_FILE_TOO_BIG);
    return;
  }
  let settled = false;
  const fail = () => { if (!settled) { settled = true; onError(READ_FAILED); } };
  try {
    const reader = new Reader();
    reader.onload = () => { if (!settled) { settled = true; onText(String(reader.result ?? '')); } };
    reader.onerror = fail;
    reader.onabort = fail;
    reader.readAsText(file);
  } catch {
    fail();
  }
}

/**
 * The job entries in a file's text, as `{ list }` — a list, the tracker's export object
 * (`{ jobs }`), or a single job — else `{ error }` with the message to show.
 */
export function jobsFromText(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch {
    return { error: 'Could not parse file. Make sure it is a job-tracker JSON export.' };
  }
  if (Array.isArray(parsed)) return { list: parsed };
  if (Array.isArray(parsed?.jobs)) return { list: parsed.jobs };
  if (isJobEntry(parsed) && (parsed.company || parsed.role)) return { list: [parsed] };
  return { error: 'No job applications found in that file.' };
}

// The merge the job store runs (mergeImport) is in jobMerge.js: the store is on the start-up path,
// and importing it from here put the tracker's file reading and messages there too (71-startup-chunks).
export { mergeImport } from './jobMerge.js';

const plural = (n) => `${n} job application${n === 1 ? '' : 's'}`;

/**
 * What the tracker says after an import, as `{ kind, text }` — kind 'success' (a status),
 * 'warning' (some of the file could not be read: an alert) or 'error' (nothing in it, an alert). A
 * successful import said nothing (J-04).
 */
export function importMessage({ added = 0, updated = 0, skipped = 0, lossy = false }) {
  if (!added && !updated && !skipped) return { kind: 'error', text: 'No job applications found in that file.' };
  let text;
  if (!added && !updated) {
    text = skipped === 1
      ? 'Nothing new: the job application in that file is already in the tracker.'
      : `Nothing new: the ${plural(skipped)} in that file are already in the tracker.`;
  } else {
    const parts = [];
    if (added) parts.push(`Imported ${plural(added)}`);
    if (updated) parts.push(added ? `updated ${updated}` : `Updated ${plural(updated)}`);
    if (skipped) parts.push(`skipped ${skipped} already in the tracker`);
    text = `${parts.join(', ')}.`;
  }
  // The wording the tracker has always used for a partial import (the Cypress regressions check it).
  if (lossy) return { kind: 'warning', text: `${text.slice(0, -1)}; what could not be read in the file was left out.` };
  return { kind: 'success', text };
}
