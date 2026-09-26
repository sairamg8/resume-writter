// Round 4 board fixes (R4-BRD), pinned on the real components and the real board store, mounted
// with react-dom/client over tests/pdf/fake-dom.mjs through Vite's loader (tests/pdf/harness.mjs),
// as tests/pdf/82-backlog-page.test.mjs does:
//   R4-BRD-04  typing a year into an issue's Due date / Start date (Chrome reports '0002-09-26'
//              after the first digit) no longer wipes the field, nor clears a day already set; the
//              day lands once its year is whole.
//   R4-BRD-07  a backlog row released where no section is (the toolbar, far below) is over nothing,
//              so the drop moves nothing: the page asks boardCollision, not closestCenter.
// Run: node --test tests/pdf/82-backlog-r4.test.mjs
import { before, after, beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, Fragment } from 'react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

let dom;
let harness;
let store;
let Backlog;
let IssueDetails;
let CreateIssueDialog;
before(async () => {
  await setup();
  dom = await import('./fake-dom.mjs');
  harness = await import('../unit/ui-dom-harness.mjs');
  harness.patchFakeDom();
  store = await loadModule('/src/hooks/useBoardStore.js');
  ({ Backlog } = await loadModule('/src/pages/Backlog.jsx'));
  ({ IssueDetails } = await loadModule('/src/components/board/IssueDetails.jsx'));
  ({ CreateIssueDialog } = await loadModule('/src/components/board/CreateIssueDialog.jsx'));
});
after(teardown);

const KEY = 'cpwtcv_boards_v2';

/** localStorage, in memory. */
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
const issue = (id, number, title, columnId, extra = {}) => ({ id, number, type: 'task', title, columnId, labelIds: [], checklist: [], ...extra });
const project = (extra = {}) => ({
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1', mode: 'kanban',
  columns: [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')],
  labels: [], sprints: [],
  issues: [issue('i1', 1, 'Fix the tap', 'c1'), issue('i2', 2, 'Paint the fence', 'c2'), issue('i3', 3, 'Buy nails', 'c1')],
  nextNumber: 4,
  ...extra,
});

/** Storage holding `boards`, and the store loaded from it (as the first page to subscribe does). */
function open(boards) {
  globalThis.localStorage = new Storage([[KEY, JSON.stringify({ boards, dataVersion: 2 })]]);
  store.subscribe(() => {});
}
const boardNow = () => store.snapshot().boards.find((b) => b.id === 'p1');
const issueNow = (id) => boardNow().issues.find((i) => i.id === id);

/** The elements of the whole page (dialogs and menus open in portals at the end of <body>). */
const all = (view) => [...dom.elements(view.document.body)];
const input = (view, label) => all(view).find((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === label);

/** The address the page last rendered with (its ?search), as the probe beside it saw it. */
let address = '';
function Probe() {
  address = useLocation().search;
  return null;
}

/** The real Backlog page at `path`, with the few finders and clicks the tests need. */
function mountBacklog(path = '/boards/p1/backlog') {
  const Page = () => h(MemoryRouter, { initialEntries: [path] },
    h(Routes, null, h(Route, { path: '/boards/:id/backlog', element: h(Fragment, null, h(Backlog), h(Probe)) })));
  const view = dom.mount(Page, {});
  return {
    view,
    section: (id) => all(view).find((el) => el.getAttribute('data-section') === id),
    dialog: () => all(view).find((el) => el.getAttribute('role') === 'dialog'),
    button: (text, node = view.document.body) => [...dom.elements(node)].find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text),
    byLabel: (label, node = view.document.body) => [...dom.elements(node)].find((el) => el.getAttribute('aria-label') === label),
    click: (el) => view.act(() => dom.reactProps(el).onClick(harness.ev())),
  };
}

/** Lets the router's navigations (committed in a transition) and passive effects run. */
const tick = async () => { for (let n = 0; n < 5; n += 1) await new Promise((r) => { setImmediate(r); }); await new Promise((r) => { setTimeout(r, 0); }); };

describe('R4-BRD-04: typing a year into a date field', () => {
  /** The issue view's Details box for `issueId`, every change sent to the store as IssueDialog does. */
  function details(issueId = 'i1') {
    const Details = ({ id }) => {
      const s = store.useBoardStore();
      const board = s.boards.find((b) => b.id === 'p1');
      const it = board.issues.find((i) => i.id === id);
      return h(MemoryRouter, null, h(IssueDetails, { board, issue: it, onChange: (patch) => s.updateIssue('p1', id, patch) }));
    };
    const view = dom.mount(Details, { id: issueId });
    return {
      view,
      field: (label) => input(view, label),
      /** What the field shows (its controlled value). */
      shown: (label) => dom.reactProps(input(view, label)).value,
      /** One keystroke as Chrome reports it: the field's whole value so far. */
      type: (label, value) => view.act(() => dom.reactProps(input(view, label)).onChange(harness.ev({ target: { value } }))),
      blur: (label) => view.act(() => dom.reactProps(input(view, label)).onBlur?.(harness.ev())),
    };
  }
  /** Chrome's reports while "2026" is typed into the year of 09/26. */
  const YEAR_KEYS = ['0002-09-26', '0020-09-26', '0202-09-26'];

  it('Due date, empty: the half-typed year stays in the field, and the day lands when the year is whole', async () => {
    open([project()]);
    const d = details();
    try {
      for (const v of YEAR_KEYS) {
        d.type('Due date', v);
        assert.equal(d.shown('Due date'), v, `after ${v} the field was wiped`);
        assert.ok(!issueNow('i1').due, `the store took ${v}`);
      }
      d.type('Due date', '2026-09-26');
      assert.equal(issueNow('i1').due, '2026-09-26');
      assert.equal(d.shown('Due date'), '2026-09-26');
    } finally { await d.view.unmount(); }
  });

  it('Start date already set: retyping its year never clears it, and the new year lands', async () => {
    open([project({ issues: [issue('i1', 1, 'Fix the tap', 'c1', { startDate: '2025-09-26' })] })]);
    const d = details();
    try {
      for (const v of YEAR_KEYS) {
        d.type('Start date', v);
        assert.equal(issueNow('i1').startDate, '2025-09-26', `${v} cleared the start date`);
        assert.equal(d.shown('Start date'), v);
      }
      d.type('Start date', '2026-09-26');
      assert.equal(issueNow('i1').startDate, '2026-09-26');
    } finally { await d.view.unmount(); }
  });

  it('leaving the field with half a year typed puts the saved day back; clearing it still clears', async () => {
    open([project({ issues: [issue('i1', 1, 'Fix the tap', 'c1', { due: '2026-10-01' })] })]);
    const d = details();
    try {
      d.type('Due date', '0002-10-01');
      assert.equal(d.shown('Due date'), '0002-10-01');
      d.blur('Due date');
      assert.equal(d.shown('Due date'), '2026-10-01');
      assert.equal(issueNow('i1').due, '2026-10-01');
      d.type('Due date', '');
      assert.equal(issueNow('i1').due, '');
      assert.equal(d.shown('Due date'), '');
    } finally { await d.view.unmount(); }
  });

  it('a day changed from outside (another issue, an undo) replaces what was being typed', async () => {
    open([project({ issues: [issue('i1', 1, 'Fix the tap', 'c1', { due: '2026-10-01' }), issue('i2', 2, 'Paint the fence', 'c1', { due: '2026-12-24' })] })]);
    const d = details();
    try {
      d.type('Due date', '0002-10-01');
      d.view.act(() => store.boardActions.updateIssue('p1', 'i1', { due: '2026-11-05' }));
      assert.equal(d.shown('Due date'), '2026-11-05');
      d.type('Due date', '0002-11-05');
      d.view.update({ id: 'i2' });
      assert.equal(d.shown('Due date'), '2026-12-24', 'the other issue\'s day');
    } finally { await d.view.unmount(); }
  });

  // The dialog kept every keystroke in its own draft, so it never wiped the field; it shares
  // DateInput, and this pins that it still shows the half-typed year and takes the whole day.
  it('the Create issue dialog\'s Due date shows a half-typed year and takes the whole day', async () => {
    open([project()]);
    const view = dom.mount(() => h(MemoryRouter, null, h(CreateIssueDialog, { open: true, defaults: { boardId: 'p1' }, onClose: () => {} })), {});
    try {
      const type = (value) => view.act(() => dom.reactProps(input(view, 'Due date')).onChange(harness.ev({ target: { value } })));
      type('0002-09-26');
      assert.equal(dom.reactProps(input(view, 'Due date')).value, '0002-09-26', 'the field was wiped');
      type('2026-09-26');
      assert.equal(dom.reactProps(input(view, 'Due date')).value, '2026-09-26');
    } finally { await view.unmount(); }
  });
});

describe('R4-BRD-07: a backlog drag can be called off', () => {
  /** The collision detection the page hands its DndContext, read off the rendered tree. */
  function collisionOf(page) {
    const el = page.section('backlog');
    const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'));
    let fiber = el[key];
    while (fiber && typeof fiber.memoizedProps?.collisionDetection !== 'function') fiber = fiber.return;
    assert.ok(fiber, 'the backlog is inside a DndContext');
    return fiber.memoizedProps.collisionDetection;
  }
  const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
  // The backlog's body (y 320–380) holding one row; the toolbar is above it, at y 90.
  const LAYOUT = [['section:backlog', 'section', box(328, 320, 920, 60)], ['i1', 'row', box(328, 320, 920, 40)], ['i3', 'row', box(328, 400, 920, 40)]];
  const args = (x, y) => ({
    active: { id: 'i3' },
    collisionRect: box(x - 460, y - 20, 920, 40),
    droppableContainers: LAYOUT.map(([id, type]) => ({ id, data: { current: { type } } })),
    droppableRects: new Map(LAYOUT.map(([id, , rect]) => [id, rect])),
    pointerCoordinates: { x, y },
  });

  it('released over the toolbar (no section under the pointer) the row is over nothing, so onDragEnd moves nothing', async () => {
    open([project()]);
    const page = mountBacklog();
    try {
      const detect = collisionOf(page);
      assert.deepEqual(detect(args(600, 90)), [], 'the toolbar');
      assert.deepEqual(detect(args(600, 900)), [], 'far below the last section');
      // Over a row: that row first (a drop there takes its place), then its section.
      assert.deepEqual(detect(args(700, 340)).map((c) => c.id), ['i1', 'section:backlog']);
    } finally { await page.view.unmount(); }
  });
});
