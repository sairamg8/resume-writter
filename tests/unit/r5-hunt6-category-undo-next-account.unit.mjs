// R5-HUNT6 merge of boards and sync: the column category change's Undo (R5-HUNT6-DONE-COLUMN-
// RECATEGORIZE-NO-UNDO) came from the boards branch, the sign-out guard on every other Undo
// (R5-HUNT6-UNDO-AFTER-SIGN-OUT-UPLOADS-TO-NEXT-ACCOUNT) from the sync branch, so the category
// Undo had no guard. Account A marked a column of the demo project ("demo_board_life", the same id
// in every account) done, signed out, account B signed in and marked that column done too; A's
// toast Undo then set B's column back to its old category, reopening B's issues, and uploaded that
// to B's cloud. Now the Undo goes back only into the list the change was made in; the same account
// signed in again still gets it. The real board store and list engine over a fake Firestore, as
// useCollectionSync wires them. Run: yarn test:unit
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createCollectionSync } from '../../src/utils/collectionSyncEngine.js';
import { collectionIo } from '../../src/utils/collectionSyncIo.js';
import { localMeta } from '../../src/utils/collectionSyncMeta.js';
import { completeBoard, readBoard } from '../../src/utils/normalizeBoard.js';
import { DEMO_BOARD_ID } from '../../src/utils/boardDemo.js';
import { _resetUnpersistedNotices } from '../../src/utils/storageBackup.js';
import { fakeFirestore, manualTimers, recorder, settle } from '../pdf/fake-firestore.mjs';
import * as boardStore from '../../src/hooks/boardStoreState.js';
import { boardActions } from '../../src/hooks/useBoardStore.js';

const A = { uid: 'A', email: 'a@example.com' };
const B = { uid: 'B', email: 'b@example.com' };

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
  _resetUnpersistedNotices();
  boardStore._resetBoardStoreForTest();
});
afterEach(() => {
  boardStore._resetBoardStoreForTest();
  delete globalThis.localStorage;
});

function boardsSync(cloud, timers) {
  const { report } = recorder();
  return createCollectionSync({
    name: 'boards', io: collectionIo(cloud.fs, cloud.db, 'boards'),
    store: {
      items: boardStore.boardsNow, replace: boardStore.replaceBoards, subscribe: boardStore.subscribe,
      fromCloud: (d) => { const { kept } = readBoard(d); return kept ? completeBoard(kept) : null; },
      label: (b) => b.title || 'Untitled project',
      leaveRecovery: boardStore.leaveRecovery,
    },
    meta: localMeta('cpwtcv_boards_sync_v1'), report, timers,
  });
}

const demo = () => boardStore.boardsNow().find((b) => b.id === DEMO_BOARD_ID);
const demoPath = (uid) => `users/${uid}/boards/${DEMO_BOARD_ID}`;


async function aMarkedAColumnDone() {
  const cloud = fakeFirestore();
  const timers = manualTimers();
  const sync = boardsSync(cloud, timers);
  assert.ok(demo(), 'setup: a first visit shows the demo project');
  sync.start(A);
  await settle();
  assert.ok(cloud.doc(demoPath(A.uid)), 'setup: the demo project is in A\'s cloud');
  cloud.data.set(demoPath(B.uid), cloud.doc(demoPath(A.uid)));
  const column = demo().columns.find((c) => c.category !== 'done');
  assert.ok(column, 'setup: the demo project has a column that is not done');
  const changed = boardActions.setColumnCategory(DEMO_BOARD_ID, column.id, 'done');
  assert.ok(changed, 'setup: the category change gave its Undo');
  return { cloud, timers, sync, column, changed };
}

const categoryOf = (id) => demo().columns.find((c) => c.id === id)?.category;

test('A marks a demo column done, signs out, B signs in and marks it done: A\'s Undo leaves B\'s column done', async () => {
  const { cloud, timers, sync, column, changed } = await aMarkedAColumnDone();
  sync.start(null);
  await settle();
  sync.start(B);
  await settle();
  assert.ok(demo(), 'setup: B\'s own demo project came down from B\'s cloud');
  assert.equal(categoryOf(column.id), column.category, 'setup: B\'s column has its old category');
  assert.ok(boardActions.setColumnCategory(DEMO_BOARD_ID, column.id, 'done'), 'setup: B marks the column done');

  assert.equal(boardActions.restoreCategory(changed), false, 'A\'s Undo is refused for B');
  await timers.fire();
  await settle();
  assert.equal(categoryOf(column.id), 'done', 'before: A\'s Undo set B\'s column back to its old category');
  const bColumn = cloud.doc(demoPath(B.uid)).columns.find((c) => c.id === column.id);
  assert.equal(bColumn.category, 'done', 'before: B uploaded A\'s Undo to its own cloud');
});

test('the same account signed in again still gets its category change undone', async () => {
  const { sync, column, changed } = await aMarkedAColumnDone();
  sync.start(null);
  await settle();
  sync.start(A);
  await settle();
  assert.equal(boardActions.restoreCategory(changed), true);
  assert.equal(categoryOf(column.id), column.category);
});
