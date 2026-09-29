// R4-SW-B-02: a Kanban project's backlog lists every open issue, including rows still in a sprint
// from when it used sprints (R4-BRD-08). A row still in a sprint dropped on the backlog's foot (its
// header, the space under its rows) left its sprint but was ranked after the last issue in no
// sprint, so rows still in a sprint stayed below it. Now it lands last in the backlog as shown.
// The real Backlog page and board store over tests/pdf/fake-dom.mjs (104-r5-brd-helpers.mjs).
// Run: node --test tests/pdf/104-r5-brd-sw-b-02-kanban-foot-drop.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown } from './harness.mjs';
import { issue, issueNow, load, mountBacklog, project, sprint } from './104-r5-brd-helpers.mjs';

before(async () => { await setup(); await load(); });
after(teardown);

const sprints = [sprint('s0', 'Sprint 0', 'closed'), sprint('s1', 'Sprint 1', 'active'), sprint('s2', 'Sprint 2', 'future')];
const issues = [
  issue('i1', 1, 'Fix the tap', 'c1', { sprintId: 's1' }),
  issue('i2', 2, 'Paint the fence', 'c2', { sprintId: 's2' }),
  issue('i3', 3, 'Buy nails', 'c1', { sprintId: null }),
  issue('i4', 4, 'Sweep the yard', 'c3', { sprintId: 's1', resolvedAt: 1 }),
  issue('i5', 5, 'Oil the gate', 'c1', { sprintId: 's0' }),
];
const onFoot = (id) => ({ active: { id }, over: { id: 'section:backlog', data: { current: { type: 'section', sprintId: null } } } });

it('Kanban: a row still in a sprint dropped on the backlog\'s foot lands last, and leaves its sprint', async () => {
  const page = mountBacklog(project({ mode: 'kanban', sprints, issues, nextNumber: 6 }));
  try {
    page.onDragEnd(onFoot('i1'));
    assert.equal(issueNow('i1').sprintId, null, 'it leaves its old sprint');
    assert.match(page.section('backlog').textContent, /Paint the fence.*Buy nails.*Oil the gate.*Fix the tap/, 'Fix the tap is not last');
  } finally { await page.close(); }
});

it('Kanban: a row dropped below the last row (after it) lands last too', async () => {
  const page = mountBacklog(project({ mode: 'kanban', sprints, issues, nextNumber: 6 }));
  try {
    // Dropped on 'Oil the gate', the last row, from above it: it goes after it.
    page.onDragEnd({ active: { id: 'i2' }, over: { id: 'i5', data: { current: { type: 'row', sprintId: null } } } });
    assert.equal(issueNow('i2').sprintId, null);
    assert.match(page.section('backlog').textContent, /Fix the tap.*Buy nails.*Oil the gate.*Paint the fence/);
  } finally { await page.close(); }
});

it('Scrum is unchanged: a foot drop appends to the end of that section', async () => {
  const page = mountBacklog(project({ mode: 'scrum', sprints, issues, nextNumber: 6 }));
  try {
    page.onDragEnd(onFoot('i1'));
    assert.equal(issueNow('i1').sprintId, null);
    assert.match(page.section('backlog').textContent, /Buy nails.*Fix the tap/);
  } finally { await page.close(); }
});
