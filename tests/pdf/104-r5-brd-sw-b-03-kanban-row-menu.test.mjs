// R4-SW-B-03: a Kanban project's backlog is one section, but a row's ⋯ menu still offered
// 'Move to' with the project's active and future sprints (left over from when it used sprints).
// Picking one moved the issue into a sprint the Kanban backlog and board never show, so nothing
// visible changed but a history entry, and 'Backlog' was ticked even for a row still in a sprint.
// Now a Kanban row's menu has no 'Move to'; a Scrum row's still lists the sprints and Backlog.
// The real Backlog page and board store over tests/pdf/fake-dom.mjs (104-r5-brd-helpers.mjs).
// Run: node --test tests/pdf/104-r5-brd-sw-b-03-kanban-row-menu.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { issue, load, mountBacklog, project, sprint } from './104-r5-brd-helpers.mjs';

before(async () => { await setup(); await load(); });
after(teardown);

const sprints = [sprint('s1', 'Sprint 1', 'active'), sprint('s2', 'Sprint 2', 'future')];
const issues = [issue('i1', 1, 'Fix the tap', 'c1', { sprintId: 's1' }), issue('i2', 2, 'Buy nails', 'c1', { sprintId: null })];

it('Kanban: a backlog row\'s ⋯ menu has no Move to and lists no sprint; Delete stays', async () => {
  const page = mountBacklog(project({ mode: 'kanban', sprints, issues, nextNumber: 3 }));
  try {
    // HOME-1 is still in Sprint 1, from when the project used sprints.
    page.click(page.byLabel('HOME-1 actions'));
    const labels = page.items().map((el) => el.textContent.trim());
    assert.ok(labels.includes('Delete'), `the menu is open (${labels.join(', ')})`);
    assert.ok(!labels.includes('Move to'), 'a Kanban backlog has one section, nowhere to move to');
    assert.ok(!labels.some((l) => /Sprint/.test(l)), 'no sprint in the menu');
  } finally { await page.close(); }
});

it('Scrum: the menu still moves a row to the active sprint, a future one or the backlog', async () => {
  const page = mountBacklog(project({ mode: 'scrum', sprints, issues, nextNumber: 3 }));
  try {
    page.click(page.byLabel('HOME-2 actions'));
    page.click(page.item('Move to'));
    const labels = page.items().map((el) => el.textContent.trim());
    for (const l of ['Sprint 1', 'Sprint 2', 'Backlog']) assert.ok(labels.includes(l), `${l} is missing (${labels.join(', ')})`);
  } finally { await page.close(); }
});
