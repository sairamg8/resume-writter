// The interview stages the job form offers: the fourteen it knows, and the ones the user added,
// kept in localStorage and shared by every form open in the tab. Signed in, the added ones are the
// ACCOUNT's: stored under the account's own key, so another account on the same browser never sees
// them, and synced with the account (jobStagesCloud.js). Signed out they are the browser's own list.
// No React and no path aliases, so Node's test runner loads this file as it is
// (tests/unit/job-stages.unit.mjs).
import { backupRaw } from './storageBackup.js';

const KEY = 'cpwtcv_job_stages_v1';

/** The account whose list this tab shows: null signed out (the browser's list, under KEY), else its uid. */
let account = null;
/** Where the shown list lives: the browser's own, or the signed-in account's. */
const keyNow = () => (account ? `${KEY}_${account}` : KEY);

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
function load(key = keyNow()) {
  let raw = null;
  try { raw = localStorage.getItem(key); } catch { return { stages: [], unreadable: null }; }
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
/** The value storage held when this tab last read or wrote the list: a different one is another tab's save. */
let seen = null;

function rawNow() {
  try { return localStorage.getItem(keyNow()); } catch { return null; }
}

let listening = false;

/**
 * The list now. `uid` is the signed-in account (null: nobody); asked for another account's than
 * the last call's, the list is that account's, read from its own key. An account that has no list
 * here yet starts empty: the browser's own names are the signed-out list's, and carrying them into
 * an account would hand one person's stage names to the next account to sign in on this browser.
 * Its stages come from its own cloud list (jobStagesCloud.js).
 */
export function stagesSnapshot(uid = account) {
  if ((uid || null) !== account) {
    account = uid || null;
    current = null;
  }
  if (!current) {
    ({ stages: current, unreadable } = load());
    seen = rawNow();
    // Another tab's list is taken as it is saved, so a change here builds on it. globalThis is
    // window in the browser; under Node, only what a test puts there (job-stages.unit.mjs).
    if (!listening) {
      listening = true;
      globalThis.addEventListener?.('storage', e => { if (e.key === keyNow()) takeStoredList(); });
    }
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
  seen = rawNow();
  update(read.stages);
}

/**
 * The list as storage holds it now: another tab's save whose event is still on its way is taken in
 * before this tab changes the list, or its write replaces that tab's stage (typing-freeze 5).
 */
function freshStages() {
  const mine = stagesSnapshot();
  const raw = rawNow();
  if (raw === null || raw === seen) return mine;
  takeStoredList();
  return current;
}

/**
 * Write the list, copying first the value it replaces when that could not be read in full: the
 * form used to save the entries it could read the moment it opened, so a list that was partly
 * unreadable — a hand edit, half a restore — lost the rest with no copy kept (R6-3).
 * Storage full: the stages just aren't remembered — the job being edited still gets its stage.
 */
function persist(stages) {
  if (unreadable !== null) backupRaw(keyNow(), unreadable);
  try {
    const raw = JSON.stringify(stages);
    localStorage.setItem(keyNow(), raw);
    seen = raw;
    unreadable = null; // replaced, and copied
  } catch { /* not remembered */ }
}

/**
 * Add `label` to the custom stages and return the stage the job is to get: the existing one when a
 * stage differs from it only in case ('hr round' → 'HR Round'), else the new one; '' for a blank
 * label. The form gave the job the text as typed, which matched no stage in either list (J-28).
 */
export function addCustomStage(label) {
  const trimmed = String(label ?? '').trim();
  if (!trimmed) return '';
  const stages = freshStages();
  const existing = [...PREDEFINED_STAGES, ...stages].find(s => s.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing;
  const next = [...stages, trimmed];
  persist(next);
  update(next);
  if (account) {
    // Added again after a removal made here: the removal no longer waits to be sent.
    writeGone(account, readGone(account).filter(s => s !== trimmed));
    changed({ uid: account, added: trimmed });
  }
  return trimmed;
}

export function removeCustomStage(label) {
  const stages = freshStages();
  if (!stages.includes(label)) return;
  const next = stages.filter(s => s !== label);
  persist(next);
  update(next);
  if (account) {
    // Kept until the cloud has the removal (confirmStageRemoved), so a removal made offline, or
    // one the cloud refused, still beats the copy the cloud holds when the next form opens.
    const gone = readGone(account);
    if (!gone.includes(label)) writeGone(account, [...gone, label].slice(-MAX_CLOUD_TOMBSTONES));
    changed({ uid: account, removed: label });
  }
}

// The removals this browser made for an account that the account's cloud has not been told yet
// (tombstones, jobStagesCloud.js): their own key, next to the list's, so the list's key keeps
// the shape every version reads.
const GONE_KEY = 'cpwtcv_job_stages_gone_v1';
function readGone(uid) {
  try {
    const saved = JSON.parse(localStorage.getItem(`${GONE_KEY}_${uid}`));
    return Array.isArray(saved) ? saved.filter(s => typeof s === 'string') : [];
  } catch { return []; }
}
function writeGone(uid, names) {
  try {
    if (names.length) localStorage.setItem(`${GONE_KEY}_${uid}`, JSON.stringify(names));
    else localStorage.removeItem(`${GONE_KEY}_${uid}`);
  } catch { /* not remembered: the removal still stands on this device */ }
}

/** The cloud has the removal of `name` for account `uid`: it no longer waits to be sent. */
export function confirmStageRemoved(uid, name) {
  const gone = readGone(uid);
  if (gone.includes(name)) writeGone(uid, gone.filter(s => s !== name));
}

// Signed in, the account's list is also kept in the cloud (jobStagesCloud.js): it hears each change
// here, and brings the cloud's names in with mergeAccountStages.
const changeListeners = new Set();
const changed = (change) => changeListeners.forEach(l => l(change));

/** `listener({ uid, added })` or `({ uid, removed })` for each change made to a signed-in account's list. */
export function subscribeStageChanges(listener) {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

/** The most stages, and the longest name, the account's cloud list holds: one small array of short strings. */
export const MAX_CLOUD_STAGES = 50;
export const MAX_CLOUD_STAGE_LENGTH = 80;
/** Whether the cloud list can hold this name. */
export const cloudStageName = (s) => typeof s === 'string' && s.trim() === s && s !== '' && s.length <= MAX_CLOUD_STAGE_LENGTH;

/** The most removed names the account's cloud remembers (tombstones): the oldest go first. */
export const MAX_CLOUD_TOMBSTONES = 100;

/**
 * The names `fromCloud` holds for account `uid`, and the names it has `removedInCloud`, taken into
 * the list shown. A name the cloud holds is offered here (one differing only in case from a name
 * already there is not added twice) unless it was removed here and the cloud has not heard yet. A
 * name this browser holds that the cloud has removed, and holds no more, is a stale copy: a
 * removal wins over it, as a deletion wins over a copy a device only held in the jobs' sync. A name
 * in both lists is alive (a device that added it again after the removal). Returns what the cloud
 * is to be told: `add`, the names this browser has that it lacks (as many as its list has room
 * for), and `remove`, the removals made here that it lacks. Nothing when `uid` is not the
 * account shown.
 */
export function mergeAccountStages(uid, fromCloud, removedInCloud = []) {
  if (!uid || uid !== account) return { add: [], remove: [] };
  const usable = (list) => (Array.isArray(list) ? list : []).filter(cloudStageName);
  const theirs = usable(fromCloud).slice(0, MAX_CLOUD_STAGES);
  const buried = new Set(usable(removedInCloud));
  const waiting = readGone(uid);
  const remove = waiting.filter(s => !buried.has(s));
  if (remove.length !== waiting.length) writeGone(uid, remove);
  const mineGone = new Set(waiting);
  const alive = new Set(theirs);
  const mine = freshStages();
  const kept = mine.filter(s => alive.has(s) || !buried.has(s));
  const known = new Set([...PREDEFINED_STAGES, ...kept].map(s => s.toLowerCase()));
  const added = theirs.filter(s => !mineGone.has(s) && !known.has(s.toLowerCase()) && known.add(s.toLowerCase()));
  if (kept.length !== mine.length || added.length) {
    const next = [...kept, ...added];
    persist(next);
    update(next);
  }
  return {
    add: kept.filter(s => cloudStageName(s) && !alive.has(s)).slice(0, MAX_CLOUD_STAGES - theirs.length),
    remove,
  };
}
