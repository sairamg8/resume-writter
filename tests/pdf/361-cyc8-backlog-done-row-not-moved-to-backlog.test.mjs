// A done issue dragged from a sprint to the Backlog section (or moved there with a row's Move to menu) left its sprint and then lived
// on no page of the Backlog: the backlog lists open issues only (boardQuery.backlogSections), a sprint lists all of its own. It stayed in
// List and Board, so it looked deleted. Chosen: refuse it. A done row dropped on the Backlog (its foot or one of its rows) stays in its
// sprint, and its Move to menu does not offer Backlog (the sprints are still there). Open rows move as before, and a done row still
// moves between sprints. (The old UI, 00c7283, has the same backlog rule and the same drop; no stricter rule there to follow.)
// The real Backlog page and board store over tests/pdf/fake-dom.mjs (104-r5-brd-helpers.mjs).
// Run: node --test tests/pdf/361-cyc8-backlog-done-row-not-moved-to-backlog.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { issue, issueNow, load, mountBacklog, project, sprint } from './104-r5-brd-helpers.mjs';

before(async () => { await setup(); await load(); });
after(teardown);

const sprints = [sprint('s1', 'Sprint 1', 'active'), sprint('s2', 'Sprint 2', 'future')];
const issues = [
  issue('i1', 1, 'Fix the tap', 'c1', { sprintId: 's1' }),
  issue('i3', 3, 'Buy nails', 'c1', { sprintId: null }),
  issue('i4', 4, 'Sweep the yard', 'c3', { sprintId: 's1', resolvedAt: 1 }),
];
const board = () => project({ mode: 'scrum', sprints, issues, nextNumber: 5 });
const onFoot = (id) => ({ active: { id }, over: { id: 'section:backlog', data: { current: { type: 'section', sprintId: null } } } });
const onRow = (id, overId) => ({ active: { id }, over: { id: overId, data: { current: { type: 'row', sprintId: null } } } });

it('a done row dropped on the Backlog\'s foot stays in its sprint', async () => {
  const page = mountBacklog(board());
  try {
    page.onDragEnd(onFoot('i4'));
    assert.equal(issueNow('i4').sprintId, 's1', 'it is still in Sprint 1');
    assert.match(page.section('s1').textContent, /Sweep the yard/, 'and still listed there');
  } finally { await page.close(); }
});

it('a done row dropped on a row of the Backlog stays in its sprint too', async () => {
  const page = mountBacklog(board());
  try {
    page.onDragEnd(onRow('i4', 'i3'));
    assert.equal(issueNow('i4').sprintId, 's1');
  } finally { await page.close(); }
});

it('an open row still moves to the Backlog, and a done row still moves to another sprint', async () => {
  const page = mountBacklog(board());
  try {
    page.onDragEnd(onFoot('i1'));
    assert.equal(issueNow('i1').sprintId, null, 'the open row left its sprint');
    page.onDragEnd({ active: { id: 'i4' }, over: { id: 'section:s2', data: { current: { type: 'section', sprintId: 's2' } } } });
    assert.equal(issueNow('i4').sprintId, 's2', 'the done row moved to Sprint 2');
  } finally { await page.close(); }
});

it('a done row\'s Move to menu offers the sprints but not the Backlog; an open row\'s offers all', async () => {
  const page = mountBacklog(board());
  try {
    page.click(page.byLabel('HOME-4 actions'));
    page.click(page.item('Move to'));
    const done = page.items().map((el) => el.textContent.trim());
    assert.ok(done.includes('Sprint 1') && done.includes('Sprint 2'), `the sprints: ${done.join(' | ')}`);
    assert.ok(!done.includes('Backlog'), 'not the Backlog');
  } finally { await page.close(); }
  const again = mountBacklog(board());
  try {
    again.click(again.byLabel('HOME-1 actions'));
    again.click(again.item('Move to'));
    assert.ok(again.items().map((el) => el.textContent.trim()).includes('Backlog'), 'an open row can go back to the Backlog');
  } finally { await again.close(); }
});
