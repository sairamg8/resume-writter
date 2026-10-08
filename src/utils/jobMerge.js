// Merging an imported file's jobs into the list (mergeImport), for the job store; jobImport.js reads
// the file and words the message, and re-exports this. Its own module so the store, on the start-up
// path, does not bring the tracker's import code with it (71-startup-chunks). No React and no path
// aliases: Node's test runner loads it as it is (tests/unit/job-import.unit.mjs, through jobImport.js).
import { newId } from './ids.js';
import { isUntouchedDemoJob } from './jobEdits.js';
import { completeJob, readJob } from './normalizeJob.js';

const isTime = (v) => typeof v === 'number' && Number.isFinite(v);

/** A company or a role, the one thing the job form asks for (canSave): an entry with neither is no job. */
const named = (job) => Boolean(String(job.company ?? '').trim() || String(job.role ?? '').trim());

/** JSON with every object's keys in order: two copies of a job compare equal however they were written. */
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** A job's to-dos when there are none: null, missing or []. */
const noTodos = (todos) => todos == null || (Array.isArray(todos) && todos.length === 0);

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
  // A file's todos: null is saved as it came; made [] here, it never matched the saved job, and each
  // import of the file added it again (R5-HUNT11-IMPORT-NULL-TODOS-DUPLICATE). No to-dos either way
  // (null, none, []) is the same: a to-do added then deleted leaves [], and the file's null then
  // added the job again (R5-HUNT11 review).
  if (noTodos(theirs.todos) && noTodos(mine.todos)) out.todos = mine.todos;
  else if (Array.isArray(theirs.todos)) out.todos = idsFrom(theirs.todos, kept.todos, mine.todos);
  // An interview with no id gets a new one too (completeJob), so a job with one never matched the
  // copy an earlier import saved, and each import of the file added it again (R5-HUNT10 review).
  if (Array.isArray(theirs.interviews)) out.interviews = idsFrom(theirs.interviews, kept.interviews, mine.interviews);
  return out;
}

/**
 * `list` (to-dos or interviews) with the id `mine` gave each one whose id completeJob made up: the
 * file gave none, one that is not text (another tracker's 1, 2, 3) or one an earlier entry used.
 * Asking only whether the file gave an id kept the made-up one, and each import of a file with
 * numeric ids added the job again (R5-HUNT11-IMPORT-SUBITEM-IDS-DUPLICATE).
 */
function idsFrom(list, given, mine) {
  const had = Array.isArray(given) ? given : [];
  return list.map((e, n) => (e.id === had[n]?.id || !mine?.[n] ? e : { ...e, id: mine[n].id }));
}

/**
 * `current` with the jobs of an imported file merged in, as `{ jobs, added, updated, skipped, lossy }`
 * (J-04: importing the tracker's own backup added every job again, each with a new id). Each
 * entry is read like a saved job (readJob, completeJob), then:
 *   its id is not in the list       → added, keeping that id (the file's own duplicates then match it)
 *   the same job is here            → skipped
 *   a newer copy (updatedAt) of one → replaces it, in its place
 *   an older copy, or as new        → skipped: a backup never overwrites a later edit
 *   the untouched demo job is here  → the file's copy replaces it (isUntouchedDemoJob)
 *   different, and no time to tell  → added as a copy with a new id: nothing is dropped; a copy
 *                                     an earlier import added, unchanged, is skipped (R5-HUNT10)
 * An entry naming neither a company nor a role (another tracker's 'companyName'/'jobTitle', an
 * empty object) is left out and makes the import `lossy`: each became a blank 'Untitled Company'
 * card, which the job form and the Overview both refuse (R5-HUNT7). `lossy` is true when an entry,
 * or a detail of one, could not be read and was left out. A job with no time of its own gets
 * `now`. The input is never changed.
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
    if (!named(kept)) { lossy = true; continue; }
    const theirs = completeJob({
      status: 'saved', todos: [], ...kept,
      createdAt: isTime(kept.createdAt) ? kept.createdAt : now,
      updatedAt: isTime(kept.updatedAt) ? kept.updatedAt : now,
    });
    const i = at.get(kept.id);
    if (i !== undefined) {
      const mine = jobs[i];
      if (stable(mine) === stable(asOver(theirs, kept, mine))) { skipped += 1; continue; }
      // The demo job a fresh browser shows is dated from today, so it looked newer than the demo the
      // user filled in and backed up days ago, and that job was dropped: the file's copy wins over
      // an untouched demo, as it does in the cloud sync's first merge (R5-HUNT2).
      if (isUntouchedDemoJob(mine) && !isUntouchedDemoJob(theirs)) { jobs[i] = theirs; updated += 1; continue; }
      if (isTime(kept.updatedAt)) {
        if (!isTime(mine.updatedAt) || kept.updatedAt > mine.updatedAt) { jobs[i] = theirs; updated += 1; } else skipped += 1;
        continue;
      }
    }
    // The copy an earlier import added has a new id, so the id finds only the edited original; the
    // same file imported again added one more copy each time (R5-HUNT10). A copy already here is
    // the same job: skip it.
    if (i !== undefined && jobs.some((j) => j.id !== kept.id && stable(j) === stable({ ...asOver(theirs, kept, j), id: j.id }))) {
      skipped += 1;
      continue;
    }
    // A row with no usable id (another tool's export, a hand-made list, ids that are numbers) has no
    // id to find its job by, so each import of the file added every row again. A job that was here
    // before this import and is the same job is the row's copy: skipped. Only jobs from before the
    // import are compared, so two equal rows in one file are still both added (once).
    if (typeof kept.id !== 'string' || !kept.id) {
      const twin = current.find((j) => (j.company ?? '') === (theirs.company ?? '') && (j.role ?? '') === (theirs.role ?? '')
        && stable(j) === stable({ ...asOver(theirs, kept, j), id: j.id }));
      if (twin) { skipped += 1; continue; }
    }
    const job = i === undefined ? theirs : { ...theirs, id: newId('job') };
    at.set(job.id, jobs.length);
    jobs.push(job);
    added += 1;
  }
  return { jobs, added, updated, skipped, lossy };
}
