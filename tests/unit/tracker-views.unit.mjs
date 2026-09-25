// Unit tests for what the tracker's new views compute: the top bar's quick search
// (utils/workspaceSearch), the History tab's sentences (utils/issueHistory), the Summary page's
// numbers (utils/projectSummary) and the Calendar and Timeline dates (utils/calendarGrid) — all
// over a fixed `now`. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchWorkspace } from '../../src/utils/workspaceSearch.js';
import { describeActivity } from '../../src/utils/issueHistory.js';
import { projectSummary } from '../../src/utils/projectSummary.js';
import { dayRange, daysBetween, monthWeeks, shiftMonth, weekStart } from '../../src/utils/calendarGrid.js';
import * as ops from '../../src/utils/boardOps.js';
import { createBoard } from '../../src/utils/boardModel.js';

const NOW = new Date(2026, 8, 23, 10, 0).getTime(); // Wed 23 Sep 2026
const DAY = 24 * 60 * 60 * 1000;

/** LIFE: To Do / Doing / Done, an epic with two children, a bug, a story and a done chore. */
function life() {
  let b = createBoard({ title: 'Life admin', key: 'LIFE' }, { now: NOW - 30 * DAY });
  b = { ...b, columns: [
    { id: 'todo', title: 'To Do', category: 'todo', wipLimit: null },
    { id: 'doing', title: 'Doing', category: 'inprogress', wipLimit: null },
    { id: 'done', title: 'Done', category: 'done', wipLimit: null },
  ] };
  const add = (id, fields, at = NOW) => { b = ops.addIssue(b, { id, title: id, ...fields }, { now: at }); };
  add('epic', { title: 'Move flat', type: 'epic', priority: 'high' }, NOW - 20 * DAY);
  add('van', { title: 'Book the moving van', epicId: 'epic', due: '2026-09-25', priority: 'highest', estimate: 2 }, NOW - 20 * DAY);
  add('boxes', { title: 'Pack the boxes', epicId: 'epic', columnId: 'doing', priority: 'high' });
  add('tap', { title: 'Fix the tap', type: 'bug', due: '2026-10-10', priority: 'medium' });
  add('read', { title: 'Read a book', type: 'story', priority: 'low' }, NOW - 20 * DAY);
  add('chore', { title: 'Old chore', priority: 'low' }, NOW - 20 * DAY);
  b = ops.moveIssue(b, 'chore', { columnId: 'done' }, { now: NOW - 2 * DAY });
  return b;
}

test('quick search: a project by name or key, issues by key prefix or every word of the title, open before done', () => {
  const b = life();
  const other = createBoard({ title: 'Work', key: 'WORK' }, { now: NOW });
  assert.deepEqual(searchWorkspace([b, other], ''), [], 'an empty query finds nothing');
  const byName = searchWorkspace([b, other], 'life');
  assert.equal(byName[0].kind, 'project');
  assert.equal(byName[0].to, `/boards/${b.id}`);
  const byKey = searchWorkspace([b], 'life-2').map((h) => h.key);
  assert.deepEqual(byKey, ['LIFE-2'], 'LIFE-2, not LIFE-1 or a title match');
  assert.deepEqual(searchWorkspace([b], 'life 3').map((h) => h.key), ['LIFE-3'], 'a space reads as the dash');
  const words = searchWorkspace([b], 'van moving');
  assert.deepEqual(words.map((h) => h.title), ['Book the moving van'], 'every word, in any order');
  assert.equal(words[0].to, `/boards/${b.id}?issue=LIFE-2`);
  const all = searchWorkspace([b], 'o', { limit: 20 }).filter((h) => h.kind === 'issue');
  assert.equal(all.at(-1).title, 'Old chore', 'the done issue comes last');
  assert.equal(searchWorkspace([b], 'o', { limit: 2 }).length, 2, 'the limit holds');
  assert.deepEqual(searchWorkspace([null, { id: 'x' }], 'x'), [], 'what is not a project is skipped');
});

test('history: each entry as a sentence, its values by name and a cleared one as None', () => {
  assert.deepEqual(describeActivity({ kind: 'created' }), { text: 'created the issue', from: null, to: null });
  assert.deepEqual(describeActivity({ kind: 'comment' }), { text: 'added a comment', from: null, to: null });
  assert.deepEqual(describeActivity({ kind: 'field', field: 'priority', from: 'medium', to: 'highest' }), { text: 'changed the Priority', from: 'Medium', to: 'Highest' });
  assert.deepEqual(describeActivity({ kind: 'field', field: 'status', from: 'To Do', to: 'Done' }), { text: 'changed the Status', from: 'To Do', to: 'Done' });
  assert.deepEqual(describeActivity({ kind: 'field', field: 'due', from: '', to: '2026-10-01' }), { text: 'changed the Due date', from: 'None', to: '2026-10-01' });
  assert.deepEqual(describeActivity({ kind: 'field', field: 'type', from: 'task', to: 'bug' }), { text: 'changed the Issue type', from: 'Task', to: 'Bug' });
  assert.equal(describeActivity({ kind: 'field', field: 'recurrence', from: 'none', to: 'weekly' }).to, 'Every week');
  assert.equal(describeActivity(null), null);
});

test('summary: the last 7 days, the status categories, priorities, types, epics and the latest changes', () => {
  const s = projectSummary(life(), NOW);
  assert.equal(s.total, 6);
  assert.equal(s.completed, 1, 'the chore, resolved two days ago');
  assert.equal(s.created, 2, 'boxes and tap were created today; the rest 20 days ago');
  assert.equal(s.dueSoon, 1, 'the van, due in two days; the tap is due in 17');
  assert.deepEqual(s.byCategory, { todo: 4, inprogress: 1, done: 1 });
  assert.deepEqual(s.byPriority.map((p) => [p.id, p.count]), [['highest', 1], ['high', 2], ['medium', 1], ['low', 2], ['lowest', 0]]);
  assert.deepEqual(s.byType.map((t) => [t.id, t.count, t.share]), [['task', 3, 50], ['bug', 1, 17], ['story', 1, 17], ['epic', 1, 17]]);
  assert.deepEqual(s.epics.map((e) => [e.key, e.total, e.done]), [['LIFE-1', 2, 0]]);
  assert.ok(s.recent.length > 0 && s.recent.length <= 8);
  assert.ok(s.recent.every((r, i) => i === 0 || s.recent[i - 1].entry.at >= r.entry.at), 'newest first');
  assert.equal(s.recent[0].issue.id, 'boxes', 'the latest change');
});

test('calendar: whole Monday-first weeks around a month, month steps, day ranges and day counts', () => {
  const sep = monthWeeks('2026-09-15');
  assert.equal(sep[0][0].iso, '2026-08-31', 'September 2026 starts on a Tuesday: the Monday before');
  assert.equal(sep[0][0].inMonth, false);
  assert.equal(sep.at(-1).at(-1).iso, '2026-10-04');
  assert.equal(sep.length, 5);
  assert.ok(sep.every((w) => w.length === 7));
  const feb = monthWeeks('2027-02-01');
  assert.equal(feb[0][0].iso, '2027-02-01', 'February 2027 starts on a Monday');
  assert.equal(feb.length, 4);
  assert.equal(shiftMonth('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftMonth('2026-03-31', -1), '2026-02-01');
  assert.equal(weekStart('2026-09-27'), '2026-09-21', 'a Sunday belongs to the week begun on Monday');
  assert.deepEqual(dayRange('2026-10-24', 3), ['2026-10-24', '2026-10-25', '2026-10-26']);
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2, 'across the end of summer time, whole days');
  assert.equal(daysBetween('2026-09-30', '2026-09-01'), -29);
  assert.equal(daysBetween('nope', '2026-09-01'), null);
});
