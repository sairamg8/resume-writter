// Unit tests for how the board store (src/hooks/useBoardStore.js) meets storage: a render reads
// without writing, v1 is migrated loss-free and left in place, what cannot be read is backed up
// with a notice, a newer build's list is copied before it is replaced, a full storage is
// reported and nothing is dropped, and another tab's saves are taken live without losing what
// storage refused here (keepUnsaved). Run: yarn test:unit
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { freshStorage, openTab, savedBoards, settle } from './board-store-harness.mjs';

const V1 = {
  boards: [{ id: 'b1', title: 'Chores', createdAt: 1, updatedAt: 2, lists: [
    { id: 'l1', title: 'To do', cards: [{ id: 'c1', title: 'Hoover', labels: [{ name: 'Home', color: '#3b82f6' }], checklist: [{ id: 'k', text: 'Stairs', done: false }] }] },
    { id: 'l2', title: 'Done', cards: [{ id: 'c2', title: 'Dishes', updatedAt: 5 }] },
  ] }],
  dataVersion: 1,
};
const backups = (storage, of) => [...storage.map.keys()].filter((k) => k.startsWith(`${of}_backup_`));

let storage;
beforeEach(() => { storage = freshStorage(); });

test('a render reads without writing: snapshot() adds no listener and saves nothing, even while migrating v1', async () => {
  storage.setItem('cpwtcv_boards_v1', JSON.stringify(V1));
  const writes = storage.writes.length;
  const A = await openTab(storage);
  const boards = A.boards();
  assert.deepEqual(boards.map((b) => b.title), ['Chores']);
  assert.equal(storage.writes.length, writes);
  assert.equal(A.win.listeners.size, 0);
  A.open();
  assert.equal(A.win.listeners.size, 1);
  assert.ok(storage.getItem('cpwtcv_boards_v2'));
});

test('v1 is migrated through the store, loss-free, and the v1 key is left exactly as it was', async () => {
  const raw = JSON.stringify(V1);
  storage.setItem('cpwtcv_boards_v1', raw);
  const A = await openTab(storage);
  A.open();
  assert.equal(storage.getItem('cpwtcv_boards_v1'), raw, 'v1 untouched');
  const [board] = savedBoards(storage);
  assert.deepEqual(board.issues.map((i) => [i.title, i.number, i.columnId]), [['Hoover', 1, 'l1'], ['Dishes', 2, 'l2']]);
  assert.deepEqual(board.labels.map((l) => l.name), ['Home']);
  assert.equal(board.issues[0].checklist[0].text, 'Stairs');
  assert.equal(A.run((m) => m.snapshot().recovery), null, 'nothing lost: no notice');
  assert.deepEqual(backups(storage, 'cpwtcv_boards_v1'), []);
  A.run(() => A.store().addIssue(board.id, { title: 'New' }));
  assert.equal(storage.getItem('cpwtcv_boards_v1'), raw, 'later saves go to v2 only');
});

test('a v1 list that cannot be read in full: migrated without it, the original backed up, the notice kept', async () => {
  const lossy = { boards: [{ ...V1.boards[0], lists: [...V1.boards[0].lists, { id: 'l3', title: 'x', cards: 'junk' }] }, 'not a board'] };
  storage.setItem('cpwtcv_boards_v1', JSON.stringify(lossy));
  const A = await openTab(storage);
  A.open();
  const { recovery } = A.run((m) => m.snapshot());
  assert.ok(recovery?.backupKey?.startsWith('cpwtcv_boards_v1_backup_'), JSON.stringify(recovery));
  assert.equal(storage.getItem(recovery.backupKey), JSON.stringify(lossy));
  assert.ok(storage.getItem('cpwtcv_boards_v2_recovery'), 'the notice survives a reload');
  assert.deepEqual(A.boards().map((b) => b.title), ['Chores']);
  A.run(() => A.store().dismissRecovery());
  assert.equal(A.run((m) => m.snapshot().recovery), null);
});

test('a v2 list that cannot be read at all is backed up before the empty list replaces it', async () => {
  storage.setItem('cpwtcv_boards_v2', '{ not json');
  const A = await openTab(storage);
  A.open();
  const { recovery } = A.run((m) => m.snapshot());
  assert.equal(storage.getItem(recovery.backupKey), '{ not json');
  assert.deepEqual(A.boards(), []);
});

test('a list a newer build saved (dataVersion 3) is copied before this build\'s first save', async () => {
  const newer = JSON.stringify({ boards: [{ id: 'b', key: 'NEW', title: 'From the future', columns: [], issues: [], futureField: 1 }], dataVersion: 3 });
  storage.setItem('cpwtcv_boards_v2', newer);
  const A = await openTab(storage);
  A.open();
  const copies = backups(storage, 'cpwtcv_boards_v2');
  assert.equal(copies.length, 1);
  assert.equal(storage.getItem(copies[0]), newer);
  assert.equal(A.boards()[0].futureField, 1, 'its unknown fields are kept too');
});

test('storage full: the edit stays on screen, the reason is surfaced, and the next save that fits clears it', async () => {
  const A = await openTab(storage);
  A.open();
  storage.fill();
  const board = A.run(() => A.store().addBoard({ title: 'Unsaved' }));
  const s = A.store();
  assert.equal(s.persistReason, 'full');
  assert.equal(s.persistError.name, 'QuotaExceededError');
  assert.ok(s.boards.some((b) => b.id === board.id), 'kept in memory');
  assert.ok(!savedBoards(storage).some((b) => b.id === board.id));
  storage.quota = Infinity;
  A.run(() => A.store().toggleStar(board.id));
  assert.equal(A.store().persistReason, null);
  assert.ok(savedBoards(storage).some((b) => b.id === board.id && b.starred));
});

test('another tab\'s save reaches this one live, and what storage refused here is kept and written again', async () => {
  const A = await openTab(storage);
  const B = await openTab(storage);
  A.open();
  B.open();
  const life = A.boards()[0];
  B.run(() => B.store().addIssue(life.id, { title: 'From B' }));
  await settle();
  assert.ok(A.boards()[0].issues.some((i) => i.title === 'From B'), 'taken live through the storage event');

  storage.fill();
  const mine = A.run(() => A.store().addBoard({ title: 'Refused in A' }));
  assert.equal(A.store().persistReason, 'full');
  storage.quota = Infinity;
  B.run(() => B.store().addIssue(life.id, { title: 'B again' }));
  await settle();
  const inA = A.boards();
  assert.ok(inA.some((b) => b.id === mine.id), 'A keeps what storage refused');
  assert.ok(inA[0].issues.some((i) => i.title === 'B again'), 'and takes B\'s change');
  assert.ok(savedBoards(storage).some((b) => b.id === mine.id), 'and writes its board again');
  assert.ok(B.boards().some((b) => b.id === mine.id), 'which B then takes');
});

test('a project refused here and one saved in another tab with the same key: the one kept from here gets another key', async () => {
  const A = await openTab(storage);
  const B = await openTab(storage);
  A.open();
  B.open();
  storage.fill();
  A.run(() => A.store().addBoard({ title: 'Garden', key: 'GAR' }));
  assert.equal(A.store().persistReason, 'full');
  storage.quota = Infinity;
  B.run(() => B.store().addBoard({ title: 'Garage', key: 'GAR' }));
  await settle();
  const keys = A.boards().map((b) => b.key);
  assert.equal(new Set(keys).size, keys.length, `keys in A: ${keys}`);
  assert.equal(A.boards().find((b) => b.title === 'Garage').key, 'GAR', 'the saved one keeps it: ?issue=GAR-1 opens it');
  const saved = savedBoards(storage).map((b) => b.key);
  assert.equal(new Set(saved).size, saved.length, `saved keys: ${saved}`);
  assert.ok(savedBoards(storage).some((b) => b.title === 'Garden'), 'and A\'s project is saved, under its new key');
});
