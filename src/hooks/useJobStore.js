import { useState, useEffect } from 'react';
import { backupRaw } from '@/utils/storageBackup';

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
 * The saved job list, as `{ jobs, recovery }`. Whatever cannot be read — the whole value or single
 * entries — is left out, and the raw value is first copied to a backup key, because the next save
 * replaces it. `recovery` is then `{ backupKey }` (null when not even the copy could be written).
 */
function load() {
  const fresh = { jobs: DEMO_JOBS, recovery: null };
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { return fresh; }
  if (!saved) return fresh;
  let parsed = null;
  try { parsed = JSON.parse(saved); } catch { /* unreadable: handled below */ }
  if (!Array.isArray(parsed?.jobs)) return { jobs: [], recovery: { backupKey: backupRaw(KEY, saved) } };

  let jobs = parsed.jobs.filter(j => j && typeof j === 'object' && !Array.isArray(j));
  const recovery = jobs.length < parsed.jobs.length ? { backupKey: backupRaw(KEY, saved) } : null;
  // A job the router cannot address (no id, or a non-string one) gets an id rather than being dropped.
  jobs = jobs.map((j, i) => (typeof j.id === 'string' && j.id ? j : { ...j, id: `job_${Date.now()}_${i}` }));
  // Migrate: strip old demo_* jobs, keep user-created ones
  if (parsed.dataVersion !== JOB_VERSION) jobs = [...DEMO_JOBS, ...jobs.filter(j => !j.id.startsWith('demo_'))];
  return { jobs, recovery };
}

export function useJobStore() {
  const [initial] = useState(load);
  const [state, setState] = useState({ jobs: initial.jobs });
  // Set when the saved list could not be read in full; the tracker shows it until dismissed.
  const [recovery, setRecovery] = useState(initial.recovery);
  // null when the last write reached localStorage; otherwise the error (usually QuotaExceededError).
  const [persistError, setPersistError] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...state, dataVersion: JOB_VERSION }));
      setPersistError(null);
    } catch (e) {
      setPersistError(e);
    }
  }, [state]);

  function addJob(data = {}) {
    const now = Date.now();
    const initialStatus = data.status || 'saved';
    const job = {
      id: `job_${now}`,
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
    setState(s => ({ jobs: [...s.jobs, job] }));
    return job.id;
  }

  function updateJob(id, updates) {
    setState(s => ({
      jobs: s.jobs.map(j => {
        if (j.id !== id) return j;
        const updated = { ...j, ...updates, updatedAt: Date.now() };
        if (updates.status && updates.status !== j.status) {
          const prev = j.statusHistory || [{ status: j.status, changedAt: j.createdAt || Date.now() }];
          updated.statusHistory = [...prev, { status: updates.status, changedAt: Date.now() }];
        }
        return updated;
      }),
    }));
  }

  function deleteJob(id) {
    setState(s => ({ jobs: s.jobs.filter(j => j.id !== id) }));
  }

  function importJobs(incoming) {
    const stamped = incoming.map(j => ({
      todos: [],
      contact: '',
      deadline: '',
      ...j,
      id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: j.createdAt || Date.now(),
      updatedAt: Date.now(),
    }));
    setState(s => ({ jobs: [...s.jobs, ...stamped] }));
  }

  function clearDemoData() {
    setState({ jobs: [] });
  }

  return {
    jobs: state.jobs, persistError, recovery, dismissRecovery: () => setRecovery(null),
    addJob, updateJob, deleteJob, importJobs, clearDemoData,
  };
}
