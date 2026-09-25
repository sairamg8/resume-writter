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
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const view = dom.mount(() => routes('/boards/p1/backlog'), {});
  const ev = (extra = {}) => ({ stopPropagation() {}, preventDefault() {}, key: '', nativeEvent: {}, ...extra });
  // The whole document: menus and dialogs open in portals at the end of <body>.
  const all = (node = view.document.body) => [...dom.elements(node)];
  const dialog = () => all().find((el) => el.getAttribute('role') === 'dialog');
  return {
    view,
    text: () => view.document.body.textContent,
    section: (id) => all().find((el) => el.getAttribute('data-section') === id),
    dialog,
    button: (text, node) => all(node).find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text),
    byLabel: (label, node) => all(node).find((el) => el.getAttribute('aria-label') === label),
    /** The control a <label> names (TextField, Select), under `node`. */
    field: (label, node) => {
      const tag = all(node).find((el) => el.tagName === 'LABEL' && el.textContent.replace('*', '').trim() === label);
      return tag && all().find((el) => el.getAttribute('id') === tag.getAttribute('for'));
    },
    item: (label) => all().find((el) => String(el.getAttribute('role')).startsWith('menuitem') && el.textContent.trim() === label),
    click: (el) => view.act(() => dom.reactProps(el).onClick(ev())),
    change: (el, value) => view.act(() => dom.reactProps(el).onChange(ev({ target: { value } }))),
    key: (el, key) => view.act(() => dom.reactProps(el).onKeyDown(ev({ key }))),
  };
}

const boardNow = () => store.snapshot().boards.find((b) => b.id === 'p1');
const sprintOf = (id) => boardNow().issues.find((i) => i.id === id).sprintId;
const tick = async () => { for (let n = 0; n < 5; n += 1) await new Promise((r) => { setImmediate(r); }); await new Promise((r) => { setTimeout(r, 0); }); };

it('a Kanban project switches to sprints; a sprint is created, filled from row menus, started — and the board shows it', async () => {
  open([project()]);
  const page = await mountBacklog();
  try {
    assert.match(page.text(), /This project runs as Kanban/);
    assert.equal(page.button('Create sprint'), undefined, 'no sprints on a Kanban project');
    page.click(page.button('Use sprints'));
    assert.equal(boardNow().mode, 'scrum');

    page.click(page.button('Create sprint'));
    const [sprint] = boardNow().sprints;
    assert.equal(sprint.name, 'HOME Sprint 1');
    assert.equal(sprint.state, 'future');
    assert.ok(page.button('Start sprint', page.section(sprint.id)).getAttribute('disabled') !== null, 'an empty sprint cannot start');

    // Two issues from the backlog into the sprint, each from its row's menu.
    for (const key of ['HOME-1', 'HOME-2']) {
      page.click(page.byLabel(`${key} actions`));
      page.click(page.item('Move to'));
      page.click(page.item('HOME Sprint 1'));
    }
    assert.deepEqual([sprintOf('i1'), sprintOf('i2'), sprintOf('i3')], [sprint.id, sprint.id, null]);
    assert.match(page.section(sprint.id).textContent, /Fix the tap.*Paint the fence/);
    assert.match(page.section(sprint.id).textContent, /\(2 issues\)/);
    assert.doesNotMatch(page.section('backlog').textContent, /Fix the tap/);

    // Start it: today and two weeks on by default, a new name and a goal.
    page.click(page.button('Start sprint', page.section(sprint.id)));
    const form = page.dialog();
    assert.equal(page.field('Start date', form).value ?? page.field('Start date', form).getAttribute('value'), model.todayISO());
    page.change(page.field('Sprint name', form), 'Fence week');
    page.change(page.field('Sprint goal', form), 'The fence is done');
    page.click(page.button('Start', form));
    const started = boardNow().sprints[0];
    assert.equal(started.state, 'active');
    assert.equal(started.name, 'Fence week');
    assert.equal(started.goal, 'The fence is done');
    assert.equal(started.startDate, model.todayISO());
    assert.equal(started.endDate, model.addDays(model.todayISO(), 14));
    assert.match(page.section(sprint.id).textContent, /Active/);

    // The board now shows the sprint and only its issues.
    const t = boardText();
    assert.match(t, /Fence week · ends/);
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
  const issues = [issue('i1', 1, 'Open one', 'c1', { sprintId: 's1' }), issue('i2', 2, 'Done one', 'c3', { sprintId: 's1', resolvedAt: 1 }), issue('i3', 3, 'Later', 'c1', { sprintId: 's2' })];
  open([project({ mode: 'scrum', sprints, issues })]);
  const page = await mountBacklog();
  try {
    assert.ok(page.button('Start sprint', page.section('s2')).getAttribute('disabled') !== null, 'no second active sprint');
    page.click(page.button('Complete sprint', page.section('s1')));
    const dialog = page.dialog();
    assert.match(dialog.textContent, /1 completed issue and 1 open issue/);
    page.change(page.field('Move open issues to', dialog), 's2');
    page.click(page.button('Complete sprint', dialog));
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

it('a sprint is renamed in place and deleted (its issues go to the backlog); issues are created in a section', async () => {
  const sprints = [{ id: 's2', name: 'Sprint 2', goal: '', startDate: '', endDate: '', state: 'future', completedAt: null }];
  open([project({ mode: 'scrum', sprints, issues: [issue('i1', 1, 'Planned', 'c1', { sprintId: 's2' })] })]);
  const page = await mountBacklog();
  page.view.window.confirm = () => true;
  try {
    page.click(page.button('Sprint 2, edit Sprint name'));
    page.change(page.byLabel('Sprint name', page.section('s2')), 'Garden sprint');
    page.key(page.byLabel('Sprint name', page.section('s2')), 'Enter');
    assert.equal(boardNow().sprints[0].name, 'Garden sprint');

    const create = (sectionId, title) => {
      page.click(page.button('Create issue', page.section(sectionId)));
      const box = page.byLabel('Summary of the new issue', page.section(sectionId));
      page.change(box, title);
      page.key(box, 'Enter');
    };
    create('s2', 'Weed the beds');
    assert.equal(boardNow().issues.find((i) => i.title === 'Weed the beds').sprintId, 's2');
    create('backlog', 'Mow the lawn');
    assert.equal(boardNow().issues.find((i) => i.title === 'Mow the lawn').sprintId, null);

    page.click(page.byLabel('Garden sprint actions'));
    page.click(page.item('Delete sprint'));
    await tick();
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
  assert.match(t, /No sprint is active, so every issue is shown. Plan one in the backlog./);
});

it('epics: in the Epic panel with their progress, never in the backlog list; a click filters to its issues; new ones are made there', async () => {
  const issues = [
    issue('e1', 1, 'Garden makeover', 'c1', { type: 'epic' }),
    issue('i2', 2, 'Dig the beds', 'c3', { epicId: 'e1', resolvedAt: 1 }),
    issue('i3', 3, 'Plant roses', 'c1', { epicId: 'e1' }),
    issue('i4', 4, 'Fix the tap', 'c1'),
  ];
  open([project({ mode: 'scrum', issues, nextNumber: 5 })]);
  const page = await mountBacklog();
  try {
    assert.equal(page.byLabel('HOME-1 Garden makeover', page.section('backlog')), undefined, 'the epic has no row of its own');
    assert.match(page.section('backlog').textContent, /Plant roses.*Garden makeover.*Fix the tap/, 'its child names it in a lozenge');
    page.click(page.button('Epic panel'));
    const panel = () => page.byLabel('Epics');
    assert.match(panel().textContent, /Garden makeover.*HOME-1.*1 of 2 issues done/);

    page.click(page.button('Garden makeover', panel()));
    assert.match(page.section('backlog').textContent, /Plant roses/);
    assert.doesNotMatch(page.section('backlog').textContent, /Fix the tap/, 'only the epic\'s issues');
    page.click(page.button('Garden makeover', panel()));
    assert.match(page.section('backlog').textContent, /Fix the tap/, 'a second click shows all again');

    page.click(page.button('Create epic', panel()));
    const box = page.byLabel('Summary of the new issue', panel());
    page.change(box, 'Kitchen refit');
    page.key(box, 'Enter');
    assert.equal(boardNow().issues.find((i) => i.title === 'Kitchen refit')?.type, 'epic');
    assert.equal(page.byLabel('HOME-5 Kitchen refit', page.section('backlog')), undefined);
  } finally {
    await page.view.unmount();
  }
});
