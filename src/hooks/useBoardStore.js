// The one board list every board page shares — Boards v2, the Jira core: projects with columns,
// labels, sprints and issues. A module singleton read from localStorage when the first board
// page subscribes, then kept in memory for the visit, exactly like useJobStore: the same
// useSyncExternalStore wiring, the same never-destroy storage helpers (boardStorage.js: v1
// migrated once and kept, backups, the recovery notice), the same cross-tab reconciliation
// (keepUnsaved, over boards by id). This file holds the list and saves it; the actions the pages
// call are built over it in boardActions.js, and are also exported as `boardActions` for code
// outside React (and the tests).
import { useSyncExternalStore } from 'react';
import { notSavedReason, pendingRecovery, rememberRecovery } from '../utils/storageBackup.js';
import { keepUnsaved } from '../utils/unsavedJobs.js';
import { BOARDS_KEY } from '../constants/boards.js';
import { addressableBoards } from '../utils/normalizeBoard.js';
import { createBoardActions } from '../utils/boardActions.js';
import { readRaw, readStoredBoards, writeBoards } from '../utils/boardStorage.js';

let current = null;
const listeners = new Set();
/** The list this tab last knew storage to hold: what it shows, but for what storage refused. */
let stored = null;
let initialized = false;
/** The stored value this tab last wrote or took: a tab coming back compares it with storage (B-01). */
let lastRaw = null;

/** Save `boards`: null when it reached storage, else the error. */
function persist(boards) {
  const { raw, error } = writeBoards(boards);
  if (!error) lastRaw = raw;
  return error;
}

/** Pure read of the stored boards (writing nothing, no listeners) so getSnapshot is side-effect free. */
function peek() {
  return { boards: readStoredBoards().boards, recovery: pendingRecovery(BOARDS_KEY), persistError: null };
}

/** Initial load + repair + backup + migration + persist, on the first subscribe or mutation. */
function init() {
  if (initialized) return;
  initialized = true;
  const { boards, recovery: found } = readStoredBoards({ backup: true });
  const recovery = found ? rememberRecovery(BOARDS_KEY, found) : pendingRecovery(BOARDS_KEY);
  stored = boards;
  const persistError = persist(boards);
  current = { boards, recovery, persistError };
}

function snapshot() {
  if (!current) current = peek();
  return current;
}

function onStorage(e) {
  if (e.key === BOARDS_KEY && e.newValue) takeOtherTabsList();
}

/**
 * Another tab saved its list: take it, so a change here does not write over that tab's — but keep
 * what storage refused here (keepUnsaved), and write that again. A project made here and one made
 * there may share a key; the one kept from here gets another (addressableBoards).
 */
function takeOtherTabsList() {
  lastRaw = readRaw();
  const incoming = readStoredBoards({ backup: true }).boards;
  const kept = keepUnsaved(incoming, snapshot().boards, stored);
  const boards = kept === incoming ? incoming : addressableBoards(kept);
  stored = incoming;
  const persistError = boards === incoming ? null : persist(boards);
  if (!persistError) stored = boards;
  update({ boards, persistError });
}

function subscribe(listener) {
  const wasEmpty = listeners.size === 0;
  listeners.add(listener);
  if (!initialized) {
    init();
    listener();
  } else if (wasEmpty) {
    // No board page was open, so no 'storage' event reached this tab: another tab may have saved
    // since. Take its list now — the next edit here used to write the stale one over it (B-01).
    const raw = readRaw();
    if (raw && raw !== lastRaw) takeOtherTabsList();
  }
  if (wasEmpty && typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

function update(patch) {
  current = { ...snapshot(), ...patch };
  listeners.forEach((l) => l());
}

/** Replace the list with `change(boards)`; the same list back is no change: nothing saved. */
function setBoards(change) {
  if (!initialized) init();
  const before = snapshot().boards;
  const boards = change(before);
  if (boards === before) return;
  const persistError = persist(boards);
  if (!persistError) stored = boards;
  update({ boards, persistError });
}

/** The list now — loaded (and migrated) first, so an action before any page subscribed sees it. */
function boardsNow() {
  if (!initialized) init();
  return snapshot().boards;
}

/** Set when the saved list could not be read in full; the board pages show it until dismissed. */
function dismissRecovery() {
  if (!initialized) init();
  rememberRecovery(BOARDS_KEY, null);
  update({ recovery: null });
}

export function _resetBoardStoreForTest() {
  current = null;
  stored = null;
  lastRaw = null;
  initialized = false;
  listeners.clear();
}

/** Every action, for code outside React; useBoardStore() hands out the same functions. */
export const boardActions = { ...createBoardActions({ boardsNow, setBoards }), dismissRecovery };

/** Replace the list with the cloud sync's result (or [] as the account's list leaves); keys kept apart (addressableBoards). */
function replaceBoards(list) {
  setBoards((boards) => (list === boards ? boards : addressableBoards(list)));
}

export { snapshot, subscribe, boardsNow, replaceBoards };

/**
 * The boards and their actions: `{ boards, persistError, persistReason ('full' | 'blocked' |
 * null), recovery ({ backupKey, earlier } | null), ...boardActions }`. The server snapshot is the
 * same read, so a page renders on the server (the SSR tests) as it does on first paint.
 */
export function useBoardStore() {
  const { boards, persistError, recovery } = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { boards, persistError, persistReason: notSavedReason(persistError), recovery, ...boardActions };
}
