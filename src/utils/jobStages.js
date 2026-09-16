// The interview stages the job form offers: the fourteen it knows, and the ones the user added,
// kept in localStorage and shared by every form open in the tab. No React and no path aliases, so
// Node's test runner loads this file as it is (tests/unit/job-stages.unit.mjs).
import { backupRaw } from './storageBackup.js';

const KEY = 'cpwtcv_job_stages_v1';

export const PREDEFINED_STAGES = [
  'Applied',
  'Phone Screen',
  'OA / Take-Home',
  'Technical Screen',
  'Technical Round 1',
  'Technical Round 2',
  'DSA Round',
  'System Design Round',
  'HR Round',
  'Manager Round',
  'Panel Interview',
  'Final Round',
  'Offer',
  'Negotiation',
];

/**
 * The saved custom stages, as `{ stages, unreadable }`: every entry that is a name is kept, and
 * `unreadable` is the raw value when anything else was in it — the whole value, or a single entry
 * — because the next save replaces it and it is to be copied first (backupRaw). A blank name
 * holds nothing, so leaving one out loses nothing to copy (the job list's VM4-5).
 */
function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { return { stages: [], unreadable: null }; }
  if (!raw) return { stages: [], unreadable: null };
  let saved = null;
  try { saved = JSON.parse(raw); } catch { /* unreadable: handled below */ }
  if (!Array.isArray(saved)) return { stages: [], unreadable: raw };
  const stages = saved.filter(s => typeof s === 'string' && s.trim());
  return { stages, unreadable: saved.some(s => typeof s !== 'string') ? raw : null };
}

/**
 * The one list every job form in this tab shares (M14), read from storage the first time a form
 * asks for it and then kept in memory: each form used to hold its own copy, so the second one to
 * save wrote over the stages the first had added (R6-3).
 */
let current = null;
const listeners = new Set();
/** The saved value that could not be read in full, until the save that replaces it copies it. */
let unreadable = null;

export function stagesSnapshot() {
  if (!current) {
    ({ stages: current, unreadable } = load());
    // Another tab's list is taken as it is saved, so a change here builds on it. globalThis is
    // window in the browser; under Node, only what a test puts there (job-stages.unit.mjs).
    globalThis.addEventListener?.('storage', e => { if (e.key === KEY) takeStoredList(); });
  }
  return current;
}

export function subscribeStages(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function update(stages) {
  current = stages;
  listeners.forEach(l => l());
}

/** Another tab saved the list: show that, so the next change here does not write over it (M14). */
function takeStoredList() {
  const read = load();
  unreadable = read.unreadable;
  update(read.stages);
}

/**
 * Write the list, copying first the value it replaces when that could not be read in full: the
 * form used to save the entries it could read the moment it opened, so a list that was partly
 * unreadable — a hand edit, half a restore — lost the rest with no copy kept (R6-3).
 * Storage full: the stages just aren't remembered — the job being edited still gets its stage.
 */
function persist(stages) {
  if (unreadable !== null) backupRaw(KEY, unreadable);
  try {
    localStorage.setItem(KEY, JSON.stringify(stages));
    unreadable = null; // replaced, and copied
  } catch { /* not remembered */ }
}

export function addCustomStage(label) {
  const trimmed = label.trim();
  if (!trimmed) return;
  const stages = stagesSnapshot();
  const allLower = [...PREDEFINED_STAGES, ...stages].map(s => s.toLowerCase());
  if (allLower.includes(trimmed.toLowerCase())) return;
  const next = [...stages, trimmed];
  persist(next);
  update(next);
}

export function removeCustomStage(label) {
  const stages = stagesSnapshot();
  if (!stages.includes(label)) return;
  const next = stages.filter(s => s !== label);
  persist(next);
  update(next);
}
