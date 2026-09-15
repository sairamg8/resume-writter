import { useSyncExternalStore } from 'react';
import { loadSavedList, pendingRecovery, rememberRecovery } from '@/utils/storageBackup';
import { newId } from '@/utils/ids';

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

const isJobEntry = (j) => Boolean(j && typeof j === 'object' && !Array.isArray(j));

/**
 * The saved job list, as `{ jobs, recovery }`. Whatever cannot be read — the whole value or single
 * entries — is left out, and the raw value is first copied to a backup key, because the next save
 * replaces it (loadSavedList). `recovery` is then `{ backupKey }` (null when not even the copy
 * could be written). Nothing saved yet: the demo job.
 */
function load() {
  const { saved, list, recovery } = loadSavedList(KEY, 'jobs', j => (isJobEntry(j) ? j : null));
  if (!list) return { jobs: DEMO_JOBS, recovery: null };
  if (!saved) return { jobs: [], recovery };
  // A job the router cannot address (no id, or a non-string one) gets an id rather than being dropped.
  let jobs = list.map(j => (typeof j.id === 'string' && j.id ? j : { ...j, id: newId('job') }));
  // Migrate: strip old demo_* jobs, keep user-created ones
  if (saved.dataVersion !== JOB_VERSION) jobs = [...DEMO_JOBS, ...jobs.filter(j => !j.id.startsWith('demo_'))];
  return { jobs, recovery };
}

/** Write the list; null when it reached localStorage, else the error (usually QuotaExceededError). */
function persist(jobs) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ jobs, dataVersion: JOB_VERSION }));
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

function snapshot() {
  if (!current) {
    // The notice is kept until dismissed: the list is repaired (and saved over) on whichever job
    // page reads it first, and only the tracker shows the notice (R4-0).
    const { jobs, recovery: found } = load();
    if (found) rememberRecovery(KEY, found);
    const recovery = found || pendingRecovery(KEY);
    // Saved at once, as the page used to on opening: a migrated or repaired list replaces the
    // stored value (whose backup load() has kept).
    current = { jobs, recovery, persistError: persist(jobs) };
    // Another tab saved its list: take it, so a change here does not write over that tab's.
    window.addEventListener('storage', e => {
      if (e.key === KEY && e.newValue) update({ jobs: load().jobs });
    });
  }
  return current;
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
  update({ jobs, persistError: persist(jobs) });
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

function importJobs(incoming) {
  const stamped = incoming.map(j => ({
    todos: [],
    contact: '',
    deadline: '',
    ...j,
    id: newId('job'),
    createdAt: j.createdAt || Date.now(),
    updatedAt: Date.now(),
  }));
  setJobs(jobs => [...jobs, ...stamped]);
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
