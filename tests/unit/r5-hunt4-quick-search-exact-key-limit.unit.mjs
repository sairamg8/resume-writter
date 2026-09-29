// R5-HUNT4-QUICK-SEARCH-EXACT-KEY-CROWDED-OUT: the top bar's quick search matched issue keys by prefix
// only and cut the list to 8, so with LIFE-10…LIFE-17 open ahead of it, 'LIFE-1' never listed LIFE-1
// (done, or last in rank), and no longer query could single it out. The issue whose key is the query
// now comes first among the issue results, done or not; the longer keys follow.
//
// Run: node --test tests/unit/r5-hunt4-quick-search-exact-key.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchWorkspace } from '../../src/utils/workspaceSearch.js';

/** LIFE with issues 10…20 in rank order and LIFE-1 last, in `lastColumn`. */
function board(lastColumn) {
  const issues = [];
  for (let n = 10; n <= 20; n += 1) issues.push({ id: `i${n}`, number: n, title: `Task ${n}`, columnId: 'todo' });
  issues.push({ id: 'i1', number: 1, title: 'First task', columnId: lastColumn });
  return {
    id: 'b1', title: 'Life admin', key: 'LIFE', issues,
    columns: [{ id: 'todo', category: 'todo' }, { id: 'done', category: 'done' }],
  };
}

test('an open issue whose key is the query is listed first, ahead of longer keys ranked above it', () => {
  for (const q of ['LIFE-1', 'life 1', ' life-1 ']) {
    const keys = searchWorkspace([board('todo')], q).map((h) => h.key);
    assert.equal(keys[0], 'LIFE-1', q);
    assert.equal(keys.length, 8);
    assert.deepEqual(keys.slice(1), ['LIFE-10', 'LIFE-11', 'LIFE-12', 'LIFE-13', 'LIFE-14', 'LIFE-15', 'LIFE-16']);
  }
});

test('a done issue whose key is the query is still listed first', () => {
  const hits = searchWorkspace([board('done')], 'LIFE-1');
  assert.equal(hits[0].key, 'LIFE-1');
  assert.equal(hits[0].done, true);
  assert.equal(hits[0].to, '/boards/b1?issue=LIFE-1');
});

test('a query that is no issue key keeps the open-before-done prefix order', () => {
  const keys = searchWorkspace([board('done')], 'LIFE-', { limit: 20 }).filter((h) => h.kind === 'issue').map((h) => h.key);
  assert.equal(keys.at(-1), 'LIFE-1', 'the done issue comes last');
});
