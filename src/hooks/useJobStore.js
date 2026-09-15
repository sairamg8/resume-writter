import { useSyncExternalStore } from 'react';
import { loadSavedList, pendingRecovery, rememberRecovery, setItemWithRoom } from '@/utils/storageBackup';
import { newId } from '@/utils/ids';
import { completeJob, readJob } from '@/utils/normalizeJob';
import { keepUnsaved } from '@/utils/unsavedJobs';

const KEY = 'cpwtcv_jobs_v1';

const DEMO_JOBS = [
  {
    id: 'demo_1', company: 'Google', role: 'Senior Frontend Engineer', status: 'interview',
    url: '', location: 'Mountain View, CA', salary: '$180k – $250k',
    appliedDate: '2026-06-10', deadline: '2026-06-30',
    contact: 'Sarah Kim (Recruiter) · sarah@google.com',
    notes: 'Referred by college contact. L5 level. Focus on systems design round.',
    todos: [
      { id: 't1', text: 'Research recent Google products & announcements', done: true },
      { id: 't2', text: 'Prepare system design (YouTube, Google Drive)', done: true },
      { id: 't3', text: 'Practice LeetCode hard — trees & graphs', done: false },
      { id: 't4', text: 'Send thank you email after interview', done: false },
    ],
    statusHistory: [
      { status: 'saved', changedAt: 1749500000000 },
      { status: 'applied', changedAt: 1749514800000 },
      { status: 'phone_screen', changedAt: 1749600000000 },
      { status: 'interview', changedAt: 1749686400000 },
    ],
    createdAt: 1749500000000, updatedAt: 1749686400000,
  },
];

const JOB_VERSION = 2;

/**
 * The saved job list, as `{ jobs, recovery }`. Whatever cannot be read — the whole value, single
 * entries, or details of one (readJob: to-dos, history, text fields) — is left out, and the
 * raw value is first copied to a backup key, because the next save replaces it (loadSavedList).
 * `recovery` is then `{ backupKey }` (null when not even the copy could be written). A repair
 * that loses nothing — a number turned into its digits — gets neither (VM4-5). Nothing saved
 * yet: the demo job.
 */
function load() {
  const { saved, list, recovery } = loadSavedList(KEY, 'jobs', readJob);
  if (!list) return { jobs: DEMO_JOBS, recovery: null };
  if (!saved) return { jobs: [], recovery };
  // A job, or a to-do, the pages cannot address (no id, or one another has) gets an id rather than
  // being dropped; nothing is lost, so it is not a repair to report (completeJob).
  let jobs = list.map(completeJob);
  // Migrate: strip old demo_* jobs, keep user-created ones
  if (saved.dataVersion !== JOB_VERSION) jobs = [...DEMO_JOBS, ...jobs.filter(j => !j.id.startsWith('demo_'))];
  return { jobs, recovery };
}

/**
 * Write the list — when storage is full, old backups make room first (R4-8); null when it
 * reached localStorage, else the error (usually QuotaExceededError).
 */
function persist(jobs) {
  try {
    setItemWithRoom(KEY, JSON.stringify({ jobs, dataVersion: JOB_VERSION }));
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

function snapshot() {
  if (!current) {
    // The notice is kept until dismissed: the list is repaired (and saved over) on whichever job
    // page reads it first, and only the tracker shows the notice (R4-0).
    const { jobs, recovery: found } = load();
    const recovery = found ? rememberRecovery(KEY, found) : pendingRecovery(KEY);
    // Saved at once, as the page used to on opening: a migrated or repaired list replaces the
    // stored value (whose backup load() has kept).
    current = { jobs, recovery, persistError: persist(jobs) };
    stored = jobs;
    window.addEventListener('storage', e => {
      if (e.key === KEY && e.newValue) takeOtherTabsList();
    });
  }
  return current;
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
  const persistError = jobs === incoming ? null : persist(jobs);
  if (!persistError) stored = jobs;
  update({ jobs, persistError });
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function update(patch) {
  current = { ...snapshot(), ...patch };
  listeners.forEach(l => l());
}

function setJobs(change) {
  const jobs = change(snapshot().jobs);
  const persistError = persist(jobs);
  if (!persistError) stored = jobs;
  update({ jobs, persistError });
}

function addJob(data = {}) {
  const now = Date.now();
  const initialStatus = data.status || 'saved';
  const job = {
    id: newId('job'),
    company: '', role: '', status: 'saved',
    url: '', location: '', salary: '',
    contact: '', resumeId: '', notes: '',
    appliedDate: '', deadline: '',
    todos: [],
    statusHistory: [{ status: initialStatus, changedAt: now }],
    createdAt: now, updatedAt: now,
    ...data,
    // ensure statusHistory always exists (imports may lack it)
  };
  if (!job.statusHistory) {
    job.statusHistory = [{ status: job.status, changedAt: job.createdAt || now }];
  }
  setJobs(jobs => [...jobs, job]);
  return job.id;
}

function updateJob(id, updates) {
  setJobs(jobs => jobs.map(j => {
    if (j.id !== id) return j;
    const updated = { ...j, ...updates, updatedAt: Date.now() };
    if (updates.status && updates.status !== j.status) {
      const prev = j.statusHistory || [{ status: j.status, changedAt: j.createdAt || Date.now() }];
      updated.statusHistory = [...prev, { status: updates.status, changedAt: Date.now() }];
    }
    return updated;
  }));
}

function deleteJob(id) {
  setJobs(jobs => jobs.filter(j => j.id !== id));
}

/**
 * Add the jobs of an imported file, each with a new id, made readable the way a saved job is
 * (readJob). Returns `{ added, lossy }`: lossy when an entry, or a detail of one, could not
 * be read and was left out — not for a number kept as its digits (VM4-5).
 */
function importJobs(incoming) {
  const read = incoming.map(readJob);
  const stamped = read.map(r => r.kept).filter(Boolean).map(j => completeJob({
    status: 'saved',
    todos: [],
    contact: '',
    deadline: '',
    ...j,
    id: newId('job'),
    createdAt: j.createdAt || Date.now(),
    updatedAt: Date.now(),
  }));
  if (stamped.length) setJobs(jobs => [...jobs, ...stamped]);
  return { added: stamped.length, lossy: read.some(r => r.lost) };
}

function clearDemoData() {
  setJobs(() => []);
}

// Set when the saved list could not be read in full; the tracker shows it until dismissed.
function dismissRecovery() {
  rememberRecovery(KEY, null);
  update({ recovery: null });
}

export function useJobStore() {
  const { jobs, persistError, recovery } = useSyncExternalStore(subscribe, snapshot);
  return { jobs, persistError, recovery, dismissRecovery, addJob, updateJob, deleteJob, importJobs, clearDemoData };
}
