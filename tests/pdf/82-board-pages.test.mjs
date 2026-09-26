// The two board pages over the board store v2 (R2-037, R2-041, R2-155) — in the tracker look since
// the revamp: status columns of cards, a card menu, the issue view at ?issue=KEY. The store and its
// normaliser were rewritten for v2 projects (columns and issues) while /boards and /boards/:id
// still read v1 boards (lists of cards): `b.lists.reduce` threw on every saved board, so the
// ErrorBoundary replaced both pages on every visit — the v1 list with no cards of R2-041
// included. And the board page never said when a change could not be saved (R2-037): the grid
// did, the page where edits are made did not — nor, after the revamp, did a project's Summary,
// Timeline and Calendar, where the issue view opens too; they carry the board's notice now
// (BoardStorageNotice), as the List did. Here the real pages and the real store are rendered
// through Vite's loader (tests/pdf/harness.mjs) with react-dom/server, over a localStorage
// stand-in that can be made full.
import { before, after, beforeEach, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

const KEY = 'cpwtcv_boards_v2';
const V1_KEY = 'cpwtcv_boards_v1';

let Boards;
let Board;
/** A project's other views that edit or open its issues, by their path under /boards/:id. */
let views;
let store;
before(async () => {
  await setup();
  ({ Boards } = await loadModule('/src/pages/Boards.jsx'));
  ({ Board } = await loadModule('/src/pages/Board.jsx'));
  views = {
    summary: (await loadModule('/src/pages/ProjectSummary.jsx')).ProjectSummary,
    timeline: (await loadModule('/src/pages/ProjectTimeline.jsx')).ProjectTimeline,
    calendar: (await loadModule('/src/pages/ProjectCalendar.jsx')).ProjectCalendar,
    list: (await loadModule('/src/pages/ProjectList.jsx')).ProjectList,
  };
  store = await loadModule('/src/hooks/useBoardStore.js');
  const { BOARDS_KEY } = await loadModule('/src/constants/boards.js');
  assert.equal(BOARDS_KEY, KEY);
});
after(teardown);

/** localStorage that throws the browser's quota error on every write once `full` is set. */
class Storage {
  constructor(entries = []) { this.map = new Map(entries); this.full = false; }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) {
    if (this.full) throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
    this.map.set(k, String(v));
  }
  removeItem(k) { this.map.delete(k); }
}

beforeEach(() => { store._resetBoardStoreForTest(); });
afterEach(() => { delete globalThis.localStorage; });

/** Storage holding `entries`, and the store loaded from it (as the first page to subscribe does). */
function open(entries) {
  globalThis.localStorage = new Storage(entries);
  store.subscribe(() => {});
  return globalThis.localStorage;
}

/** The markup the app's routes give `path`. */
function page(path) {
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] },
    createElement(Routes, null,
      createElement(Route, { path: '/boards', element: createElement(Boards) }),
      createElement(Route, { path: '/boards/:id', element: createElement(Board) }),
      ...Object.entries(views).map(([view, View]) => createElement(Route, { key: view, path: `/boards/:id/${view}`, element: createElement(View) })))));
}

/** The visible text of `html`, tags dropped and entities decoded. */
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

const col = (id, title, category = 'todo') => ({ id, title, category, wipLimit: null });
const issue = (id, number, title, columnId, extra = {}) => ({ id, number, type: 'task', title, columnId, labelIds: [], checklist: [], ...extra });
const project = (extra = {}) => ({
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1',
  columns: [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')],
  labels: [{ id: 'l1', name: 'Urgent', color: '#ef4444' }],
  sprints: [],
  issues: [
    issue('i1', 1, 'Fix the tap', 'c1', { labelIds: ['l1'], due: '2030-01-02' }),
    issue('i2', 2, 'Paint the fence', 'c2'),
    issue('i3', 3, 'Buy nails', 'c1', { checklist: [{ id: 'k1', text: 'Box of 100', done: true }, { id: 'k2', text: 'Hammer', done: false }] }),
  ],
  nextNumber: 4,
  ...extra,
});
const saved = (boards) => [KEY, JSON.stringify({ boards, dataVersion: 2 })];

it('/boards lists every project with its key, type and issue counts (the first-run demo included)', () => {
  open([]);
  const demo = store.snapshot().boards;
  assert.ok(demo.length > 0);
  const html = text(page('/boards'));
  for (const b of demo) {
    assert.match(html, new RegExp(b.title));
    assert.match(html, new RegExp(`${b.key} (Kanban|Scrum)`));
    assert.match(html, new RegExp(`\\d+ open · ${b.issues.length} total`));
  }
});

it('/boards/:id shows each status column with its issues in rank order: keys, labels, due dates and checklists', () => {
  open([saved([project()])]);
  const html = page('/boards/p1');
  assert.match(text(html), /Home jobs/);
  // Each column (data-column="…"), in order, with its own cards in rank order and their count.
  const columns = html.split('data-column="').slice(1).map((c) => text(`<${c}`));
  assert.equal(columns.length, 3);
  assert.match(columns[0], /^ To Do 2 .*Fix the tap .*HOME-1 .*Buy nails .*HOME-3/);
  assert.match(columns[1], /^ Doing 1 .*Paint the fence .*HOME-2/);
  assert.match(columns[2], /^ Done 0 /);
  assert.doesNotMatch(columns[2], /Fix the tap|Buy nails|Paint the fence/);
  const t = text(html);
  assert.match(t, /Jan 2, 2030/, 'the due date');
  assert.match(t, /1\/2/, 'the checklist\'s progress');
  assert.match(html, /title="Urgent"/, 'the label, by the board\'s own label');
  assert.match(html, /aria-label="Medium priority"/, 'each card names its priority');
});

it('R2-041: a v1 list with no cards array opens on both pages, as an empty column', () => {
  open([[V1_KEY, JSON.stringify({ boards: [{ id: 'b', title: 'B', lists: [{ id: 'l', title: 'x' }] }], dataVersion: 1 })]]);
  assert.match(text(page('/boards')), /B .*0 open · 0 total/);
  const html = page('/boards/b');
  assert.match(text(html), /\bx 0\b/);
  assert.match(html, /aria-label="Add column"/);
});

it('R2-037: the board page says when changes are not being saved, as the grid does', () => {
  const storage = open([saved([project()])]);
  assert.doesNotMatch(text(page('/boards/p1')), /not being saved/);
  storage.full = true;
  assert.ok(store.boardActions.addIssue('p1', { title: 'Lost on reload', columnId: 'c1' }));
  const t = text(page('/boards/p1'));
  assert.match(t, /Lost on reload/);
  assert.match(t, /Changes are not being saved: browser storage is full/);
  assert.match(page('/boards/p1'), /role="alert"/);
  assert.match(text(page('/boards')), /Changes are not being saved: browser storage is full/);
});

it('R2-037: the board page shows the recovery notice for a saved list that could not be read in full', () => {
  open([saved([project({ issues: [issue('i1', 1, 'Kept', 'c1'), 42] })])]);
  assert.ok(store.snapshot().recovery);
  const t = text(page('/boards/p1'));
  assert.match(t, /Kept/);
  assert.match(t, /Your saved board list could not be read in full/);
});

it('R2-037: the Summary, Timeline, Calendar and List say when changes are not being saved, as the board does', () => {
  const storage = open([saved([project()])]);
  for (const view of Object.keys(views)) assert.doesNotMatch(text(page(`/boards/p1/${view}`)), /not being saved/, view);
  storage.full = true;
  assert.ok(store.boardActions.addIssue('p1', { title: 'Lost on reload', columnId: 'c1' }));
  for (const view of Object.keys(views)) {
    const html = page(`/boards/p1/${view}`);
    assert.match(text(html), /Changes are not being saved: browser storage is full/, view);
    assert.match(html, /role="alert"/, view);
  }
});

it('R2-037: the Summary, Timeline, Calendar and List show the recovery notice, as the board does', () => {
  open([saved([project({ issues: [issue('i1', 1, 'Kept', 'c1'), 42] })])]);
  assert.ok(store.snapshot().recovery);
  for (const view of Object.keys(views)) assert.match(text(page(`/boards/p1/${view}`)), /Your saved board list could not be read in full/, view);
});

it('a project that does not exist says so, with the way back', () => {
  open([saved([project()])]);
  const html = page('/boards/nope');
  assert.match(text(html), /This project doesn.t exist/);
  assert.match(html, /href="\/boards"/);
});

/** The board page mounted with react-dom/client (tests/pdf/fake-dom.mjs), its handlers called as clicks. */
async function mountBoard(path) {
  const dom = await import('./fake-dom.mjs');
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const Page = () => createElement(MemoryRouter, { initialEntries: [path] },
    createElement(Routes, null, createElement(Route, { path: '/boards/:id', element: createElement(Board) })));
  const view = dom.mount(Page, {});
  const ev = (extra = {}) => ({ stopPropagation() {}, preventDefault() {}, key: '', nativeEvent: {}, ...extra });
  // The whole document: menus and the issue view open in portals at the end of <body>.
  const all = () => [...dom.elements(view.document.body)];
  const labelled = (label) => (el) => el.getAttribute('aria-label') === label || el.getAttribute('title') === label;
  return {
    view,
    text: () => view.document.body.textContent,
    /** The column `id` (its section, data-column="…"). */
    column: (id) => all().find((el) => el.getAttribute('data-column') === id),
    byLabel: (label, node) => (node ? [...dom.elements(node)] : all()).find(labelled(label)),
    button: (label, node) => (node ? [...dom.elements(node)] : all()).find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === label),
    item: (label) => all().find((el) => String(el.getAttribute('role')).startsWith('menuitem') && el.textContent.trim() === label),
    click: (el) => view.act(() => dom.reactProps(el).onClick(ev())),
    type: (el, value) => view.act(() => dom.reactProps(el).onChange(ev({ target: { value } }))),
    key: (el, key) => view.act(() => dom.reactProps(el).onKeyDown(ev({ key }))),
  };
}

const boardNow = () => store.snapshot().boards.find((b) => b.id === 'p1');
const tick = async () => { for (let n = 0; n < 5; n += 1) await new Promise((r) => { setImmediate(r); }); await new Promise((r) => { setTimeout(r, 0); }); };

it('a column creates an issue in place: Enter adds it to that column and keeps the composer open for the next', async () => {
  open([saved([project()])]);
  const page = await mountBoard('/boards/p1');
  try {
    page.click(page.button('Create issue', page.column('c2')));
    const field = () => page.byLabel('Summary of the new issue', page.column('c2'));
    page.type(field(), 'Oil the gate');
    page.key(field(), 'Enter');
    const added = boardNow().issues.find((i) => i.title === 'Oil the gate');
    assert.equal(added?.columnId, 'c2');
    assert.equal(added.type, 'task');
    assert.match(page.column('c2').textContent, /Oil the gate/);
    assert.ok(field(), 'the composer stays open');
  } finally {
    await page.view.unmount();
  }
});

it('deleting a column asks first and moves its issues to the column beside it — none lost; an empty one goes without a question', async () => {
  open([saved([project()])]);
  const page = await mountBoard('/boards/p1');
  const asked = [];
  page.view.window.confirm = (q) => { asked.push(q); return true; };
  try {
    page.click(page.byLabel('Done column actions'));
    page.click(page.item('Delete column'));
    await tick();
    assert.deepEqual(asked, [], 'an empty column: no question');
    assert.deepEqual(boardNow().columns.map((c) => c.id), ['c1', 'c2']);

    page.click(page.byLabel('To Do column actions'));
    page.click(page.item('Delete column'));
    await tick();
    assert.deepEqual(asked, ['Delete the To Do column?']);
    const after = boardNow();
    assert.deepEqual(after.columns.map((c) => c.title), ['Doing']);
    assert.deepEqual(after.issues.filter((i) => i.columnId === 'c2').map((i) => i.title).sort(), ['Buy nails', 'Fix the tap', 'Paint the fence']);
  } finally {
    await page.view.unmount();
  }
});

it('a card\'s menu moves it to another status and changes its priority, without a drag', async () => {
  open([saved([project()])]);
  const page = await mountBoard('/boards/p1');
  try {
    const card = () => page.byLabel('HOME-1 Fix the tap');
    page.click(page.byLabel('Card actions', card()));
    page.click(page.item('Move to'));
    page.click(page.item('Done'));
    const moved = boardNow().issues.find((i) => i.id === 'i1');
    assert.equal(moved.columnId, 'c3');
    assert.ok(moved.resolvedAt, 'moved to a done column: resolved');
    page.click(page.byLabel('Card actions', card()));
    page.click(page.item('Priority'));
    page.click(page.item('Highest'));
    assert.equal(boardNow().issues.find((i) => i.id === 'i1').priority, 'highest');
  } finally {
    await page.view.unmount();
  }
});

it('?issue=KEY opens the issue view: its summary is renamed in place (trimmed, never blank), its status set from the status button', async () => {
  open([saved([project()])]);
  const page = await mountBoard('/boards/p1?issue=HOME-2');
  try {
    assert.ok(page.byLabel('HOME-2 Paint the fence'), 'the dialog, named by key and summary');
    assert.match(page.text(), /Details/);
    page.click(page.button('Paint the fence, edit Summary'));
    const field = () => page.byLabel('Summary');
    page.type(field(), '  Paint the fence white ');
    page.key(field(), 'Enter');
    assert.equal(boardNow().issues.find((i) => i.id === 'i2').title, 'Paint the fence white');
    page.click(page.button('Paint the fence white, edit Summary'));
    page.type(field(), '   ');
    page.key(field(), 'Enter');
    assert.equal(boardNow().issues.find((i) => i.id === 'i2').title, 'Paint the fence white', 'a blank summary is never saved');

    page.click(page.byLabel('Status: Doing'));
    page.click(page.item('Done'));
    assert.equal(boardNow().issues.find((i) => i.id === 'i2').columnId, 'c3');
  } finally {
    await page.view.unmount();
  }
});

it('the board shows what it should: a WIP count, done cards past hideDoneAfterDays hidden and said so, a scrum board its active sprint', () => {
  const day = 24 * 60 * 60 * 1000;
  const done = (id, number, title, daysAgo) => issue(id, number, title, 'c3', { resolvedAt: Date.now() - daysAgo * day });
  open([saved([project({
    columns: [col('c1', 'To Do'), { ...col('c2', 'Doing', 'inprogress'), wipLimit: 1 }, col('c3', 'Done', 'done')],
    issues: [...project().issues, issue('i6', 6, 'Stain the deck', 'c2'), done('i4', 4, 'Old chore', 30), done('i5', 5, 'Fresh chore', 1)],
    hideDoneAfterDays: 14,
  })])]);
  let html = page('/boards/p1');
  const columns = html.split('data-column="').slice(1).map((c) => text(`<${c}`));
  assert.match(columns[1], /^ Doing 2\/1 /, 'the WIP count');
  assert.match(html, /bg-\[#ffd5d2\][^"]*"[^>]*>2\/1/, 'over its limit: red');
  assert.match(columns[2], /Fresh chore/);
  assert.doesNotMatch(html, /Old chore/);
  assert.match(text(html), /1 done issue is hidden: resolved more than 14 days ago/);

  store._resetBoardStoreForTest();
  const sprints = [{ id: 's1', name: 'Sprint 1', goal: '', startDate: '2026-09-21', endDate: '2026-10-05', state: 'active' }];
  open([saved([project({ mode: 'scrum', sprints, issues: project().issues.map((i) => (i.id === 'i2' ? { ...i, sprintId: 's1' } : i)) })])]);
  html = text(page('/boards/p1'));
  assert.match(html, /Sprint 1 · ends 2026-10-05/);
  assert.match(html, /Paint the fence/);
  assert.doesNotMatch(html, /Fix the tap|Buy nails/, 'not in the sprint: off the board');
  assert.ok(store.boardActions.addIssue('p1', { title: 'Sand the fence', columnId: 'c1', sprintId: 's1' }));
  assert.match(text(page('/boards/p1')), /Sand the fence/);

  store._resetBoardStoreForTest();
  open([saved([project({ mode: 'scrum' })])]);
  html = text(page('/boards/p1'));
  assert.match(html, /No sprint is active, so every issue is shown/);
  assert.match(html, /Fix the tap.*Buy nails.*Paint the fence/);
});

it('epics: not cards on the board; a child card names its epic in its lozenge', () => {
  open([saved([project({
    issues: [
      issue('e1', 9, 'Garden makeover', 'c1', { type: 'epic' }),
      ...project().issues.map((i) => (i.id === 'i1' ? { ...i, epicId: 'e1' } : i)),
    ],
    nextNumber: 10,
  })])]);
  const html = page('/boards/p1');
  const columns = html.split('data-column="').slice(1).map((c) => text(`<${c}`));
  assert.match(columns[0], /^ To Do 2 Fix the tap Garden makeover Urgent HOME-1/, 'the epic is a lozenge on its child, not a card');
  assert.match(html, /title="Epic: Garden makeover"/);
});
