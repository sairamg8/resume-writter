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

test('B-15: card ids are unique across the whole board, and never a list\'s id', () => {
  const card = (id, title) => ({ id, title, checklist: [] });
  const raw = {
    id: 'b',
    lists: [
      { id: 'l1', title: 'One', cards: [card('dup', 'Card in One')] },
      { id: 'l2', title: 'Two', cards: [card('dup', 'Card in Two'), card('z', 'Z')] },
      { id: 'x', title: 'X', cards: [card('x', 'Card sharing the list id')] },
    ],
  };
  const board = completeBoard(readBoard(raw).kept);
  const cardIds = board.lists.flatMap((l) => l.cards.map((c) => c.id));
  const listIds = board.lists.map((l) => l.id);
  assert.equal(new Set(cardIds).size, cardIds.length, cardIds.join());
  assert.ok(cardIds.every((id) => !listIds.includes(id)), `${cardIds} vs ${listIds}`);
  assert.equal(board.lists[0].cards[0].id, 'dup', 'the first holder keeps its id (a link to it still opens it)');
  assert.deepEqual(listIds, ['l1', 'l2', 'x'], 'lists keep theirs');
  assert.deepEqual(board.lists.flatMap((l) => l.cards.map((c) => c.title)), ['Card in One', 'Card in Two', 'Z', 'Card sharing the list id']);
});
