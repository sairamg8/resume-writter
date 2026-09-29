// R5-HUNT4-quick-search-exact-key-loses-to-prefix: the top bar's quick search listed every issue
// whose key starts with the query alike, open before done, and cut the list to 8. 'LIFE-1' with
// LIFE-1 done (or ranked below its siblings) put LIFE-11 first, so Enter opened LIFE-11; with eight
// open LIFE-1x issues LIFE-1 was not listed at all. Pinned: the issue whose key is the query ('LIFE-1',
// 'life 1') comes first, done or not, and its prefix siblings follow. Fictional data only.
// Run: node --test tests/unit/r5-hunt4-quick-search-exact-key.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchWorkspace } from '../../src/utils/workspaceSearch.js';
import * as ops from '../../src/utils/boardOps.js';
import { createBoard } from '../../src/utils/boardModel.js';

const NOW = new Date(2026, 8, 29, 10, 0).getTime();

/** LIFE with `count` issues LIFE-1…LIFE-count; LIFE-1 is moved to Done. */
function life(count) {
  let b = createBoard({ title: 'Life admin', key: 'LIFE' }, { now: NOW });
  b = { ...b, columns: [
    { id: 'todo', title: 'To Do', category: 'todo', wipLimit: null },
    { id: 'done', title: 'Done', category: 'done', wipLimit: null },
  ] };
  for (let n = 1; n <= count; n += 1) b = ops.addIssue(b, { id: `i${n}`, title: `Chore ${n}` }, { now: NOW });
  return ops.moveIssue(b, 'i1', { columnId: 'done' }, { now: NOW });
}

test('the done issue whose key is typed in full comes first, ahead of open prefix siblings', () => {
  const b = life(11);
  const keys = searchWorkspace([b], 'LIFE-1').map((h) => h.key);
  assert.equal(keys[0], 'LIFE-1', 'Enter opens the first row: it must be LIFE-1');
  assert.ok(keys.includes('LIFE-10') && keys.includes('LIFE-11'), 'the prefix matches are still listed');
  assert.equal(searchWorkspace([b], 'life 1')[0].key, 'LIFE-1', 'a space reads as the dash');
});

test('eight or more open prefix siblings do not push the exact key out of the list', () => {
  const b = life(19);
  const hits = searchWorkspace([b], 'life-1');
  assert.equal(hits.length, 8, 'the limit holds');
  assert.equal(hits[0].key, 'LIFE-1');
  assert.equal(hits.filter((h) => h.key === 'LIFE-1').length, 1, 'listed once');
});
