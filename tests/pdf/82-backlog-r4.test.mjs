// Round 4 board fixes (R4-BRD), pinned on the real components and the real board store, mounted
// with react-dom/client over tests/pdf/fake-dom.mjs through Vite's loader (tests/pdf/harness.mjs),
// as tests/pdf/82-backlog-page.test.mjs does:
//   R4-BRD-04  typing a year into an issue's Due date / Start date (Chrome reports '0002-09-26'
//              after the first digit) no longer wipes the field, nor clears a day already set; the
//              day lands once its year is whole.
//   R4-BRD-07  a backlog row released where no section is (the toolbar, far below) is over nothing,
//              so the drop moves nothing: the page asks boardCollision, not closestCenter.
//   R4-BRD-08  a Kanban project's backlog lists every open issue, including those still in a
//              sprint from when the project used sprints.
//   R4-BRD-10  the Epic panel's "Create epic" composer shows no Task/Story/Bug picker (it made
//              epics whatever was picked).
//   R4-BRD-13  the board's "Complete sprint" opens the backlog with the Complete-sprint dialog up
//              (?complete=1); closing or completing it drops the param, as does a backlog with no
//              sprint to complete.
// Run: node --test tests/pdf/82-backlog-r4.test.mjs
import { before, after, beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

let dom;
let harness;
let store;
let Backlog;
let Board;
let IssueDetails;
let CreateIssueDialog;
before(async () => {
  await setup();
  dom = await import('./fake-dom.mjs');
  harness = await import('../unit/ui-dom-harness.mjs');
  harness.patchFakeDom();
  store = await loadModule('/src/hooks/useBoardStore.js');
  ({ Backlog } = await loadModule('/src/pages/Backlog.jsx'));
  ({ Board } = await loadModule('/src/pages/Board.jsx'));
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

  it('the whole section is the drop target — header, rows, "Create issue" row — not its body alone, so a drop on the header still lands', async () => {
    open([project({ mode: 'scrum', sprints: [{ id: 's1', name: 'Sprint 1', goal: '', startDate: '', endDate: '', state: 'future', completedAt: null }] })]);
    const page = mountBacklog();
    try {
      for (const id of ['s1', 'backlog']) {
        const el = page.section(id);
        const fiber = el[Object.keys(el).find((k) => k.startsWith('__reactFiber$'))];
        assert.equal(typeof fiber.ref, 'function', `section ${id}: its <section> is the droppable's node (useDroppable's setNodeRef)`);
        assert.equal(fiber.return.memoizedProps.id, id, `section ${id}: rendered by the droppable section`);
        assert.equal(fiber.return.memoizedProps.sprintId, id === 'backlog' ? null : id);
      }
      // Folded, a section is its header alone: still a target.
      page.click(page.byLabel('Fold Sprint 1'));
      const folded = page.section('s1');
      assert.equal(typeof folded[Object.keys(folded).find((k) => k.startsWith('__reactFiber$'))].ref, 'function', 'a folded section is still a target');
    } finally { await page.view.unmount(); }
  });
});

describe('R4-BRD-08: a Kanban project plans in one backlog', () => {
  const sprints = [
    { id: 's0', name: 'Sprint 0', goal: '', startDate: '2026-08-01', endDate: '2026-08-15', state: 'closed', completedAt: 1 },
    { id: 's1', name: 'Sprint 1', goal: '', startDate: '2026-09-21', endDate: '2026-10-05', state: 'active', completedAt: null },
    { id: 's2', name: 'Sprint 2', goal: '', startDate: '', endDate: '', state: 'future', completedAt: null },
  ];
  const issues = [
    issue('i1', 1, 'Fix the tap', 'c1', { sprintId: 's1' }),
    issue('i2', 2, 'Paint the fence', 'c2', { sprintId: 's2' }),
    issue('i3', 3, 'Buy nails', 'c1', { sprintId: null }),
    issue('i4', 4, 'Sweep the yard', 'c3', { sprintId: 's1', resolvedAt: 1 }),
    issue('i5', 5, 'Oil the gate', 'c1', { sprintId: 's0' }),
  ];

  it('every open issue is listed, whatever sprint it was left in; a done one is not', async () => {
    open([project({ mode: 'kanban', sprints, issues, nextNumber: 6 })]);
    const page = mountBacklog();
    try {
      const backlog = page.section('backlog');
      assert.ok(backlog, 'the backlog section');
      for (const title of ['Fix the tap', 'Paint the fence', 'Buy nails', 'Oil the gate']) assert.ok(backlog.textContent.includes(title), `${title} is missing`);
      assert.ok(!backlog.textContent.includes('Sweep the yard'), 'resolved: out of the backlog');
      assert.match(backlog.textContent, /\(4 issues\)/);
      assert.ok(!page.section('s1') && !page.section('s2'), 'no sprint sections on a Kanban project');
    } finally { await page.view.unmount(); }
  });

  it('a row dragged within that backlog leaves its old sprint and takes its place', async () => {
    open([project({ mode: 'kanban', sprints, issues, nextNumber: 6 })]);
    const page = mountBacklog();
    try {
      const el = page.section('backlog');
      let fiber = el[Object.keys(el).find((k) => k.startsWith('__reactFiber$'))];
      while (fiber && typeof fiber.memoizedProps?.onDragEnd !== 'function') fiber = fiber.return;
      // 'Paint the fence' (left in Sprint 2) dropped on 'Fix the tap' (left in Sprint 1): both rows are the backlog's.
      page.view.act(() => fiber.memoizedProps.onDragEnd({ active: { id: 'i2' }, over: { id: 'i1', data: { current: { type: 'row', sprintId: null } } } }));
      assert.equal(issueNow('i2').sprintId, null);
      assert.match(page.section('backlog').textContent, /Paint the fence.*Fix the tap/);
    } finally { await page.view.unmount(); }
  });
});

describe('R4-BRD-10: the Epic panel\'s composer', () => {
  /** The type pickers under `node` (their button reads "Issue type: Task"). */
  const typePickers = (node) => [...dom.elements(node)].filter((el) => String(el.getAttribute('aria-label')).startsWith('Issue type'));

  it('"Create epic" shows no Task/Story/Bug picker; a section\'s "Create issue" still does', async () => {
    open([project({ mode: 'scrum' })]);
    const page = mountBacklog();
    try {
      page.click(page.button('Epic panel'));
      const panel = page.byLabel('Epics');
      page.click(page.button('Create epic', panel));
      assert.ok(page.byLabel('Summary of the new issue', panel), 'the composer is open');
      assert.equal(typePickers(panel).length, 0, 'a type picker in the Epic panel');

      const backlog = page.section('backlog');
      page.click(page.button('Create issue', backlog));
      assert.equal(typePickers(backlog).length, 1, 'the backlog\'s composer keeps its type picker');
    } finally { await page.view.unmount(); }
  });
});

describe('R4-BRD-13: the board\'s "Complete sprint" opens the dialog', () => {
  const active = { id: 's1', name: 'Sprint 1', goal: '', startDate: '2026-09-21', endDate: '2026-10-05', state: 'active', completedAt: null };
  const future = { id: 's2', name: 'Sprint 2', goal: '', startDate: '', endDate: '', state: 'future', completedAt: null };
  const issues = [issue('i1', 1, 'Fix the tap', 'c1', { sprintId: 's1' }), issue('i2', 2, 'Paint the fence', 'c3', { sprintId: 's1', resolvedAt: 1 })];
  const scrum = (extra = {}) => project({ mode: 'scrum', sprints: [active, future], issues, ...extra });

  it('the board\'s button links to the backlog with ?complete=1', () => {
    open([scrum()]);
    const html = renderToStaticMarkup(h(MemoryRouter, { initialEntries: ['/boards/p1'] }, h(Routes, null, h(Route, { path: '/boards/:id', element: h(Board) }))));
    const link = /<a[^>]*href="([^"]*)"[^>]*>(?:(?!<\/a>).)*Complete sprint/s.exec(html);
    assert.ok(link, 'the board shows "Complete sprint"');
    assert.equal(link[1], '/boards/p1/backlog?complete=1');
  });

  it('the backlog opens with the dialog for the active sprint; Cancel closes it and drops the param', async () => {
    open([scrum()]);
    const page = mountBacklog('/boards/p1/backlog?complete=1');
    try {
      assert.ok(page.dialog(), 'the Complete-sprint dialog is open');
      assert.match(page.dialog().textContent, /Complete Sprint 1/);
      assert.match(page.dialog().textContent, /1 completed issue and 1 open issue/);
      page.click(page.button('Cancel', page.dialog()));
      await tick(); await tick();
      assert.ok(!page.dialog(), 'the dialog closed');
      assert.equal(address, '', 'the param is dropped');
      assert.equal(boardNow().sprints[0].state, 'active', 'nothing completed');
    } finally { await page.view.unmount(); }
  });

  it('completing from it closes the sprint and drops the param', async () => {
    open([scrum()]);
    const page = mountBacklog('/boards/p1/backlog?complete=1');
    try {
      assert.ok(page.dialog(), 'the Complete-sprint dialog is open');
      page.click(page.button('Complete sprint', page.dialog()));
      await tick(); await tick();
      assert.equal(boardNow().sprints.find((s) => s.id === 's1').state, 'closed');
      assert.ok(!page.dialog(), 'the dialog closed');
      assert.equal(address, '');
    } finally { await page.view.unmount(); }
  });

  it('with no active sprint (or on a Kanban project) it is just the backlog, and the param is dropped', async () => {
    for (const [name, board] of [['no active sprint', scrum({ sprints: [future], issues: [] })], ['Kanban', scrum({ mode: 'kanban' })]]) {
      store._resetBoardStoreForTest();
      open([board]);
      const page = mountBacklog('/boards/p1/backlog?complete=1');
      try {
        assert.ok(!page.dialog(), `${name}: no dialog`);
        assert.ok(page.section('backlog'), `${name}: the backlog`);
        await tick(); await tick();
        assert.equal(address, '', `${name}: the param is dropped`);
      } finally { await page.view.unmount(); }
    }
  });
});
