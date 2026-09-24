// Unit tests for the board store (src/hooks/useBoardStore.js) in Node, through its real module
// and a fake localStorage shared by two "tabs" (board-store-harness.mjs): B-01 (a tab coming
// back must not write a stale list over another tab's), B-14 (a demo the user adopted is theirs),
// B-15 (ids unique board-wide), B-23 (the first-run demo is never overdue), and the actions'
// return values, saves and stamps. Run: yarn test:unit
import { test, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { duesOf, freshStorage, localISO, openTab, savedBoards, titlesOf } from './board-store-harness.mjs';
import { findIssueByKey } from '../../src/utils/boardModel.js';

let storage;
beforeEach(() => { storage = freshStorage(); });

test('B-01: a tab that left the board pages re-reads storage when it comes back, and its next edit keeps the other tab\'s board', async () => {
  const A = await openTab(storage);
  const B = await openTab(storage);
  const leaveA = A.open(); // A opens /boards …
  A.run(() => leaveA()); // … and goes to the dashboard: no board page is subscribed
  assert.equal(A.win.listeners.size, 0);

  B.open();
  B.run(() => B.store().addBoard({ title: 'Made in B' }));
  assert.ok(savedBoards(storage).some((b) => b.title === 'Made in B'));

  A.open(); // A comes back to /boards
  const titles = A.boards().map((b) => b.title);
  assert.ok(titles.includes('Made in B'), `tab A shows ${JSON.stringify(titles)}`);

  const first = A.boards()[0];
  A.run(() => A.store().updateBoard(first.id, { title: 'Renamed in A' }));
  const saved = savedBoards(storage).map((b) => b.title);
  assert.ok(saved.includes('Made in B'), `storage after A's edit: ${JSON.stringify(saved)}`);
  assert.ok(saved.includes('Renamed in A'));
  assert.ok(B.boards().some((b) => b.title === 'Made in B'), 'tab B keeps its board');
});

test('B-01: coming back when no other tab saved keeps the very same list (no re-read, no re-render)', async () => {
  const A = await openTab(storage);
  const leave = A.open();
  const before = A.run((m) => m.snapshot());
  A.run(() => leave()); // React StrictMode unmounts and mounts again, the same way
  A.open();
  assert.equal(A.run((m) => m.snapshot()), before);
});

test('B-14: a demo board the user adopted (renamed, a card added) keeps its changes whatever version saved it', async () => {
  const adopted = {
    id: 'demo_board_1', title: 'My launch', color: '#6366f1', createdAt: 1749500000000, updatedAt: 1758000000000,
    lists: [
      { id: 'demo_list_todo', title: 'To do', cards: [{ id: 'demo_card_copy', title: 'Draft landing copy', due: '', checklist: [] }, { id: 'card_mine', title: 'MY TASK', due: '', checklist: [] }] },
      { id: 'demo_list_done', title: 'Done', cards: [] },
    ],
  };
  storage.setItem('cpwtcv_boards_v1', JSON.stringify({ boards: [adopted], dataVersion: 0 }));
  const A = await openTab(storage);
  A.open();
  const boards = A.boards();
  assert.deepEqual(boards.map((b) => b.title), ['My launch'], 'no stock demo replaces it or is added beside it');
  assert.ok(titlesOf(boards[0]).includes('MY TASK'), JSON.stringify(titlesOf(boards[0])));
  assert.ok(savedBoards(storage).some((b) => b.title === 'My launch' && titlesOf(b).includes('MY TASK')), 'and that is what is saved');
});

test('B-14: a demo the user deleted stays deleted, with or without a saved data version', async () => {
  for (const extra of [{}, { dataVersion: 0 }, { dataVersion: 1 }]) {
    storage = freshStorage();
    const mine = { id: 'board_mine', title: 'Only mine', lists: [{ id: 'l', title: 'To do', cards: [] }] };
    storage.setItem('cpwtcv_boards_v1', JSON.stringify({ boards: [mine], ...extra }));
    const A = await openTab(storage);
    A.open();
    assert.deepEqual(A.boards().map((b) => b.title), ['Only mine'], JSON.stringify(extra));
  }
  storage = freshStorage();
  storage.setItem('cpwtcv_boards_v2', JSON.stringify({ boards: [], dataVersion: 2 }));
  const A = await openTab(storage);
  A.open();
  assert.deepEqual(A.boards(), [], 'every project deleted in v2: no demo comes back');
});

test('B-14: the v1 demo exactly as shipped (nobody touched it) gives way to the v2 demo', async () => {
  const stock = { id: 'demo_board_1', title: 'Product launch', updatedAt: 1749686400000, lists: [{ id: 'l', title: 'To do', cards: [] }] };
  storage.setItem('cpwtcv_boards_v1', JSON.stringify({ boards: [stock], dataVersion: 1 }));
  const A = await openTab(storage);
  A.open();
  assert.deepEqual(A.boards().map((b) => b.key), ['LIFE']);
});

test('B-15: moving one of two issues that were saved with the same id leaves the other in place', async () => {
  const issue = (id, title, columnId) => ({ id, number: title.length, title, columnId });
  const board = {
    id: 'b', key: 'MRG', title: 'Merged', columns: [{ id: 'c1', title: 'One', category: 'todo' }, { id: 'c2', title: 'Two', category: 'done' }],
    issues: [issue('dup', 'Card in One', 'c1'), issue('dup', 'Card in Two', 'c2'), issue('z', 'Z', 'c2')],
  };
  storage.setItem('cpwtcv_boards_v2', JSON.stringify({ boards: [board], dataVersion: 2 }));
  const A = await openTab(storage);
  A.open();
  assert.equal(new Set(A.boards()[0].issues.map((i) => i.id)).size, 3);
  A.run(() => A.store().moveIssue('b', 'dup', { columnId: 'c2', beforeId: 'z' }));
  const after = A.boards()[0];
  assert.deepEqual(after.issues.map((i) => i.title).sort(), ['Card in One', 'Card in Two', 'Z']);
  assert.deepEqual(after.issues.filter((i) => i.columnId === 'c2').map((i) => i.title), ['Card in Two', 'Card in One', 'Z']);
});

test('B-23: the first-run demo has no overdue work, whatever day it is first opened', async () => {
  const days = [new Date(2026, 8, 23, 9), new Date(2026, 8, 26, 12), new Date(2027, 2, 1, 8), new Date(2026, 11, 31, 23, 30)];
  for (const now of days) {
    storage = freshStorage();
    mock.timers.enable({ apis: ['Date'], now });
    try {
      const A = await openTab(storage);
      A.open();
      const dues = A.boards().flatMap(duesOf).filter(Boolean);
      assert.ok(dues.length >= 2, 'the demo shows due dates at all');
      const today = localISO(now);
      assert.deepEqual(dues.filter((d) => d < today), [], `overdue on ${today}: ${dues}`);
      assert.ok(dues.includes(today), 'one is due today');
    } finally {
      mock.timers.reset();
    }
  }
});

test('the demo: LIFE with every type, an epic with children, a recurring chore; ?issue=LIFE-3 opens its issue', async () => {
  const A = await openTab(storage);
  A.open();
  const [life] = A.boards();
  assert.deepEqual([life.id, life.key, life.title], ['demo_board_life', 'LIFE', 'Personal & Projects']);
  assert.deepEqual(life.columns.map((c) => c.title), ['Inbox', 'This week', 'Today', 'Done']);
  assert.deepEqual([...new Set(life.issues.map((i) => i.type))].sort(), ['bug', 'epic', 'story', 'task']);
  assert.equal(new Set(life.issues.map((i) => i.priority)).size, 5);
  assert.ok(life.issues.some((i) => i.epicId) && life.issues.some((i) => i.recurrence !== 'none'));
  assert.ok(life.issues.some((i) => i.checklist.length) && life.issues.some((i) => i.comments.length));
  assert.equal(findIssueByKey(A.boards(), 'life-3').issue.title, 'Fix the dripping kitchen tap');
});

test('actions: return what they made, save under v2, stamp the board; a no-op saves nothing; a taken key is refused', async () => {
  const A = await openTab(storage);
  A.open();
  const s = A.store();
  const board = A.run(() => s.addBoard({ title: 'Website relaunch', template: 'scrum' }));
  assert.deepEqual([board.key, board.mode, board.columns.length], ['WR', 'scrum', 4]);
  const issue = A.run(() => s.addIssue(board.id, { title: 'Hero section', type: 'story' }));
  assert.equal(issue.number, 1);
  assert.equal(A.run(() => s.addIssue(board.id, { title: ' ' })), null);
  const saved = JSON.parse(storage.getItem('cpwtcv_boards_v2'));
  assert.equal(saved.dataVersion, 2);
  assert.ok(saved.boards.find((b) => b.id === board.id).issues.some((i) => i.title === 'Hero section'));
  assert.ok(A.boards().find((b) => b.id === board.id).updatedAt >= board.updatedAt);
  const writes = storage.writes.length;
  assert.equal(A.run(() => s.updateIssue(board.id, issue.id, { title: 'Hero section' })), false);
  assert.equal(storage.writes.length, writes, 'nothing changed: nothing written');
  assert.match(A.run(() => s.updateBoard(board.id, { key: 'LIFE', title: 'Web' })), /Personal & Projects/);
  assert.equal(A.boards().find((b) => b.id === board.id).title, 'Website relaunch', 'a refused key applies nothing');
  assert.equal(A.run(() => s.updateBoard(board.id, { key: 'WEB' })), null);
  assert.equal(A.run(() => s.keyError('web')), 'Use 2–10 capital letters or digits, starting with a letter.');
  assert.match(A.run(() => s.keyError('WEB')), /Website relaunch/);
  assert.equal(A.run(() => s.keyError('WEB', board.id)), null);
});

test('undo: a deleted issue and a deleted project come back where they were', async () => {
  const A = await openTab(storage);
  A.open();
  const s = A.store();
  const [life] = A.boards();
  const removed = A.run(() => s.deleteIssue(life.id, 'demo_issue_1'));
  assert.deepEqual([removed.index, removed.childIds], [0, ['demo_issue_2', 'demo_issue_6']]);
  assert.equal(A.boards()[0].issues.find((i) => i.id === 'demo_issue_2').epicId, null);
  assert.equal(A.run(() => s.restoreIssue(life.id, removed)), true);
  assert.equal(A.boards()[0].issues[0].id, 'demo_issue_1');
  assert.equal(A.boards()[0].issues.find((i) => i.id === 'demo_issue_2').epicId, 'demo_issue_1');
  const other = A.run(() => s.addBoard({ title: 'Other' }));
  const gone = A.run(() => s.deleteBoard(life.id));
  assert.deepEqual(A.boards().map((b) => b.id), [other.id]);
  A.run(() => s.addBoard({ title: 'Life', key: 'LIFE' })); // takes the key meanwhile
  assert.equal(A.run(() => s.restoreBoard(gone)), true);
  assert.equal(A.run(() => s.restoreBoard(gone)), false, 'restored twice: once');
  assert.equal(A.boards()[0].id, life.id);
  assert.notEqual(A.boards()[0].key, 'LIFE', 'its key was taken meanwhile: a new one');
  assert.equal(new Set(A.boards().map((b) => b.key)).size, 3);
});
