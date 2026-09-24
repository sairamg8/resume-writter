// The Backlog page (/boards/:id/backlog), where a project's sprints are planned and started: it was
// a placeholder, so no sprint could ever start and a Scrum board had no way to show one. Here the
// real page and the real board store are mounted with react-dom/client (tests/pdf/fake-dom.mjs,
// through Vite's loader), their handlers called as clicks: a Kanban project switches to sprints; a
// sprint is created, filled from the backlog, started (name, dates, goal) — and the board then
// shows it — completed with its open issues sent on, renamed and deleted; an issue is added.
import { before, after, beforeEach, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

const KEY = 'cpwtcv_boards_v2';

let Backlog;
let Board;
let store;
let model;
before(async () => {
  await setup();
  ({ Backlog } = await loadModule('/src/pages/Backlog.jsx'));
  ({ Board } = await loadModule('/src/pages/Board.jsx'));
  store = await loadModule('/src/hooks/useBoardStore.js');
  model = await loadModule('/src/utils/boardModel.js');
});
after(teardown);

class Storage {
  constructor(entries = []) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

beforeEach(() => { store._resetBoardStoreForTest(); });
afterEach(() => { delete globalThis.localStorage; delete globalThis.confirm; });

const col = (id, title, category = 'todo') => ({ id, title, category, wipLimit: null });
const issue = (id, number, title, columnId, extra = {}) => ({ id, number, type: 'task', title, columnId, labelIds: [], checklist: [], ...extra });
const project = (extra = {}) => ({
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1', mode: 'kanban',
  columns: [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')],
  labels: [], sprints: [],
  issues: [issue('i1', 1, 'Fix the tap', 'c1'), issue('i2', 2, 'Paint the fence', 'c2'), issue('i3', 3, 'Buy nails', 'c1')],
  nextNumber: 4,
  ...extra,
});

function open(boards) {
  globalThis.localStorage = new Storage([[KEY, JSON.stringify({ boards, dataVersion: 2 })]]);
  store.subscribe(() => {});
}

const routes = (path) => createElement(MemoryRouter, { initialEntries: [path] },
  createElement(Routes, null,
    createElement(Route, { path: '/boards/:id', element: createElement(Board) }),
    createElement(Route, { path: '/boards/:id/backlog', element: createElement(Backlog) })));

/** The visible text of the board page (server-rendered). */
const boardText = () => renderToStaticMarkup(routes('/boards/p1')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

async function mountBacklog() {
  const dom = await import('./fake-dom.mjs');
  const view = dom.mount(() => routes('/boards/p1/backlog'), {});
  const ev = { stopPropagation() {}, preventDefault() {}, key: '' };
  const all = (node = view.container) => [...dom.elements(node)];
  return {
    view,
    text: () => view.container.textContent,
    section: (id) => all().find((el) => el.getAttribute('data-section') === id),
    button: (text, node) => all(node).find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text),
    byLabel: (label, node) => all(node).find((el) => el.getAttribute('aria-label') === label),
    click: (el) => view.act(() => dom.reactProps(el).onClick(ev)),
    change: (el, value) => view.act(() => dom.reactProps(el).onChange({ ...ev, target: { value } })),
    key: (el, key) => view.act(() => dom.reactProps(el).onKeyDown({ ...ev, key })),
  };
}

const boardNow = () => store.snapshot().boards.find((b) => b.id === 'p1');
const sprintOf = (id) => boardNow().issues.find((i) => i.id === id).sprintId;

it('a Kanban project switches to sprints; a sprint is created, filled, started — and the board shows it', async () => {
  open([project()]);
  const page = await mountBacklog();
  try {
    assert.match(page.text(), /This project is Kanban/);
    assert.equal(page.button('Create sprint'), undefined, 'no sprints on a Kanban project');
    page.click(page.button('Use sprints'));
    assert.equal(boardNow().mode, 'scrum');

    page.click(page.button('Create sprint'));
    const [sprint] = boardNow().sprints;
    assert.equal(sprint.name, 'HOME Sprint 1');
    assert.equal(sprint.state, 'future');

    // Two issues from the backlog into the sprint.
    page.change(page.byLabel('Move HOME-1 to'), sprint.id);
    page.change(page.byLabel('Move HOME-2 to'), sprint.id);
    assert.deepEqual([sprintOf('i1'), sprintOf('i2'), sprintOf('i3')], [sprint.id, sprint.id, null]);
    assert.match(page.section(sprint.id).textContent, /Fix the tap.*Paint the fence/);
    assert.match(page.section(sprint.id).textContent, /2 issues · 0 done/);
    assert.doesNotMatch(page.section('backlog').textContent, /Fix the tap/);

    // Start it: today and two weeks on by default, a new name and a goal.
    page.click(page.button('Start sprint'));
    const form = page.section(sprint.id);
    assert.equal(page.byLabel('Start date', form).getAttribute('value') ?? page.byLabel('Start date', form).value, model.todayISO());
    page.change(page.byLabel('Sprint name', form), 'Fence week');
    page.change(page.byLabel('Sprint goal', form), 'The fence is done');
    page.click(page.button('Start', form));
    const started = boardNow().sprints[0];
    assert.equal(started.state, 'active');
    assert.equal(started.name, 'Fence week');
    assert.equal(started.goal, 'The fence is done');
    assert.equal(started.startDate, model.todayISO());
    assert.equal(started.endDate, model.addDays(model.todayISO(), 14));
    assert.match(page.text(), /Active/);

    // The board now shows the sprint and only its issues; a card added there joins it.
    const t = boardText();
    assert.match(t, /Sprint: Fence week/);
    assert.match(t, /Fix the tap/);
    assert.doesNotMatch(t, /Buy nails/);
  } finally {
    await page.view.unmount();
  }
});

it('one sprint at a time; completing it sends its open issues to the backlog or a future sprint, done ones stay', async () => {
  const sprints = [
    { id: 's1', name: 'Sprint 1', goal: '', startDate: '2026-09-21', endDate: '2026-10-05', state: 'active', completedAt: null },
    { id: 's2', name: 'Sprint 2', goal: '', startDate: '', endDate: '', state: 'future', completedAt: null },
  ];
  const issues = [issue('i1', 1, 'Open one', 'c1', { sprintId: 's1' }), issue('i2', 2, 'Done one', 'c3', { sprintId: 's1', resolvedAt: 1 }), issue('i3', 3, 'Later', 'c1')];
  open([project({ mode: 'scrum', sprints, issues })]);
  const page = await mountBacklog();
  try {
    assert.ok(page.button('Start sprint', page.section('s2')).getAttribute('disabled') !== null, 'no second active sprint');
    page.click(page.button('Complete sprint'));
    const section = page.section('s1');
    assert.match(section.textContent, /1 open issue move to/);
    page.change(page.byLabel('Move open issues to', section), 's2');
    page.click(page.button('Complete', section));
    const b = boardNow();
    assert.equal(b.sprints.find((s) => s.id === 's1').state, 'closed');
    assert.equal(sprintOf('i1'), 's2', 'open: on to the next sprint');
    assert.equal(sprintOf('i2'), 's1', 'done: keeps the closed sprint as its record');
    assert.equal(page.section('s1'), undefined, 'a closed sprint leaves the backlog page');
    // Now the next one can start.
    assert.equal(page.button('Start sprint', page.section('s2')).getAttribute('disabled'), null);
  } finally {
    await page.view.unmount();
  }
});

it('a sprint is renamed and deleted (its issues go to the backlog); an issue is added to a section', async () => {
  const sprints = [{ id: 's2', name: 'Sprint 2', goal: '', startDate: '', endDate: '', state: 'future', completedAt: null }];
  open([project({ mode: 'scrum', sprints, issues: [issue('i1', 1, 'Planned', 'c1', { sprintId: 's2' })] })]);
  const page = await mountBacklog();
  globalThis.confirm = () => true;
  try {
    page.click(page.button('Sprint 2'));
    page.change(page.byLabel('Sprint name', page.section('s2')), 'Garden sprint');
    page.key(page.byLabel('Sprint name', page.section('s2')), 'Enter');
    assert.equal(boardNow().sprints[0].name, 'Garden sprint');

    page.change(page.byLabel('New issue', page.section('s2')), 'Weed the beds');
    page.click(page.button('Add', page.section('s2')));
    const added = boardNow().issues.find((i) => i.title === 'Weed the beds');
    assert.equal(added.sprintId, 's2');

    page.change(page.byLabel('New issue', page.section('backlog')), 'Mow the lawn');
    page.key(page.byLabel('New issue', page.section('backlog')), 'Enter');
    assert.equal(boardNow().issues.find((i) => i.title === 'Mow the lawn').sprintId, null);

    page.click(page.byLabel('Delete sprint', page.section('s2')));
    assert.deepEqual(boardNow().sprints, []);
    assert.deepEqual(boardNow().issues.map((i) => i.sprintId), [null, null, null]);
    assert.match(page.section('backlog').textContent, /Planned.*Weed the beds.*Mow the lawn/);
  } finally {
    await page.view.unmount();
  }
});

it('the board links to its backlog, and a scrum board with no sprint says where to start one', () => {
  open([project({ mode: 'scrum' })]);
  const t = boardText();
  assert.match(t, /Backlog/);
  assert.match(t, /No sprint is active, so every card is shown. Start one from the backlog./);
});

it('epics: listed on their own with their progress, never in a sprint or the backlog; added, renamed, deleted (children stay)', async () => {
  const issues = [
    issue('e1', 1, 'Garden makeover', 'c1', { type: 'epic' }),
    issue('i2', 2, 'Dig the beds', 'c3', { epicId: 'e1', resolvedAt: 1 }),
    issue('i3', 3, 'Plant roses', 'c1', { epicId: 'e1' }),
  ];
  open([project({ mode: 'scrum', issues, nextNumber: 4 })]);
  const page = await mountBacklog();
  globalThis.confirm = () => true;
  try {
    const epics = () => page.section('epics');
    assert.match(epics().textContent, /HOME-1Garden makeover1\/2 done/);
    assert.doesNotMatch(page.section('backlog').textContent, /Garden makeover/);
    assert.match(page.section('backlog').textContent, /Plant roses/);

    page.change(page.byLabel('New epic', epics()), 'Kitchen refit');
    page.click(page.button('Add', epics()));
    assert.equal(boardNow().issues.find((i) => i.title === 'Kitchen refit')?.type, 'epic');
    assert.doesNotMatch(page.section('backlog').textContent, /Kitchen refit/);

    page.click(page.button('Garden makeover', epics()));
    page.change(page.byLabel('Epic title', epics()), 'Garden redo');
    page.key(page.byLabel('Epic title', epics()), 'Enter');
    assert.equal(boardNow().issues.find((i) => i.id === 'e1').title, 'Garden redo');

    page.click(page.byLabel('Delete epic', epics()));
    assert.ok(!boardNow().issues.some((i) => i.id === 'e1'));
    assert.deepEqual(boardNow().issues.filter((i) => ['i2', 'i3'].includes(i.id)).map((i) => i.epicId), [null, null], 'its issues stay, in no epic');
  } finally {
    await page.view.unmount();
  }
});
