// CYC8-S6 (projects): another tab saved a board list this tab cannot read in full. takeOtherTabsList
// backed the raw value up (loadSavedList) but kept no recovery notice and left the sync record
// naming every project the cloud holds, so the next first sync took the ones left out for deleted
// here and deleted them from the account. Now it behaves like the boot-time unreadable-value path
// (init): the recovery notice, and the record forgetting what the cloud holds (forgetSynced).
// Tabs over one shared storage (board-store-harness.mjs). Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshStorage, openTab, settle } from './board-store-harness.mjs';
import { createBoard } from '../../src/utils/boardModel.js';

const KEY = 'cpwtcv_boards_v2';
const SYNC_KEY = 'cpwtcv_boards_sync_v1';

test('a list another tab saved that cannot be read in full: the notice is kept and the sync record forgets the cloud\'s projects', async () => {
  const garden = createBoard({ title: 'Garden' }, { now: 1000 });
  const storage = freshStorage();
  storage.setItem(KEY, JSON.stringify({ boards: [garden], dataVersion: 2 }));
  storage.setItem(SYNC_KEY, JSON.stringify({ uid: 'A', versions: { [garden.id]: 1000 }, order: [garden.id], stashed: {} }));
  const tab = await openTab(storage);
  tab.open();
  assert.equal(tab.run((m) => m.snapshot().recovery), null, 'a readable list: no notice');

  // Another tab saves a list holding an entry nobody can read; this tab hears of it.
  const raw = JSON.stringify({ boards: [garden, 'not a project'], dataVersion: 2 });
  storage.setItem(KEY, raw);
  await settle();

  const recovery = tab.run((m) => m.snapshot().recovery);
  assert.ok(recovery?.backupKey, 'the recovery notice names the backup of what was read');
  assert.equal(storage.getItem(recovery.backupKey), raw, 'the backup holds the raw value');
  const record = JSON.parse(storage.getItem(SYNC_KEY));
  assert.deepEqual(record.versions, {}, 'the record no longer says the cloud holds the project: nothing left out looks deleted');
  assert.equal(record.uid, 'A', 'the account stays');
});
