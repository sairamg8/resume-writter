// The board list's state and storage (the store half of useBoardStore.js, which re-exports all of
// it): the list, its subscribe and snapshot, and the primitives the actions are built over. Its own
// module so the cloud sync (useCollectionSync, on the start-up path) reaches the list without the
// board actions and the pure mutations under them (boardActions.js, boardOps.js …), which only the
// board pages need and which load with them (71-startup-chunks). One list: every importer shares
// this module's singleton.
import { pendingRecovery, rememberRecovery } from '../utils/storageBackup.js';
import { keepUnsaved } from '../utils/unsavedJobs.js';
import { BOARDS_KEY } from '../constants/boards.js';
import { addressableBoards } from '../utils/normalizeBoard.js';
import { readRaw, readStoredBoards, writeBoards } from '../utils/boardStorage.js';
import { BOARDS_SYNC_KEY, forgetSynced } from '../utils/collectionSyncMeta.js';

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
  // Boards left out here are not deleted ones: the cloud sync must not delete them from the account.
  if (found) forgetSynced(BOARDS_SYNC_KEY);
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

/** Replace the list with the cloud sync's result (or [] as the account's list leaves); keys kept apart (addressableBoards). */
function replaceBoards(list) {
  setBoards((boards) => (list === boards ? boards : addressableBoards(list)));
}

export { snapshot, subscribe, setBoards, boardsNow, replaceBoards, dismissRecovery };
