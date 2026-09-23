// Unit tests for making a saved board readable (src/utils/normalizeBoard.js): the same
// never-destroy contract as normalize-job.unit.mjs, one level deeper. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readBoard, completeBoard } from '../../src/utils/normalizeBoard.js';

test('B-02: a list whose cards are missing or null reads as an empty list, and nothing counts as lost', () => {
  const raw = { id: 'b', title: 'B', lists: [{ id: 'l', title: 'x' }, { id: 'm', title: 'y', cards: null }] };
  const read = readBoard(raw);
  const board = completeBoard(read.kept);
  assert.ok(board.lists.every((l) => Array.isArray(l.cards)), JSON.stringify(board.lists));
  assert.deepEqual(board.lists.map((l) => l.cards.length), [0, 0]);
  assert.equal(read.lost, false, 'no cards held nothing: no backup, no notice');
  // A value that is not a list at all did hold something: that is a loss (backed up, reported).
  assert.equal(readBoard({ id: 'b', lists: [{ id: 'l', cards: 'junk' }] }).lost, true);
});
