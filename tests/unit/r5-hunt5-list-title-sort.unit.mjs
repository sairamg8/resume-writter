// R5-HUNT5-LIST-TITLE-SORT-CODEPOINT: the project List sorted Summary by code point (lower-cased
// titles compared with <): an accented first letter sorted after 'z', and 'Step 10' before 'Step 2',
// while the job list sorts its text with localeCompare (sensitivity 'base', numeric; J-18). Titles
// now sort the same way. Run: node --test tests/unit/r5-hunt5-list-title-sort.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as ops from '../../src/utils/boardOps.js';
import { sortIssues } from '../../src/utils/boardQuery.js';
import { createBoard } from '../../src/utils/boardModel.js';

const ctx = { now: new Date(2026, 8, 29, 10, 0).getTime() };

function board(titles) {
  let b = createBoard({ title: 'Life', key: 'LIFE', template: 'kanban' }, { now: ctx.now - 1000 });
  for (const title of titles) b = ops.addIssue(b, { id: title, title }, ctx);
  return b;
}
const titles = (list) => list.map((i) => i.title);

test('Summary ascending: accents and case aside, numbers in titles as numbers', () => {
  const b = board(['Zoo', 'Éclair', 'apple', 'Step 2', 'Step 10']);
  assert.deepEqual(titles(sortIssues(b, b.issues, 'title')), ['apple', 'Éclair', 'Step 2', 'Step 10', 'Zoo']);
  assert.deepEqual(titles(sortIssues(b, b.issues, 'title', 'desc')), ['Zoo', 'Step 10', 'Step 2', 'Éclair', 'apple']);
});

test('titles equal but for case or accents keep the rank', () => {
  const b = board(['resume', 'Résumé', 'RESUME']);
  assert.deepEqual(titles(sortIssues(b, b.issues, 'title')), ['resume', 'Résumé', 'RESUME']);
  assert.deepEqual(titles(sortIssues(b, b.issues, 'title', 'desc')), ['resume', 'Résumé', 'RESUME']);
});
