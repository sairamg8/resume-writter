// CYC8-S5: signing out takes the account's list out of the browser, and its recovery notice with it
// (leaveRecovery). Only the tab that ran the leave cleared the notice; the job store has listLeft
// for the other tabs (it hears the sync record lose its account), the board store had no
// counterpart, so another tab kept showing a "some projects could not be read" notice with a
// "Download the copy" of the last account's list. Now a board tab hears the account leave from the
// sync record and drops its notice. Tabs over one shared storage (board-store-harness.mjs).
// Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshStorage, openTab, settle } from './board-store-harness.mjs';
import { createBoard } from '../../src/utils/boardModel.js';

const KEY = 'cpwtcv_boards_v2';
const SYNC_KEY = 'cpwtcv_boards_sync_v1';
const record = (uid) => JSON.stringify({ uid, versions: {}, order: null, stashed: {} });

/** Two tabs on a list that could not be read in full, signed in as account A; both show the notice. */
async function twoTabsWithNotice() {
  const garden = createBoard({ title: 'Garden' }, { now: 1000 });
  const storage = freshStorage();
  storage.setItem(KEY, JSON.stringify({ boards: [garden, 'not a project'], dataVersion: 2 }));
  storage.setItem(SYNC_KEY, record('A'));
  const first = await openTab(storage);
  first.open(); // loads the list, backs it up, keeps the notice
  const second = await openTab(storage);
  second.open();
  await settle();
  assert.ok(first.run((m) => m.snapshot().recovery), 'the first tab shows the notice');
  assert.ok(second.run((m) => m.snapshot().recovery), 'the second tab shows it too');
  return { storage, first, second };
}

test('signed out in one tab: the other tab drops the recovery notice', async () => {
  const { storage, first, second } = await twoTabsWithNotice();

  // The first tab runs the leave: the record loses its account (the list and the notice go with
  // it there; this tab only hears the record change).
  first.run(() => storage.setItem(SYNC_KEY, record(null)));
  await settle();

  assert.equal(second.run((m) => m.snapshot().recovery), null, 'the tab that only heard of it shows no notice');
});

test('the sync record changing while the account stays keeps the notice', async () => {
  const { storage, second } = await twoTabsWithNotice();
  storage.setItem(SYNC_KEY, JSON.stringify({ uid: 'A', versions: { x: 1 }, order: ['x'], stashed: {} }));
  await settle();
  assert.ok(second.run((m) => m.snapshot().recovery), 'the account did not leave: the notice stays');
});
