// The one board list every board page shares — Trello-style boards → lists → cards. A module
// singleton read from localStorage when the first board page opens, then kept in memory for the
// visit, exactly like useJobStore: the same useSyncExternalStore wiring, the same never-destroy
// storageBackup helpers, the same cross-tab reconciliation (keepUnsaved, generic over any {id}
// entries). Boards are simpler than résumés — no demo "originals", no keep flags — so this store
// carries none of that; Google sync (Phase 3) drives it through the exported module functions
// rather than a React ref. Every mutation stamps the board's updatedAt: per-board last-write-wins
// is how the cloud merge resolves two devices (boardSyncMerge, Phase 3).
import { useSyncExternalStore } from 'react';
import { loadSavedList, notSavedReason, pendingRecovery, readSavedList, rememberRecovery, setItemWithRoom } from '../utils/storageBackup.js';
import { newId } from '../utils/ids.js';
import { addressableBoards, completeBoard, readBoard } from '../utils/normalizeBoard.js';
import { keepUnsaved } from '../utils/unsavedJobs.js';
import { BOARD_COLORS, DEMO_BOARDS, STARTER_LIST_TITLES } from '../constants/boards.js';

const KEY = 'cpwtcv_boards_v1';
const BOARD_VERSION = 1;

/**
 * The saved board list, as `{ boards, recovery }`. Whatever cannot be read — the whole value,
 * single boards, or a list/card/checklist item within one (readBoard) — is left out, and the raw
 * value is first copied to a backup key, because the next save replaces it (loadSavedList).
 * Nothing saved yet: the demo board.
 */
function load() {
  const { saved, list, recovery } = loadSavedList(KEY, 'boards', readBoard);
  if (!list) return { boards: DEMO_BOARDS, recovery: null };
  if (!saved) return { boards: [], recovery };
  let boards = list.map(completeBoard);
  // Migrate: strip old demo_* boards, keep user-created ones, refresh the demo content.
  if (saved.dataVersion !== BOARD_VERSION) boards = [...DEMO_BOARDS, ...boards.filter((b) => !b.id.startsWith('demo_'))];
  return { boards: addressableBoards(boards), recovery };
}

/**
 * Write the list — when storage is full, old backups make room first (R4-8); null when it
 * reached localStorage, else the error (usually QuotaExceededError).
 */
function persist(boards) {
  try {
    setItemWithRoom(KEY, JSON.stringify({ boards, dataVersion: BOARD_VERSION }));
    return null;
  } catch (e) {
    return e;
  }
}

let current = null;
const listeners = new Set();
/** The list this tab last knew storage to hold: what it shows, but for what storage refused. */
let stored = null;
let initialized = false;

/** Pure read of the stored boards (writing nothing, no listeners) so getSnapshot is side-effect free. */
function peek() {
  const { saved, list } = readSavedList(KEY, 'boards', readBoard);
  let boards;
  if (!list) boards = DEMO_BOARDS;
  else if (!saved) boards = [];
  else {
    boards = list.map(completeBoard);
    if (saved.dataVersion !== BOARD_VERSION) boards = [...DEMO_BOARDS, ...boards.filter((b) => !b.id.startsWith('demo_'))];
    boards = addressableBoards(boards);
  }
  return { boards, recovery: pendingRecovery(KEY), persistError: null };
}

/** Initial load + repair + backup + persist, invoked on subscribe or first mutation. */
function init() {
  if (initialized) return;
  initialized = true;
  const { boards, recovery: found } = load();
  const recovery = found ? rememberRecovery(KEY, found) : pendingRecovery(KEY);
  stored = boards;
  const persistError = persist(boards);
  current = { boards, recovery, persistError };
}

function snapshot() {
  if (!current) current = peek();
  return current;
}

function onStorage(e) {
  if (e.key === KEY && e.newValue) takeOtherTabsList();
}

/**
 * Another tab saved its list: take it, so a change here does not write over that tab's — but keep
 * what storage refused here (keepUnsaved), and write that again.
 */
function takeOtherTabsList() {
  const incoming = load().boards;
  const boards = keepUnsaved(incoming, snapshot().boards, stored);
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
  listeners.forEach((l) => l());
}

function setBoards(change) {
  if (!initialized) init();
  const boards = change(snapshot().boards);
  const persistError = persist(boards);
  if (!persistError) stored = boards;
  update({ boards, persistError });
}

/** Map the board `id`, stamping its updatedAt (per-board LWW keys on it), else leave a board as is. */
function mapBoard(boards, id, fn) {
  return boards.map((b) => (b.id === id ? { ...fn(b), updatedAt: Date.now() } : b));
}

/** Map the list `listId` within board `boardId`. */
function mapList(boards, boardId, listId, fn) {
  return mapBoard(boards, boardId, (b) => ({ ...b, lists: b.lists.map((l) => (l.id === listId ? fn(l) : l)) }));
}

// ── Board CRUD ───────────────────────────────────────────────────────

/** A new board — starter lists so it is usable at once (STARTER_LIST_TITLES); returns its id. */
function addBoard(data = {}) {
  const now = Date.now();
  const board = {
    id: newId('board'),
    title: 'Untitled board',
    color: BOARD_COLORS[0],
    lists: STARTER_LIST_TITLES.map((title) => ({ id: newId('list'), title, cards: [] })),
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  setBoards((boards) => [...boards, board]);
  return board.id;
}

function updateBoard(id, updates) {
  setBoards((boards) => mapBoard(boards, id, (b) => ({ ...b, ...updates })));
}

function deleteBoard(id) {
  setBoards((boards) => boards.filter((b) => b.id !== id));
}

// ── List CRUD ────────────────────────────────────────────────────────

/** Add a list to a board; returns its id. */
function addList(boardId, title = 'New list') {
  const id = newId('list');
  setBoards((boards) => mapBoard(boards, boardId, (b) => ({ ...b, lists: [...b.lists, { id, title, cards: [] }] })));
  return id;
}

function updateList(boardId, listId, updates) {
  setBoards((boards) => mapList(boards, boardId, listId, (l) => ({ ...l, ...updates })));
}

function deleteList(boardId, listId) {
  setBoards((boards) => mapBoard(boards, boardId, (b) => ({ ...b, lists: b.lists.filter((l) => l.id !== listId) })));
}

/** Move a list within its board to `toIndex` (drag-reorder of columns). */
function moveList(boardId, listId, toIndex) {
  setBoards((boards) => mapBoard(boards, boardId, (b) => {
    const from = b.lists.findIndex((l) => l.id === listId);
    if (from === -1) return b;
    const lists = [...b.lists];
    const [item] = lists.splice(from, 1);
    const i = Math.max(0, Math.min(toIndex ?? lists.length, lists.length));
    lists.splice(i, 0, item);
    return { ...b, lists };
  }));
}

// ── Card CRUD ────────────────────────────────────────────────────────

/** Add a card to a list; returns its id. */
function addCard(boardId, listId, data = {}) {
  const now = Date.now();
  const card = {
    id: newId('card'),
    title: '', description: '', labels: [], due: '', checklist: [],
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  setBoards((boards) => mapList(boards, boardId, listId, (l) => ({ ...l, cards: [...l.cards, card] })));
  return card.id;
}

/** Merge `updates` into a card and stamp its own updatedAt (title, description, due, labels, checklist). */
function updateCard(boardId, listId, cardId, updates) {
  setBoards((boards) => mapList(boards, boardId, listId, (l) => ({
    ...l,
    cards: l.cards.map((c) => (c.id === cardId ? { ...c, ...updates, updatedAt: Date.now() } : c)),
  })));
}

function deleteCard(boardId, listId, cardId) {
  setBoards((boards) => mapList(boards, boardId, listId, (l) => ({ ...l, cards: l.cards.filter((c) => c.id !== cardId) })));
}

/**
 * Move a card to `toListId` at `toIndex` — reordering within a list (same list) or across lists.
 * `toIndex` null appends. Finds the card wherever it is, so the caller need only say where it goes.
 * Only that one card leaves its list: ids are unique board-wide once loaded (completeBoard), and
 * a second card sharing the id used to be deleted by the move (B-15).
 */
function moveCard(boardId, { cardId, toListId, toIndex }) {
  setBoards((boards) => mapBoard(boards, boardId, (b) => {
    const from = b.lists.findIndex((l) => l.cards.some((c) => c.id === cardId));
    if (from === -1) return b;
    const at = b.lists[from].cards.findIndex((c) => c.id === cardId);
    const moved = b.lists[from].cards[at];
    const stripped = b.lists.map((l, i) => (i === from ? { ...l, cards: l.cards.filter((_, j) => j !== at) } : l));
    const lists = stripped.map((l) => {
      if (l.id !== toListId) return l;
      const cards = [...l.cards];
      const i = toIndex == null ? cards.length : Math.max(0, Math.min(toIndex, cards.length));
      cards.splice(i, 0, moved);
      return { ...l, cards };
    });
    return { ...b, lists };
  }));
}

// Set when the saved list could not be read in full; the board pages show it until dismissed.
function dismissRecovery() {
  if (!initialized) init();
  rememberRecovery(KEY, null);
  update({ recovery: null });
}

export function _resetBoardStoreForTest() {
  current = null;
  stored = null;
  initialized = false;
  listeners.clear();
}

export { snapshot, subscribe };

export function useBoardStore() {
  const { boards, persistError, recovery } = useSyncExternalStore(subscribe, snapshot);
  const persistReason = notSavedReason(persistError);
  return {
    boards, persistError, persistReason, recovery, dismissRecovery,
    addBoard, updateBoard, deleteBoard,
    addList, updateList, deleteList, moveList,
    addCard, updateCard, deleteCard, moveCard,
  };
}
