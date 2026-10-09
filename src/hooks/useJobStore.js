import { useSyncExternalStore } from 'react';
import { backupRaw, forgetRecovery, loadSavedList, notSavedReason, pendingRecovery, readSavedList, rememberRecovery, setItemWithRoom } from '../utils/storageBackup.js';
import { newId } from '../utils/ids.js';
import { addressableJobs, completeJob, readJob, statusId } from '../utils/normalizeJob.js';
import { keepUnsaved } from '../utils/unsavedJobs.js';
import { applyEdits, demoJobs, moveInList, newJobDefaults, undoStatusChange } from '../utils/jobEdits.js';
import { mergeImport } from '../utils/jobMerge.js';
import { forgetSynced, JOBS_SYNC_KEY, localMeta } from '../utils/collectionSyncMeta.js';

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
/** What storage held when this tab last took its list while no job page listened (catchUp). */
let seenRaw = null;
/** The value catchUp took but could not read in full: copied to a backup before this tab writes over it. */
let unreadRaw = null;

/**
 * Pure read of the stored jobs (writing nothing, no listeners added) so getSnapshot
 * is completely free of side effects during React render (NB-6).
 */
function peek() {
  return { jobs: readStored().jobs, recovery: pendingRecovery(KEY), persistError: null };
}

/** The stored jobs as peek reads them, and the raw value when some of it could not be read (else null). */
function readStored() {
  const { saved, list, unreadable } = readSavedList(KEY, 'jobs', readJob);
  let jobs;
  if (!list) jobs = demoJobs();
  else if (!saved) jobs = [];
  else {
    jobs = list.map(completeJob);
    if (saved.dataVersion !== JOB_VERSION) jobs = [...demoJobs(), ...jobs.filter(j => !j.id.startsWith('demo_'))];
    jobs = addressableJobs(jobs);
  }
  return { jobs, unreadable };
}

/**
 * Initial load + repair + backup + persist, invoked on subscribe or first mutation (NB-6).
 */
function init() {
  if (initialized) return;
  initialized = true;
  const { jobs, recovery: found } = load();
  // Jobs left out here are not deleted ones: the cloud sync must not delete them from the account.
  if (found) forgetSynced(JOBS_SYNC_KEY);
  const recovery = found ? rememberRecovery(KEY, found) : pendingRecovery(KEY);
  stored = jobs;
  unreadRaw = null;
  const persistError = persist(jobs);
  seenRaw = rawNow();
  current = { jobs, recovery, persistError };
}

function snapshot() {
  if (!current) {
    current = peek();
  } else if (initialized && listeners.size === 0) {
    catchUp();
  }
  return current;
}

function rawNow() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/**
 * No job page open, so no other tab's save was heard: take what storage holds now, keeping what
 * storage refused here (keepUnsaved), before this tab reads or writes its list. An Undo toast
 * outlives the job pages, and a job form reopened fixes its values at the first render, before
 * subscribe re-reads: both used this tab's old list and wrote it over the other tab's jobs. Pure —
 * it runs in render (NB-6) — and only when storage changed, so the snapshot stays the same object.
 */
function catchUp() {
  const raw = rawNow();
  if (raw === null || raw === seenRaw) return;
  seenRaw = raw;
  // Read without a backup (render must write nothing); setJobs makes it before it writes over this.
  const { jobs: incoming, unreadable } = readStored();
  unreadRaw = unreadable;
  const jobs = keepUnsaved(incoming, current.jobs, stored);
  stored = incoming;
  current = { ...current, jobs };
}

function onStorage(e) {
  if (e.key === KEY && e.newValue) takeOtherTabsList();
  // Another tab took the account's list out of this browser (collectionSyncEngine.leave: the sync
  // record's account goes first, then the list). The tab that runs the leave is whichever hears the
  // sign-out first; every other tab only saw its list empty, and a job form open there took that for
  // a job deleted in another tab and offered "Save as a new job" (R5-HUNT6 review).
  else if (e.key === JOBS_SYNC_KEY) {
    const was = ownerIn(e.oldValue);
    if (was && was !== ownerIn(e.newValue)) listLeft();
  }
}

/** The account a stored sync record names (collectionSyncMeta), or null: none, or unreadable. */
function ownerIn(raw) {
  try {
    const m = JSON.parse(raw ?? 'null');
    return m && typeof m.uid === 'string' && m.uid ? m.uid : null;
  } catch {
    return null;
  }
}

/**
 * The account whose list this browser holds now (its sync record), or null: signed out, or never
 * synced. A job form's draft carries it, so a draft typed on one account's list is not restored on
 * another's, even in a tab that heard nothing as the list left (JobForm).
 */
export function listOwner() {
  return localMeta(JOBS_SYNC_KEY).read().uid;
}

/**
 * Another tab saved its list: take it, so a change here does not write over that tab's (M14) —
 * but keep what storage refused here (keepUnsaved), and write that again. Taking the list as it
 * was dropped a job this tab could not save, while the notice still said it was unsaved (R6-2).
 */
function takeOtherTabsList() {
  // Backs up what it cannot read in full (loadSavedList), and says so as the first load does: the
  // recovery notice, and the sync record forgetting what the cloud holds (jobs left out here are not
  // deleted ones: the next first sync must not delete them from the account).
  const { jobs: incoming, recovery: found } = load();
  if (found) forgetSynced(JOBS_SYNC_KEY);
  unreadRaw = null;
  const jobs = keepUnsaved(incoming, snapshot().jobs, stored);
  stored = incoming;
  // The same list: nothing here is unsaved any more. Else what storage refused is written again.
  // Also written when reading it repaired something — ids given to a job or to-do stored without
  // one: unwritten, the next re-read gave them new ids, and a job page open on one lost it.
  const persistError = jobs === incoming && !repairedOnRead(incoming) ? null : persist(jobs);
  if (!persistError) stored = jobs;
  seenRaw = rawNow();
  update({ jobs, persistError, ...(found ? { recovery: rememberRecovery(KEY, found) } : {}) });
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
    if (listeners.size === 0) {
      // From here other tabs' saves go unheard: snapshot() compares storage with this (catchUp).
      seenRaw = rawNow();
      if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
    }
  };
}

function update(patch) {
  current = { ...snapshot(), ...patch };
  listeners.forEach(l => l());
}

/**
 * A job page here listens for other tabs' saves, but one whose event is still on its way is not yet
 * heard: take it in first, or a write replaces it, and that tab, hearing the write, reads this list as
 * the other's (typing-freeze 5). With no page listening, snapshot() does as much (catchUp).
 */
function takeInFlight() {
  if (!initialized) init();
  if (listeners.size) {
    const raw = rawNow();
    if (raw !== null && raw !== seenRaw) takeOtherTabsList();
  }
}

function setJobs(change) {
  takeInFlight();
  const jobs = change(snapshot().jobs);
  // What catchUp could not read in full is about to be replaced: keep its copy, as load does.
  if (unreadRaw !== null) {
    backupRaw(KEY, unreadRaw);
    unreadRaw = null;
  }
  const persistError = persist(jobs);
  if (!persistError) stored = jobs;
  seenRaw = rawNow();
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

/**
 * Whose list each job (deleteJob, moveJob) or whole list (clearDemoData) an Undo can put back was
 * taken from. An Undo toast outlives a sign-out, here or in another tab: its restore wrote the
 * last account's jobs into the list the sign-out had emptied, with no owner, and the next account
 * to sign in took them for its own and uploaded them. Put back only into the list they left.
 */
const takenFrom = new WeakMap();
const stillOwner = (taken) => {
  const owner = takenFrom.get(taken);
  return !owner || owner === listOwner();
};

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
  // The list as it is now, another tab's save in flight taken in: the moved list is built over it,
  // not over a stale one written over that tab's change (CYC8-S4).
  takeInFlight();
  const was = placeOf(id);
  if (!was) return null;
  const jobs = moveInList(snapshot().jobs, id, { status, beforeId }, Date.now());
  if (jobs !== snapshot().jobs) setJobs(() => jobs);
  takenFrom.set(was.job, listOwner());
  return was;
}

/**
 * Move job `id` to `status` where it is (updateJob: one history entry, maybe the applied date) and
 * return `{ id, before, after }` for undoStatus — null when no job has that id or it is there
 * already. The board, the job page's stepper and its status menu offer Undo with it (R5-HUNT7).
 */
function changeStatus(id, status) {
  const was = placeOf(id);
  if (!was) return null;
  updateJob(id, { status });
  const now = placeOf(id);
  if (!now || now.job === was.job) return null;
  const change = { id, before: was.job, after: now.job };
  takenFrom.set(change, listOwner());
  return change;
}

/** Undo `change` (changeStatus): the job's status, history and filled-in applied date as they were (undoStatusChange). */
function undoStatus(change) {
  if (!change?.id || !stillOwner(change)) return;
  const job = placeOf(change.id)?.job;
  if (!job) return;
  const back = undoStatusChange(job, change.before, change.after, Date.now());
  if (back !== job) setJobs(jobs => jobs.map(j => (j.id === change.id ? back : j)));
}

/** Delete job `id`; returns it and its place, `{ job, index }`, for restoreJob (Undo) — null when there was none. */
function deleteJob(id) {
  const was = placeOf(id);
  if (was) {
    takenFrom.set(was.job, listOwner());
    setJobs(jobs => jobs.filter(j => j.id !== id));
  }
  return was;
}

/**
 * Put `job` back at `index` (past the end: last), replacing a job with its id — Undo for
 * deleteJob and moveJob with what they returned. An undone move leaves no history entry: the job
 * comes back exactly as it was.
 */
function restoreJob(job, index) {
  if (!job?.id || !stillOwner(job)) return;
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
  // Merged into the list as it is now, another tab's save in flight taken in first: the merged
  // list is written whole, so a stale one replaced that tab's change (CYC8-S4).
  takeInFlight();
  const { jobs, added, updated, skipped, lossy } = mergeImport(snapshot().jobs, incoming, Date.now());
  if (added || updated) setJobs(() => addressableJobs(jobs));
  return { added, updated, skipped, lossy };
}

/** The list now, loaded first: what the cloud sync reads (jobSync in useCollectionSync.js). */
function jobsNow() {
  if (!initialized) init();
  return snapshot().jobs;
}

/**
 * The list storage holds, loaded first: what the cloud sync may record as synced here — the jobs
 * shown, but for what storage refused (collectionSyncEngine's claimed).
 */
function savedJobs() {
  if (!initialized) init();
  return stored ?? snapshot().jobs;
}

/** Replace the list with the cloud sync's result (or [] as the account's list leaves); the same list writes nothing. */
function replaceJobs(jobs) {
  if (jobs !== jobsNow()) setJobs(() => jobs);
}

/** Remove every job ("Clear all jobs"); returns the list as it was, for restoreJobs (Undo). */
function clearDemoData() {
  if (!initialized) init();
  const was = snapshot().jobs;
  if (was.length) {
    takenFrom.set(was, listOwner());
    setJobs(() => []);
  }
  return was;
}

/**
 * Put back `list` — what clearDemoData removed — in its order, ahead of any job added since (kept;
 * one with the same id is replaced by its copy from `list`). The cloud sync sees them as added and
 * sends them again, which also takes them off the account's deleted list (collectionSyncIo.commit).
 */
function restoreJobs(list) {
  if (!Array.isArray(list) || !list.length || !stillOwner(list)) return;
  const back = new Set(list.map(j => j.id));
  setJobs(jobs => [...list, ...jobs.filter(j => !back.has(j.id))]);
}

// Set when the saved list could not be read in full; the tracker shows it until dismissed.
function dismissRecovery() {
  if (!initialized) init();
  rememberRecovery(KEY, null);
  update({ recovery: null });
}

/** The job form's unsaved values in sessionStorage are kept under this prefix and the job's id (JobForm). */
export const JOB_DRAFT_PREFIX = 'jobform:';

/**
 * The list left this browser with its account: its notice and backups go with it (forgetRecovery),
 * and so do the job forms' drafts. `left` counts these leaves, so a job form open on the account's
 * list sees it went: an empty list read as a job deleted in another tab, and its "Save as a new
 * job" put the account's job in the signed-out list, which the next account uploaded (R5-HUNT6).
 */
function leaveRecovery() {
  if (!initialized) init();
  forgetRecovery(KEY);
  listLeft();
}

/** In this tab: every job form's draft goes, and `left` counts one more leave (leaveRecovery, onStorage). */
function listLeft() {
  try {
    const drafts = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(JOB_DRAFT_PREFIX)) drafts.push(k);
    }
    drafts.forEach((k) => sessionStorage.removeItem(k));
  } catch { /* no storage: no drafts */ }
  update({ recovery: null, left: (snapshot().left ?? 0) + 1 });
}

export function _resetJobStoreForTest() {
  current = null;
  stored = null;
  seenRaw = null;
  unreadRaw = null;
  initialized = false;
  listeners.clear();
}

// The actions as plain functions too: node tests drive the store without React.
export { snapshot, subscribe, addJob, updateJob, changeStatus, undoStatus, moveJob, deleteJob, restoreJob, importJobs, clearDemoData, restoreJobs, dismissRecovery, leaveRecovery, jobsNow, savedJobs, replaceJobs };

export function useJobStore() {
  const { jobs, persistError, recovery, left } = useSyncExternalStore(subscribe, snapshot);
  const persistReason = notSavedReason(persistError);
  return {
    jobs, persistError, persistReason, recovery, dismissRecovery, left: left ?? 0,
    addJob, updateJob, changeStatus, undoStatus, moveJob, deleteJob, restoreJob, importJobs, clearDemoData, restoreJobs,
  };
}

