// "Your work" (/work), which was a placeholder: nothing gathered what is overdue, due or in progress
// across the projects. Here the real page, the real board page and the real board store are mounted
// with react-dom/client (tests/pdf/fake-dom.mjs, through Vite's loader): the sections hold the right
// issues from every project (epics left out, as on the board), a row marks its issue done, and a row
// opens its issue in place — `?issue=KEY-N` opens the issue view, and closing it drops the parameter.
import { before, after, beforeEach, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

const KEY = 'cpwtcv_boards_v2';

let YourWork;
let Board;
let store;
let model;
before(async () => {
  await setup();
  ({ YourWork } = await loadModule('/src/pages/YourWork.jsx'));
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
afterEach(() => { delete globalThis.localStorage; });

const col = (id, title, category = 'todo') => ({ id, title, category, wipLimit: null });
const issue = (id, number, title, columnId, extra = {}) => ({ id, number, type: 'task', title, columnId, labelIds: [], checklist: [], updatedAt: number, ...extra });
const columns = [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')];
const project = (id, key, title, issues) => ({ id, key, title, color: '#6366f1', mode: 'kanban', columns, labels: [], sprints: [], issues, nextNumber: issues.length + 1 });

/** The address the router is at, for the test to read. */
let where = '';
function Where() {
  const l = useLocation();
  where = `${l.pathname}${l.search}`;
  return null;
}

async function mountAt(path, boards) {
  globalThis.localStorage = new Storage([[KEY, JSON.stringify({ boards, dataVersion: 2 })]]);
  store.subscribe(() => {});
  const dom = await import('./fake-dom.mjs');
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom(); // the issue view's focus trap and menus query the document
  const view = dom.mount(() => createElement(MemoryRouter, { initialEntries: [path] },
    createElement(Where),
    createElement(Routes, null,
      createElement(Route, { path: '/work', element: createElement(YourWork) }),
      createElement(Route, { path: '/boards/:id', element: createElement(Board) }))), {});
  const ev = { stopPropagation() {}, preventDefault() {}, key: '' };
  // The whole document: the issue view opens in a portal at the end of <body>.
  const all = (node = view.document.body) => [...dom.elements(node)];
  return {
    view,
    text: () => view.document.body.textContent,
    dialog: (label) => all().find((el) => el.getAttribute('role') === 'dialog' && (!label || el.getAttribute('aria-label') === label)),
    button: (text) => all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text),
    section: (id) => all().find((el) => el.getAttribute('data-section') === id),
    rows: (id) => all(all().find((el) => el.getAttribute('data-section') === id)).filter((el) => el.tagName === 'LI').map((el) => el.getAttribute('data-issue')),
    byLabel: (label, node) => all(node).find((el) => el.getAttribute('aria-label') === label),
    row: (id) => all().find((el) => el.tagName === 'LI' && el.getAttribute('data-issue') === id),
    click: (el) => view.act(() => dom.reactProps(el).onClick(ev)),
    props: (el) => dom.reactProps(el),
  };
}

/** The router's navigation is a transition: wait (a second at most) until `done()` holds. */
async function settle(done) {
  for (let n = 0; n < 100 && !done(); n += 1) await new Promise((r) => { setTimeout(r, 10); });
}

function sample() {
  const today = model.todayISO();
  return [
    project('p1', 'HOME', 'Home jobs', [
      issue('late', 1, 'Pay the gas bill', 'c1', { due: model.addDays(today, -3) }),
      issue('now', 2, 'Call the plumber', 'c1', { due: today }),
      issue('soon', 3, 'Book the MOT', 'c1', { due: model.addDays(today, 4) }),
      issue('epic', 4, 'Garden makeover', 'c2', { type: 'epic', due: model.addDays(today, -1) }),
      issue('fin', 5, 'Fix the tap', 'c3', { due: model.addDays(today, -9), resolvedAt: 1 }),
    ]),
    project('p2', 'WORK', 'Side work', [
      issue('wip', 1, 'Draft the proposal', 'c2'),
      issue('later', 2, 'Tidy the files', 'c1', { due: model.addDays(today, 30) }),
    ]),
  ];
}

it('overdue, due today, this week and in progress, across every project — epics and done issues left out', async () => {
  const page = await mountAt('/work', sample());
  try {
    assert.deepEqual(page.rows('overdue'), ['late']);
    assert.deepEqual(page.rows('today'), ['now']);
    assert.deepEqual(page.rows('week'), ['soon']);
    assert.deepEqual(page.rows('inProgress'), ['wip']);
    assert.match(page.section('overdue').textContent, /Pay the gas billHOME-1 · Home jobs/);
    assert.match(page.section('inProgress').textContent, /Draft the proposalWORK-1 · Side work/);
    assert.match(page.text(), /4 issues need attention across 2 projects/);
    page.click(page.button('Worked on'));
    assert.ok(page.rows('recent').length > 0);
    assert.ok(!page.rows('recent').includes('epic'), 'an epic is not work of its own');
  } finally {
    await page.view.unmount();
  }
});

it('a row marks its issue done: into its project\'s done column, off the sections', async () => {
  const page = await mountAt('/work', sample());
  try {
    page.click(page.byLabel('Mark HOME-1 done'));
    const late = store.snapshot().boards[0].issues.find((i) => i.id === 'late');
    assert.equal(late.columnId, 'c3');
    assert.ok(late.resolvedAt);
    assert.equal(page.section('overdue'), undefined);
    assert.equal(page.byLabel('Mark HOME-1 done'), undefined, 'done: nothing to mark');
  } finally {
    await page.view.unmount();
  }
});

it('a row opens its issue in place, over Your work; closing it drops ?issue=', async () => {
  const page = await mountAt('/work', sample());
  try {
    page.click(page.row('soon').childNodes[0]);
    await settle(() => page.dialog());
    assert.equal(where, '/work?issue=HOME-3');
    assert.ok(page.dialog('HOME-3 Book the MOT'), 'the issue view, named by key and summary');
    assert.match(page.dialog().textContent, /Book the MOT/);
    page.click(page.byLabel('Close', page.dialog()));
    await settle(() => where === '/work');
    assert.equal(where, '/work');
    assert.equal(page.dialog(), undefined);
  } finally {
    await page.view.unmount();
  }
});

it('?issue= opens a card that is off the board too (a done one past hideDoneAfterDays); a key of another project opens nothing', async () => {
  let page = await mountAt('/boards/p1?issue=HOME-5', sample());
  try {
    assert.ok(page.dialog('HOME-5 Fix the tap'), 'the old done issue opens');
    assert.ok(page.byLabel('Status: Done', page.dialog()), 'in Done');
  } finally {
    await page.view.unmount();
  }
  store._resetBoardStoreForTest();
  page = await mountAt('/boards/p1?issue=WORK-1', sample());
  try {
    assert.equal(page.dialog(), undefined);
  } finally {
    await page.view.unmount();
  }
});

it('with no issues anywhere: a note and the way to the projects', async () => {
  const page = await mountAt('/work', [project('p1', 'HOME', 'Home jobs', [])]);
  try {
    assert.match(page.text(), /Nothing overdue, due this week or in progress/);
    assert.match(page.text(), /View all projects/);
  } finally {
    await page.view.unmount();
  }
});
