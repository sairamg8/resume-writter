// R5-HUNT6 review, next to R5-HUNT6-UNDO-AFTER-SIGN-OUT-UPLOADS-TO-NEXT-ACCOUNT: that fix kept a
// deleted project's and job's Undo out of another account's list, but an issue's, a column's and a
// sprint's Undo still went into any project with the same id. The demo project ("demo_board_life")
// has that id in every account: account A added an issue, a column and a sprint to it and deleted
// them, signed out, account B signed in (its own demo project came down from its cloud), and the
// toasts' Undo put A's issue, column and sprint into B's project — which uploaded them to B's
// cloud. Now the Undo puts back only into the list the delete took from; the same account signed
// in again still gets it. The real board store and list engine over a fake Firestore, as
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

/**
 * A signed in on a first visit (its demo project goes to A's cloud; B's cloud holds the same demo),
 * then added an issue, a column and a sprint to it and deleted each: the three toasts' Undo.
 */
async function aDeletedPartsOfTheDemo() {
  const cloud = fakeFirestore();
  const timers = manualTimers();
  const sync = boardsSync(cloud, timers);
  assert.ok(demo(), 'setup: a first visit shows the demo project');
  sync.start(A);
  await settle();
  assert.ok(cloud.doc(demoPath(A.uid)), 'setup: the demo project is in A\'s cloud');
  cloud.data.set(demoPath(B.uid), cloud.doc(demoPath(A.uid)));

  const issue = boardActions.addIssue(DEMO_BOARD_ID, { title: 'A: call the landlord' });
  const column = boardActions.addColumn(DEMO_BOARD_ID, { title: 'A: waiting on bank', category: 'inprogress' });
  const sprint = boardActions.addSprint(DEMO_BOARD_ID, { name: 'A: moving week' });
  assert.ok(issue && column && sprint, 'setup: A added an issue, a column and a sprint');
  const target = demo().columns.find((c) => c.id !== column.id).id;
  const removed = {
    issue: boardActions.deleteIssue(DEMO_BOARD_ID, issue.id),
    column: boardActions.deleteColumn(DEMO_BOARD_ID, column.id, target),
    sprint: boardActions.deleteSprint(DEMO_BOARD_ID, sprint.id),
  };
  assert.ok(removed.issue && removed.column && removed.sprint, 'setup: each delete gave its Undo');
  return { cloud, timers, sync, issue, column, sprint, removed };
}

test('A deletes in the demo project, signs out, B signs in: the Undo puts nothing of A\'s into B\'s demo project, or its cloud', async () => {
  const { cloud, timers, sync, issue, column, sprint, removed } = await aDeletedPartsOfTheDemo();
  sync.start(null);
  await settle();
  sync.start(B);
  await settle();
  assert.ok(demo(), 'setup: B\'s own demo project came down from B\'s cloud');

  boardActions.restoreIssue(DEMO_BOARD_ID, removed.issue);
  boardActions.restoreColumn(removed.column);
  boardActions.restoreSprint(DEMO_BOARD_ID, removed.sprint);
  await timers.fire();
  await settle();

  assert.equal(demo().issues.some((i) => i.id === issue.id), false, 'before: A\'s issue came back in B\'s project');
  assert.equal(demo().columns.some((c) => c.id === column.id), false, 'before: A\'s column came back in B\'s project');
  assert.equal(demo().sprints.some((s) => s.id === sprint.id), false, 'before: A\'s sprint came back in B\'s project');
  const bCloud = cloud.doc(demoPath(B.uid));
  assert.equal(JSON.stringify(bCloud).includes('A: '), false, 'before: B uploaded A\'s issue, column or sprint to its own cloud');
});

test('the same account signed in again still gets its issue, column and sprint back', async () => {
  const { sync, issue, column, sprint, removed } = await aDeletedPartsOfTheDemo();
  sync.start(null);
  await settle();
  sync.start(A);
  await settle();

  assert.equal(boardActions.restoreIssue(DEMO_BOARD_ID, removed.issue), true);
  assert.equal(boardActions.restoreColumn(removed.column), true);
  assert.equal(boardActions.restoreSprint(DEMO_BOARD_ID, removed.sprint), true);
  assert.ok(demo().issues.some((i) => i.id === issue.id));
  assert.ok(demo().columns.some((c) => c.id === column.id));
  assert.ok(demo().sprints.some((s) => s.id === sprint.id));
});
