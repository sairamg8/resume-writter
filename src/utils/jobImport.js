// Importing a job file: reading it, finding the jobs in its text, merging them into the list, and the
// message the tracker shows. No React and no path aliases: Node's test runner loads this file as it
// is (tests/unit/job-import.unit.mjs).
import { newId } from './ids.js';
import { completeJob, isJobEntry, readJob } from './normalizeJob.js';

const READ_FAILED = 'Could not read that file.';

/**
 * Read `file` as text: `onText(text)` once it is read, `onError(message)` when the browser cannot
 * read it — a drive that went away, access revoked, an abort. Only `onload` was handled, so those
 * said nothing at all (J-23). `Reader` is FileReader; tests pass a stand-in.
 */
export function readImportFile(file, { onText, onError }, Reader = globalThis.FileReader) {
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

const isTime = (v) => typeof v === 'number' && Number.isFinite(v);

/** JSON with every object's keys in order: two copies of a job compare equal however they were written. */
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * `theirs` (a file's job, read and completed) as it would be saved over `mine`: what the file left
 * out and the import made up — the times (now) and a to-do's id — taken from `mine`, so the same
 * job compares equal. Stamped anew, a file without times never matched the copy an earlier import
 * saved, and every re-import added each job again.
 */
function asOver(theirs, kept, mine) {
  const out = { ...theirs };
  if (!isTime(kept.createdAt)) out.createdAt = mine.createdAt;
  if (!isTime(kept.updatedAt)) out.updatedAt = mine.updatedAt;
  const given = Array.isArray(kept.todos) ? kept.todos : [];
  out.todos = (theirs.todos || []).map((t, n) => (given[n]?.id || !mine.todos?.[n] ? t : { ...t, id: mine.todos[n].id }));
  return out;
}

/**
 * `current` with the jobs of an imported file merged in, as `{ jobs, added, updated, skipped, lossy }`
 * (J-04: importing the tracker's own backup added every job again, each with a new id). Each
 * entry is read like a saved job (readJob, completeJob), then:
 *   its id is not in the list       → added, keeping that id (the file's own duplicates then match it)
 *   the same job is here            → skipped
 *   a newer copy (updatedAt) of one → replaces it, in its place
 *   an older copy, or as new        → skipped: a backup never overwrites a later edit
 *   different, and no time to tell  → added as a copy with a new id: nothing is dropped
 * `lossy` is true when an entry, or a detail of one, could not be read and was left out. A job
 * with no time of its own gets `now`. The input is never changed.
 */
export function mergeImport(current, incoming, now = Date.now()) {
  const jobs = [...current];
  const at = new Map(jobs.map((j, i) => [j.id, i]));
  let added = 0;
  let updated = 0;
  let skipped = 0;
  let lossy = false;
  for (const entry of Array.isArray(incoming) ? incoming : []) {
    const { kept, lost } = readJob(entry);
    lossy = lossy || lost;
    if (!kept) continue;
    const theirs = completeJob({
      status: 'saved', todos: [], ...kept,
      createdAt: isTime(kept.createdAt) ? kept.createdAt : now,
      updatedAt: isTime(kept.updatedAt) ? kept.updatedAt : now,
    });
    const i = at.get(kept.id);
    if (i !== undefined) {
      const mine = jobs[i];
      if (stable(mine) === stable(asOver(theirs, kept, mine))) { skipped += 1; continue; }
      if (isTime(kept.updatedAt)) {
        if (!isTime(mine.updatedAt) || kept.updatedAt > mine.updatedAt) { jobs[i] = theirs; updated += 1; } else skipped += 1;
        continue;
      }
    }
    const job = i === undefined ? theirs : { ...theirs, id: newId('job') };
    at.set(job.id, jobs.length);
    jobs.push(job);
    added += 1;
  }
  return { jobs, added, updated, skipped, lossy };
}

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
