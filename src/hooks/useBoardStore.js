// The one board list every board page shares — Boards v2, the Jira core: projects with columns,
// labels, sprints and issues. A module singleton read from localStorage when the first board
// page subscribes, then kept in memory for the visit, exactly like useJobStore: the same
// useSyncExternalStore wiring, the same never-destroy storage helpers (boardStorage.js: v1
// migrated once and kept, backups, the recovery notice), the same cross-tab reconciliation
// (keepUnsaved, over boards by id). boardStoreState.js holds the list and saves it; this file
// builds the actions the pages call over it (boardActions.js), also exported as `boardActions` for
// code outside React (and the tests), and the React hook.
import { useSyncExternalStore } from 'react';
import { notSavedReason } from '../utils/storageBackup.js';
import { createBoardActions } from '../utils/boardActions.js';
import { BOARDS_SYNC_KEY, localMeta } from '../utils/collectionSyncMeta.js';
import { boardsNow, dismissRecovery, setBoards, snapshot, subscribe } from './boardStoreState.js';

// The list itself lives in boardStoreState.js (the sync reads it at start-up without the actions).
export { _resetBoardStoreForTest, snapshot, subscribe, boardsNow, replaceBoards } from './boardStoreState.js';

/** Every action, for code outside React; useBoardStore() hands out the same functions. */
// `owner`: the account the list is synced with, so an Undo never puts a project into another's list.
const owner = () => localMeta(BOARDS_SYNC_KEY).read().uid;
export const boardActions = { ...createBoardActions({ boardsNow, setBoards, owner }), dismissRecovery };

/**
 * The boards and their actions: `{ boards, persistError, persistReason ('full' | 'blocked' |
 * null), recovery ({ backupKey, earlier } | null), ...boardActions }`. The server snapshot is the
 * same read, so a page renders on the server (the SSR tests) as it does on first paint.
 */
export function useBoardStore() {
  const { boards, persistError, recovery } = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { boards, persistError, persistReason: notSavedReason(persistError), recovery, ...boardActions };
}
