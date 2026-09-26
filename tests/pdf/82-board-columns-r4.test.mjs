// Deleting a column, on the board and in Project settings (R4-BRD-01, R4-BRD-12).
// R4-BRD-01: the board counted only the cards it shows, so a Done column whose issues were all
// resolved before hideDoneAfterDays — or a scrum board's column holding only backlog issues — looked
// empty and was deleted without a question, every hidden issue moving to the column beside it (and,
// out of Done, reopened). Now the question counts every issue the column holds, and a column of the
// same category takes them when there is one.
// R4-BRD-12: in Settings, the "move to" column picked when the panel opened stayed the target after
// that column was deleted: the select showed another one, and "Delete column" did nothing.
// The real pages and the real board store are mounted with react-dom/client over fake-dom, through
// Vite's loader (tests/pdf/harness.mjs), as tests/pdf/82-board-pages.test.mjs does.
// Run: node --test tests/pdf/82-board-columns-r4.test.mjs
import { before, after, beforeEach, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

const KEY = 'cpwtcv_boards_v2';
const DAY = 24 * 60 * 60 * 1000;

let Board;
let BoardSettings;
let store;
before(async () => {
  await setup();
  ({ Board } = await loadModule('/src/pages/Board.jsx'));
  ({ BoardSettings } = await loadModule('/src/pages/BoardSettings.jsx'));
  store = await loadModule('/src/hooks/useBoardStore.js');
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
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1', mode: 'kanban', description: '',
  columns: [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')],
  labels: [],
  sprints: [],
  issues: [issue('i1', 1, 'Fix the tap', 'c1'), issue('i2', 2, 'Paint the fence', 'c2')],
  nextNumber: 3, hideDoneAfterDays: 14,
  ...extra,
});

function open(board) {
  globalThis.localStorage = new Storage([[KEY, JSON.stringify({ boards: [board], dataVersion: 2 })]]);
  store.subscribe(() => {});
}
const boardNow = () => store.snapshot().boards.find((b) => b.id === 'p1');
const tick = async () => { for (let n = 0; n < 5; n += 1) await new Promise((r) => { setImmediate(r); }); await new Promise((r) => { setTimeout(r, 0); }); };

/** `Page` at `path` mounted with react-dom/client, its handlers called as clicks. */
async function mountAt(path, route, Page) {
  const dom = await import('./fake-dom.mjs');
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const view = dom.mount(() => createElement(MemoryRouter, { initialEntries: [path] },
    createElement(Routes, null, createElement(Route, { path: route, element: createElement(Page) }))), {});
  const ev = (extra = {}) => ({ stopPropagation() {}, preventDefault() {}, key: '', nativeEvent: {}, ...extra });
  // The whole document: menus open in portals at the end of <body>.
  const all = (node) => [...dom.elements(node ?? view.document.body)];
  return {
    view,
    text: () => view.document.body.textContent,
    find: (attr, value) => all().find((el) => el.getAttribute(attr) === value),
    byLabel: (label, node) => all(node).find((el) => el.getAttribute('aria-label') === label),
    button: (label, node) => all(node).find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === label),
    item: (label) => all().find((el) => String(el.getAttribute('role')).startsWith('menuitem') && el.textContent.trim() === label),
    props: (el) => dom.reactProps(el),
    click: (el) => view.act(() => dom.reactProps(el).onClick(ev())),
    change: (el, value) => view.act(() => dom.reactProps(el).onChange(ev({ target: { value } }))),
  };
}

/** Pick "Delete column" in column `title`'s menu on the board. */
async function deleteOnBoard(page, title) {
  page.click(page.byLabel(`${title} column actions`));
  page.click(page.item('Delete column'));
  await tick();
}

it('R4-BRD-01: a Done column that looks empty (its issues hidden after hideDoneAfterDays) asks first; No keeps it all', async () => {
  const resolvedAt = Date.now() - 30 * DAY;
  open(project({ issues: [...project().issues, issue('i3', 3, 'Old chore', 'c3', { resolvedAt }), issue('i4', 4, 'Older chore', 'c3', { resolvedAt })], nextNumber: 5 }));
  const page = await mountAt('/boards/p1', '/boards/:id', Board);
  const asked = [];
  page.view.window.confirm = (q) => { asked.push(q); return false; };
  try {
    assert.match(page.text(), /2 done issues are hidden/, 'the board shows none of Done\'s issues');
    await deleteOnBoard(page, 'Done');
    assert.deepEqual(asked, ['Delete the Done column?'], 'it holds two issues: the delete asks');
    const b = boardNow();
    assert.deepEqual(b.columns.map((c) => c.id), ['c1', 'c2', 'c3'], 'answered No: the column stays');
    assert.deepEqual(b.issues.filter((i) => i.columnId === 'c3').map((i) => [i.id, i.resolvedAt]), [['i3', resolvedAt], ['i4', resolvedAt]], 'not moved, not reopened');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-01: a Done column\'s hidden issues go to another done column, still resolved', async () => {
  const resolvedAt = Date.now() - 30 * DAY;
  open(project({
    columns: [col('c1', 'To Do'), col('c3', 'Done', 'done'), col('c2', 'Doing', 'inprogress'), col('c4', 'Shipped', 'done')],
    issues: [...project().issues, issue('i3', 3, 'Old chore', 'c3', { resolvedAt })],
    nextNumber: 4,
  }));
  const page = await mountAt('/boards/p1', '/boards/:id', Board);
  const asked = [];
  page.view.window.confirm = (q) => { asked.push(q); return true; };
  try {
    await deleteOnBoard(page, 'Done');
    assert.deepEqual(asked, ['Delete the Done column?']);
    const b = boardNow();
    assert.deepEqual(b.columns.map((c) => c.id), ['c1', 'c2', 'c4']);
    const moved = b.issues.find((i) => i.id === 'i3');
    assert.equal(moved.columnId, 'c4', 'into the other done column, not the open one beside it');
    assert.equal(moved.resolvedAt, resolvedAt, 'still resolved, on the same date');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-01: on a scrum board with an active sprint, a column holding only backlog issues and an epic asks first', async () => {
  const sprints = [{ id: 's1', name: 'Sprint 1', goal: '', startDate: '2026-09-21', endDate: '2026-10-05', state: 'active', completedAt: null }];
  open(project({
    mode: 'scrum',
    sprints,
    issues: [issue('i1', 1, 'Fix the tap', 'c1'), issue('i2', 2, 'Paint the fence', 'c2', { sprintId: 's1' }), issue('e1', 3, 'Garden', 'c1', { type: 'epic' })],
    nextNumber: 4,
  }));
  const page = await mountAt('/boards/p1', '/boards/:id', Board);
  const asked = [];
  page.view.window.confirm = (q) => { asked.push(q); return false; };
  try {
    assert.doesNotMatch(page.text(), /Fix the tap/, 'the backlog issue is off the board');
    await deleteOnBoard(page, 'To Do');
    assert.deepEqual(asked, ['Delete the To Do column?']);
    assert.deepEqual(boardNow().columns.map((c) => c.id), ['c1', 'c2', 'c3']);
    assert.deepEqual(boardNow().issues.filter((i) => i.columnId === 'c1').map((i) => i.id), ['i1', 'e1']);
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-12: Settings — the picked "move to" column deleted meanwhile: Delete column moves the issues to the column the select shows', async () => {
  open(project({ columns: [col('c1', 'To Do'), col('c4', 'Waiting'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')] }));
  const page = await mountAt('/boards/p1/settings', '/boards/:id/settings', BoardSettings);
  globalThis.confirm = () => true;
  page.view.window.confirm = () => true;
  try {
    const row = (id) => page.find('data-column', id);
    page.click(page.byLabel('Delete column', row('c1')));
    const select = () => page.byLabel('Move its issues to', row('c1'));
    assert.equal(page.props(select()).value, 'c4', 'the panel opens on the other to-do column');
    // Waiting holds nothing: its own trash deletes it after a plain question.
    page.click(page.byLabel('Delete column', row('c4')));
    await tick();
    assert.deepEqual(boardNow().columns.map((c) => c.id), ['c1', 'c2', 'c3']);
    const shown = page.props(select()).value;
    assert.equal(shown, 'c2', 'the select shows a column that exists');
    page.click(page.button('Delete column', row('c1')));
    const b = boardNow();
    assert.deepEqual(b.columns.map((c) => c.id), ['c2', 'c3'], 'the column is deleted');
    assert.equal(b.issues.find((i) => i.id === 'i1').columnId, 'c2', 'its issue went where the select said');
  } finally {
    await page.view.unmount();
  }
});
