// Typing-freeze finding 5, the same race in the board store: a tab wrote its list without looking at
// storage, so another tab's save that had landed but whose `storage` event had not yet reached this tab
// (a task later, as in a browser) was written over — and the event then made the other tab read this
// tab's list as the other's save. Both changes were gone from the list in storage and in the other tab.
// Now a change reads storage first and takes in a save it has not heard of. Run: yarn test:unit
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { freshStorage, openTab, savedBoards, settle } from './board-store-harness.mjs';

let storage;
beforeEach(() => { storage = freshStorage(); });

/** The projects the test made: a new store starts with its own sample project, in every tab. */
const titles = (boards) => boards.map((b) => b.title).filter((t) => t.startsWith('From ')).sort();

test('two tabs add a project each before either has heard of the other: both projects stay, in both tabs and in storage', async () => {
  const A = await openTab(storage);
  const B = await openTab(storage);
  A.open();
  B.open();
  A.run(() => A.store().addBoard({ title: 'From A', key: 'AAA' }));
  B.run(() => B.store().addBoard({ title: 'From B', key: 'BBB' })); // A's event has not reached B: a task later
  await settle();
  assert.deepEqual(titles(savedBoards(storage)), ['From A', 'From B'], 'storage: before, the second write replaced the first');
  assert.deepEqual(titles(A.boards()), ['From A', 'From B']);
  assert.deepEqual(titles(B.boards()), ['From A', 'From B']);
});

test('two tabs add an issue each to one project before either has heard: both issues stay', async () => {
  const A = await openTab(storage);
  const B = await openTab(storage);
  A.open();
  B.open();
  const board = A.run(() => A.store().addBoard({ title: 'Shared', key: 'SHR' }));
  await settle();
  A.run(() => A.store().addIssue(board.id, { title: 'Issue from A' }));
  B.run(() => B.store().addIssue(board.id, { title: 'Issue from B' }));
  await settle();
  const issues = (boards) => boards.find((b) => b.id === board.id).issues.map((i) => i.title).sort();
  assert.deepEqual(issues(savedBoards(storage)), ['Issue from A', 'Issue from B']);
  assert.deepEqual(issues(A.boards()), ['Issue from A', 'Issue from B']);
  assert.deepEqual(issues(B.boards()), ['Issue from A', 'Issue from B']);
});

test('nothing waiting: a change is one write, and a save this tab heard of is not taken twice', async () => {
  const A = await openTab(storage);
  const B = await openTab(storage);
  A.open();
  B.open();
  A.run(() => A.store().addBoard({ title: 'From A', key: 'AAA' }));
  await settle(); // B has heard
  const writes = storage.writes.length;
  B.run(() => B.store().addBoard({ title: 'From B', key: 'BBB' }));
  assert.equal(storage.writes.length, writes + 1);
  await settle();
  assert.deepEqual(titles(A.boards()), ['From A', 'From B']);
  assert.equal(storage.writes.length, writes + 1, 'no tab answers');
});
