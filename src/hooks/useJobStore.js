import { useSyncExternalStore } from 'react';
import { loadSavedList, notSavedReason, pendingRecovery, readSavedList, rememberRecovery, setItemWithRoom } from '../utils/storageBackup.js';
import { newId } from '../utils/ids.js';
import { addressableJobs, completeJob, readJob, statusId } from '../utils/normalizeJob.js';
import { keepUnsaved } from '../utils/unsavedJobs.js';
import { applyEdits, demoJobs, moveInList, newJobDefaults } from '../utils/jobEdits.js';
import { mergeImport } from '../utils/jobImport.js';

const KEY = 'cpwtcv_jobs_v1';

// Not bumped for the new optional fields: a version change re-adds the demo job (load, peek).
const JOB_VERSION = 2;

/**
 * The saved job list, as `{ jobs, recovery }`. Whatever cannot be read — the whole value, single
 * entries, or details of one (readJob: to-dos, history, text fields) — is left out, and the
 * raw value is first copied to a backup key, because the next save replaces it (loadSavedList).
 * `recovery` is then `{ backupKey }` (null when not even the copy could be written). A repair
 * that loses nothing — a number turned into its digits — gets neither (VM4-5). Nothing saved
 * yet: the demo job, dated from today (demoJobs, J-29).
 */
function load() {
  const { saved, list, recovery } = loadSavedList(KEY, 'jobs', readJob);
  if (!list) return { jobs: demoJobs(), recovery: null };
  if (!saved) return { jobs: [], recovery };
  // A job, or a to-do, the pages cannot address (no id, or one another has) gets an id rather than
  // being dropped; nothing is lost, so it is not a repair to report (completeJob, addressableJobs).
  let jobs = list.map(completeJob);
  // Migrate: strip old demo_* jobs, keep user-created ones
  if (saved.dataVersion !== JOB_VERSION) jobs = [...demoJobs(), ...jobs.filter(j => !j.id.startsWith('demo_'))];
  return { jobs: addressableJobs(jobs), recovery };
}

/**
 * Write the list — when storage is full, old backups make room first (R4-8); null when it
 * reached localStorage, else the error (usually QuotaExceededError).
 */
const serialize = (jobs) => JSON.stringify({ jobs, dataVersion: JOB_VERSION });

function persist(jobs) {
  try {
    setItemWithRoom(KEY, serialize(jobs));
    return null;
  } catch (e) {
    return e;
  }
}

/**
 * The one job list every job page shares (M14): `{ jobs, recovery, persistError }`. Read from
 * localStorage when the first job page opens, then kept in memory for the visit — a page used to
 * read its own copy when it opened, so a change storage refused was gone on the next page.
 */
let current = null;
const listeners = new Set();
/** The list this tab last knew storage to hold: what it shows, but for what storage refused. */
let stored = null;
let initialized = false;

/**
 * Pure read of the stored jobs (writing nothing, no listeners added) so getSnapshot
 * is completely free of side effects during React render (NB-6).
 */
function peek() {
  const { saved, list } = readSavedList(KEY, 'jobs', readJob);
  let jobs;
  if (!list) jobs = demoJobs();
  else if (!saved) jobs = [];
  else {
    jobs = list.map(completeJob);
    if (saved.dataVersion !== JOB_VERSION) jobs = [...demoJobs(), ...jobs.filter(j => !j.id.startsWith('demo_'))];
    jobs = addressableJobs(jobs);
  }
  return { jobs, recovery: pendingRecovery(KEY), persistError: null };
}

/**
 * Initial load + repair + backup + persist, invoked on subscribe or first mutation (NB-6).
 */
function init() {
  if (initialized) return;
  initialized = true;
  const { jobs, recovery: found } = load();
  const recovery = found ? rememberRecovery(KEY, found) : pendingRecovery(KEY);
  stored = jobs;
  const persistError = persist(jobs);
  current = { jobs, recovery, persistError };
}

function snapshot() {
  if (!current) {
    current = peek();
  }
  return current;
}

function onStorage(e) {
  if (e.key === KEY && e.newValue) takeOtherTabsList();
}

/**
 * Another tab saved its list: take it, so a change here does not write over that tab's (M14) —
 * but keep what storage refused here (keepUnsaved), and write that again. Taking the list as it
 * was dropped a job this tab could not save, while the notice still said it was unsaved (R6-2).
 */
function takeOtherTabsList() {
  const incoming = load().jobs;
  const jobs = keepUnsaved(incoming, snapshot().jobs, stored);
  stored = incoming;
  // The same list: nothing here is unsaved any more. Else what storage refused is written again.
  // Also written when reading it repaired something — ids given to a job or to-do stored without
  // one: unwritten, the next re-read gave them new ids, and a job page open on one lost it.
  const persistError = jobs === incoming && !repairedOnRead(incoming) ? null : persist(jobs);
  if (!persistError) stored = jobs;
  update({ jobs, persistError });
}

/** Whether `jobs`, just read from storage, differ from what storage holds (the read repaired them). */
function repairedOnRead(jobs) {
  try {
    const raw = localStorage.getItem(KEY);
    return raw !== null && raw !== serialize(jobs);
  } catch {
    return false;
  }
}

function subscribe(listener) {
  const wasEmpty = listeners.size === 0;
  listeners.add(listener);

  if (!initialized) {
    init();
    listener();
  } else if (wasEmpty) {
    // Back on a job page after none was open: nothing listened to other tabs meanwhile, so read
    // storage again — the list of the first visit, written back, erased their jobs (J-01).
    takeOtherTabsList();
  }

  if (wasEmpty && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

function update(patch) {
  current = { ...snapshot(), ...patch };
  listeners.forEach(l => l());
}

function setJobs(change) {
  if (!initialized) init();
  const jobs = change(snapshot().jobs);
  const persistError = persist(jobs);
  if (!persistError) stored = jobs;
  update({ jobs, persistError });
}

/**
 * Add a job with `data` over a new job's defaults (newJobDefaults: an applied date only past Saved,
 * J-10) and return its id. The id, the history (one entry, its status) and the times are always
 * its own; notes in plain text become HTML (completeJob).
 */
function addJob(data = {}) {
  const now = Date.now();
  const status = statusId(data.status) || 'saved';
  const job = completeJob({
    ...newJobDefaults(status, new Date(now)),
    ...data,
    id: newId('job'), status,
    statusHistory: [{ status, changedAt: now }],
    createdAt: now, updatedAt: now,
  });
  setJobs(jobs => [...jobs, job]);
  return job.id;
}

/**
 * Merge `updates` into job `id` (applyEdits: a status change adds one history entry and may fill
 * the applied date; id and history are never overwritten). False — nothing written — when no job
 * has that id any more: its edit form was open while another tab deleted it (J-16).
 */
function updateJob(id, updates) {
  if (!initialized) init();
  const job = snapshot().jobs.find(j => j.id === id);
  if (!job) return false;
  const now = Date.now();
  // An edit that changes nothing (applyEdits returns the job) writes nothing.
  if (applyEdits(job, updates, now) !== job) setJobs(jobs => jobs.map(j => (j.id === id ? applyEdits(j, updates, now) : j)));
  return true;
}

/** Job `id` as it is and where, `{ job, index }` — what Undo needs — or null when there is none. */
function placeOf(id) {
  if (!initialized) init();
  const index = snapshot().jobs.findIndex(j => j.id === id);
  return index < 0 ? null : { job: snapshot().jobs[index], index };
}

/**
 * Move job `id` on the board: to `status` (a status change like any other — one history entry)
 * and before job `beforeId`, or last (moveInList: the array order is the rank). Returns the job
 * as it was and where, for restoreJob to undo it; null when no job has that id.
 */
function moveJob(id, { status, beforeId = null } = {}) {
  const was = placeOf(id);
  if (!was) return null;
  const jobs = moveInList(snapshot().jobs, id, { status, beforeId }, Date.now());
  if (jobs !== snapshot().jobs) setJobs(() => jobs);
  return was;
}

/** Delete job `id`; returns it and its place, `{ job, index }`, for restoreJob (Undo) — null when there was none. */
function deleteJob(id) {
  const was = placeOf(id);
  if (was) setJobs(jobs => jobs.filter(j => j.id !== id));
  return was;
}

/**
 * Put `job` back at `index` (past the end: last), replacing a job with its id — Undo for
 * deleteJob and moveJob with what they returned. An undone move leaves no history entry: the job
 * comes back exactly as it was.
 */
function restoreJob(job, index) {
  if (!job?.id) return;
  setJobs(jobs => {
    const rest = jobs.filter(j => j.id !== job.id);
    const at = Number.isInteger(index) ? Math.max(0, Math.min(index, rest.length)) : rest.length;
    return [...rest.slice(0, at), job, ...rest.slice(at)];
  });
}

/**
 * Merge the jobs of an imported file (mergeImport: a job already here is skipped or, from a newer
 * copy, replaced — never duplicated, J-04). Returns `{ added, updated, skipped, lossy }`: lossy
 * when an entry, or a detail of one, could not be read and was left out (VM4-5); importMessage
 * turns it into what the tracker says.
 */
function importJobs(incoming) {
  if (!initialized) init();
  const { jobs, added, updated, skipped, lossy } = mergeImport(snapshot().jobs, incoming, Date.now());
  if (added || updated) setJobs(() => addressableJobs(jobs));
  return { added, updated, skipped, lossy };
}

function clearDemoData() {
  setJobs(() => []);
}

// Set when the saved list could not be read in full; the tracker shows it until dismissed.
function dismissRecovery() {
  if (!initialized) init();
  rememberRecovery(KEY, null);
  update({ recovery: null });
}

export function _resetJobStoreForTest() {
  current = null;
  stored = null;
  initialized = false;
  listeners.clear();
}

// The actions as plain functions too: node tests drive the store without React.
export { snapshot, subscribe, addJob, updateJob, moveJob, deleteJob, restoreJob, importJobs, clearDemoData, dismissRecovery };

export function useJobStore() {
  const { jobs, persistError, recovery } = useSyncExternalStore(subscribe, snapshot);
  const persistReason = notSavedReason(persistError);
  return {
    jobs, persistError, persistReason, recovery, dismissRecovery,
    addJob, updateJob, moveJob, deleteJob, restoreJob, importJobs, clearDemoData,
  };
}

