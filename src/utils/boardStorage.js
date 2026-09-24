// Where the boards live in this browser: `cpwtcv_boards_v2` (`{ boards, dataVersion: 2 }`),
// read and written through the same never-destroy helpers as the job list and the résumés
// (storageBackup.js). The v1 list (`cpwtcv_boards_v1`) is read only while nothing is saved
// under v2 — migrated loss-free (boardMigrate.js) — and never written or removed, so it stays a
// copy of everything. Nothing saved under either: the demo project. useBoardStore holds the
// list in memory; this file only reads and writes it. Pure apart from localStorage
// (tests/unit/board-store.unit.mjs).
import { backupRaw, loadSavedList, readSavedList, setItemWithRoom } from './storageBackup.js';
import { BOARD_DATA_VERSION, BOARDS_KEY, BOARDS_V1_KEY } from '../constants/boards.js';
import { addressableBoards, completeBoard, readBoard } from './normalizeBoard.js';
import { isUntouchedV1Demo, migrateV1 } from './boardMigrate.js';
import { makeDemoBoards } from './boardDemo.js';

/** A v1 board as a v2 one; the v1 demo as shipped (nobody adopted it) is left out, and that loses nothing. */
function readV1Board(raw) {
  return isUntouchedV1Demo(raw) ? { kept: null, lost: false } : readBoard(migrateV1(raw));
}

/** What storage holds under `key`; null when nothing, or it cannot be read. */
export function readRaw(key = BOARDS_KEY) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * The saved boards, as `{ boards, recovery, source }` — source 'v2', 'v1' (migrated) or 'demo'.
 * `backup` false reads only, writing nothing (the store's snapshot during a render); true also
 * backs up what could not be read and returns `recovery` `{ backupKey }` for its notice
 * (storageBackup.loadSavedList), and backs up a list a newer build saved (dataVersion above 2)
 * before this build's first save replaces it. `now` dates the demo.
 */
export function readStoredBoards({ backup = false, now = Date.now() } = {}) {
  const read = backup ? loadSavedList : readSavedList;
  const recoveryOf = (r) => (backup ? r.recovery : null);

  const v2 = read(BOARDS_KEY, 'boards', readBoard);
  if (v2.list) {
    if (!v2.saved) return { boards: [], recovery: recoveryOf(v2), source: 'v2' };
    if (backup && typeof v2.saved.dataVersion === 'number' && v2.saved.dataVersion > BOARD_DATA_VERSION) {
      const raw = readRaw(BOARDS_KEY);
      if (raw) backupRaw(BOARDS_KEY, raw);
    }
    return { boards: addressableBoards(v2.list.map(completeBoard)), recovery: recoveryOf(v2), source: 'v2' };
  }

  const v1 = read(BOARDS_V1_KEY, 'boards', readV1Board);
  if (v1.list) {
    if (!v1.saved) return { boards: [], recovery: recoveryOf(v1), source: 'v1' };
    const onlyStockDemo = v1.saved.boards.length > 0 && v1.saved.boards.every(isUntouchedV1Demo);
    const boards = onlyStockDemo ? makeDemoBoards(now) : addressableBoards(v1.list.map(completeBoard));
    return { boards, recovery: recoveryOf(v1), source: 'v1' };
  }

  return { boards: makeDemoBoards(now), recovery: null, source: 'demo' };
}

/**
 * Save the list under the v2 key — when storage is full, old backups make room first
 * (setItemWithRoom) — as `{ raw, error }`: raw the value written, or error (usually a
 * QuotaExceededError) when storage refused it.
 */
export function writeBoards(boards) {
  const raw = JSON.stringify({ boards, dataVersion: BOARD_DATA_VERSION });
  try {
    setItemWithRoom(BOARDS_KEY, raw);
    return { raw, error: null };
  } catch (error) {
    return { raw: null, error };
  }
}
