// R5-BRD-01: a backlog row's ⋯ menu > Move to > the section it is already in (the ticked radio)
// still moved it, to that section's foot: Sprint 1 read A, B, C and picking 'Sprint 1' on A made it
// B, C, A (and the same with 'Backlog' on a backlog row), saved. Now the ticked one does nothing —
// the row keeps its place and nothing is saved — as the board card's Move to does. Picking another
// section still moves it there. The real Backlog page and board store over tests/pdf/fake-dom.mjs.
// Run: node --test tests/pdf/104-r5-brd-01-move-to-same-section.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { boardNow, issue, issueNow, load, mountBacklog, project, sprint } from './104-r5-brd-helpers.mjs';

before(async () => { await setup(); await load(); });
after(teardown);

const sprints = [sprint('s1', 'Sprint 1', 'future')];
const issues = [
  issue('a', 1, 'Fix the tap', 'c1', { sprintId: 's1' }),
  issue('b', 2, 'Paint the fence', 'c1', { sprintId: 's1' }),
  issue('c', 3, 'Buy nails', 'c1', { sprintId: 's1' }),
  issue('d', 4, 'Oil the gate', 'c1', { sprintId: null }),
  issue('e', 5, 'Sweep the yard', 'c1', { sprintId: null }),
];
const order = () => boardNow().issues.map((i) => i.id).join(' ');

it('picking the ticked section (a sprint, the backlog) keeps the row where it is and saves nothing', async () => {
  const page = mountBacklog(project({ mode: 'scrum', sprints, issues, nextNumber: 6 }));
  try {
    const saved = boardNow();
    for (const [key, section] of [['HOME-1', 'Sprint 1'], ['HOME-4', 'Backlog']]) {
      page.click(page.byLabel(`${key} actions`));
      page.click(page.item('Move to'));
      const tick = page.item(section);
      assert.equal(tick.getAttribute('aria-checked'), 'true', `${key}: ${section} is the ticked one`);
      page.click(tick);
      assert.equal(order(), 'a b c d e', `${key}: picking ${section} moved it`);
    }
    assert.equal(boardNow(), saved, 'nothing was saved');
    assert.match(page.section('s1').textContent, /Fix the tap.*Paint the fence.*Buy nails/);
  } finally { await page.close(); }
});

it('picking another section still moves the row there, at its foot', async () => {
  const page = mountBacklog(project({ mode: 'scrum', sprints, issues, nextNumber: 6 }));
  try {
    page.click(page.byLabel('HOME-4 actions'));
    page.click(page.item('Move to'));
    page.click(page.item('Sprint 1'));
    assert.equal(issueNow('d').sprintId, 's1');
    assert.match(page.section('s1').textContent, /Fix the tap.*Paint the fence.*Buy nails.*Oil the gate/);
  } finally { await page.close(); }
});
