// R5-HUNT6-DONE-COLUMN-RECATEGORIZE-NO-UNDO: changing a Done column's category (the board's column
// menu, Status category; or Project settings' Category select) reopened every issue in it and wiped
// each one's resolved date, with no question and no Undo. Setting it back stamped every issue
// "now", so long-done issues flooded back onto the board and their real dates were lost. A column
// delete asks first and offers Undo (R4-BRD-01, R4-SW-B-01). Now a category change that reopens or
// resolves the column's issues asks first, and its toast's Undo puts the category back and each
// issue as it was: its resolvedAt, its history. A change with nothing to reopen or resolve asks
// nothing. The store's actions are driven over an in-memory list (createBoardActions); the real
// Board and Settings pages over tests/pdf/fake-dom.mjs through Vite's loader, inside the kit's
// ToastProvider. Fictional data only.
// Run: node --test tests/pdf/107-r5-hunt6-column-category-undo.test.mjs
import { before, after, beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { createBoardActions } from '../../src/utils/boardActions.js';
import { columnRecategorization } from '../../src/utils/boardView.js';

const NOW = new Date(2026, 8, 26, 10, 0).getTime();
const DAY = 24 * 60 * 60 * 1000;
const col = (id, title, category, wipLimit = null) => ({ id, title, category, wipLimit });
const issue = (id, number, title, columnId, extra = {}) => ({
  id, number, type: 'task', title, description: '', columnId, priority: 'medium', labelIds: [], due: '', startDate: '',
  estimate: null, epicId: null, sprintId: null, checklist: [], comments: [],
  activity: [{ id: `act-${id}`, at: NOW - 60 * DAY, kind: 'created', field: null, from: null, to: null }],
  recurrence: 'none', recurrenceNextId: null, createdAt: NOW - 60 * DAY, updatedAt: NOW - 40 * DAY, resolvedAt: null, ...extra,
});
const project = () => ({
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1', mode: 'kanban', description: '',
  columns: [col('c1', 'To Do', 'todo'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')],
  labels: [], sprints: [],
  issues: [
    issue('i1', 1, 'Fix the tap', 'c3', { resolvedAt: NOW - 40 * DAY }),
    issue('i2', 2, 'Paint the fence', 'c3', { resolvedAt: NOW - 30 * DAY }),
    issue('i3', 3, 'Buy nails', 'c1'),
  ],
  nextNumber: 4, hideDoneAfterDays: 14, createdAt: NOW - 60 * DAY, updatedAt: NOW - 40 * DAY,
});

function actionsOver(boards) {
  let list = boards;
  let at = NOW;
  const a = createBoardActions({ boardsNow: () => list, setBoards: (fn) => { list = fn(list); }, now: () => { at += 1000; return at; } });
  return { a, board: () => list.find((b) => b.id === 'p1') };
}
const byId = (b, id) => b.issues.find((i) => i.id === id);

describe('R5-HUNT6: a column\'s category change can be undone', () => {
  it('columnRecategorization says what a change does to the column\'s issues', () => {
    const b = project();
    assert.deepEqual(columnRecategorization(b, 'c3', 'todo'), { count: 2, change: 'reopen' });
    assert.deepEqual(columnRecategorization(b, 'c1', 'done'), { count: 1, change: 'resolve' });
    assert.deepEqual(columnRecategorization(b, 'c1', 'inprogress'), { count: 1, change: null });
    assert.deepEqual(columnRecategorization(b, 'nope', 'done'), { count: 0, change: null });
  });

  it('Done to To do reopens the issues; restoreCategory brings back the column and each resolved date', () => {
    const original = project();
    const { a, board } = actionsOver([original]);
    const changed = a.setColumnCategory('p1', 'c3', 'todo');
    assert.ok(changed, 'the change returns what Undo needs');
    assert.equal(board().columns[2].category, 'todo');
    assert.equal(byId(board(), 'i1').resolvedAt, null, 'reopened, as R4-BRD-09 wants');
    assert.equal(a.restoreCategory(changed), true);
    const back = board();
    assert.deepEqual(back.columns, original.columns, 'the column is Done again');
    assert.deepEqual(back.issues, original.issues, 'each issue as it was: its real resolved date and history');
    assert.equal(a.restoreCategory(changed), false, 'undone once');
  });

  it('an issue edited since keeps its edit; a column changed again since is not undone', () => {
    const original = project();
    const { a, board } = actionsOver([original]);
    const changed = a.setColumnCategory('p1', 'c3', 'todo');
    a.updateIssue('p1', 'i2', { title: 'Paint the fence white' });
    assert.equal(a.restoreCategory(changed), true);
    assert.deepEqual(byId(board(), 'i1'), original.issues[0], 'the untouched issue is put back');
    assert.equal(byId(board(), 'i2').title, 'Paint the fence white', 'the edited one stays as it is now');

    const again = a.setColumnCategory('p1', 'c3', 'todo');
    a.setColumnCategory('p1', 'c3', 'inprogress');
    assert.equal(a.restoreCategory(again), false, 'the category changed since: Undo does nothing');
    assert.equal(board().columns[2].category, 'inprogress');
    assert.equal(a.setColumnCategory('p1', 'c3', 'inprogress'), null, 'no change: nothing to undo');
  });
});

describe('R5-HUNT6: the pages ask first and offer Undo', () => {
  const KEY = 'cpwtcv_boards_v2';
  let dom;
  let store;
  let Board;
  let BoardSettings;
  let ToastProvider;
  before(async () => {
    await setup();
    dom = await import('./fake-dom.mjs');
    const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
    patchFakeDom();
    store = await loadModule('/src/hooks/useBoardStore.js');
    ({ Board } = await loadModule('/src/pages/Board.jsx'));
    ({ BoardSettings } = await loadModule('/src/pages/BoardSettings.jsx'));
    ({ ToastProvider } = await loadModule('/src/components/ui/Toast.jsx'));
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

  const boardNow = () => store.snapshot().boards.find((b) => b.id === 'p1');
  const resolved = () => boardNow().issues.map((i) => [i.id, i.resolvedAt]);
  const tick = async () => { for (let n = 0; n < 5; n += 1) await new Promise((r) => { setImmediate(r); }); await new Promise((r) => { setTimeout(r, 0); }); };

  function mountAt(path, route, Page) {
    globalThis.localStorage = new Storage([[KEY, JSON.stringify({ boards: [project()], dataVersion: 2 })]]);
    store.subscribe(() => {});
    const asked = [];
    let answer = false;
    const ask = (question) => { asked.push(question); return answer; };
    globalThis.confirm = ask;
    const view = dom.mount(() => h(ToastProvider, null, h(MemoryRouter, { initialEntries: [path] },
      h(Routes, null, h(Route, { path: route, element: h(Page) })))), {});
    view.window.confirm = ask;
    const ev = { stopPropagation() {}, preventDefault() {}, key: '', nativeEvent: {} };
    const all = (node) => [...dom.elements(node ?? view.document.body)];
    return {
      view,
      asked,
      answer: (yes) => { answer = yes; },
      find: (attr, value) => all().find((el) => el.getAttribute(attr) === value),
      byLabel: (label, node) => all(node).find((el) => el.getAttribute('aria-label') === label),
      item: (label) => all().find((el) => String(el.getAttribute('role')).startsWith('menuitem') && el.textContent.trim() === label),
      click: (el) => view.act(() => dom.reactProps(el).onClick(ev)),
      change: (el, value) => view.act(() => dom.reactProps(el).onChange({ ...ev, target: { value } })),
      undoOf(title) {
        const toast = all().find((el) => el.hasAttribute('data-toast') && el.textContent.includes(title));
        assert.ok(toast, `no '${title}' toast`);
        const undo = all(toast).find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Undo');
        assert.ok(undo, `the '${title}' toast has no Undo`);
        return undo;
      },
    };
  }

  it('the board\'s column menu: Done to To do asks first; declined, nothing changes; accepted, Undo puts every resolved date back', async () => {
    const page = mountAt('/boards/p1', '/boards/:id', Board);
    const original = resolved();
    const pick = async () => {
      page.click(page.byLabel('Done column actions'));
      page.click(page.item('Status category'));
      page.click(page.item('To do'));
      await tick();
    };
    try {
      await pick();
      assert.equal(page.asked.length, 1, 'the change reopens two issues: it asks first');
      assert.equal(boardNow().columns[2].category, 'done', 'declined: nothing changed');
      assert.deepEqual(resolved(), original);

      page.answer(true);
      await pick();
      assert.equal(boardNow().columns[2].category, 'todo');
      assert.equal(boardNow().issues.filter((i) => i.resolvedAt).length, 0, 'accepted: reopened');
      page.click(page.undoOf('Column “Done” is now To do'));
      assert.equal(boardNow().columns[2].category, 'done');
      assert.deepEqual(resolved(), original, 'Undo brings back each issue\'s real resolved date');
    } finally { await page.view.unmount(); }
  });

  it('Project settings\' Category select: the same question and Undo; a change that reopens nothing asks nothing', async () => {
    const page = mountAt('/boards/p1/settings', '/boards/:id/settings', BoardSettings);
    const original = resolved();
    try {
      page.change(page.byLabel('Column category', page.find('data-column', 'c1')), 'inprogress');
      await tick();
      assert.equal(page.asked.length, 0, 'To do to In progress resolves or reopens nothing');
      assert.equal(boardNow().columns[0].category, 'inprogress');

      page.answer(true);
      page.change(page.byLabel('Column category', page.find('data-column', 'c3')), 'todo');
      await tick();
      assert.equal(page.asked.length, 1, 'Done to To do asks first');
      assert.equal(boardNow().columns[2].category, 'todo');
      page.click(page.undoOf('Column “Done” is now To do'));
      assert.equal(boardNow().columns[2].category, 'done');
      assert.deepEqual(resolved(), original, 'Undo brings back each issue\'s real resolved date');
    } finally { await page.view.unmount(); }
  });
});
