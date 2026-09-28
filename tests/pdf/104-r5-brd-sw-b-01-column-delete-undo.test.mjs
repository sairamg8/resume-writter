// R4-SW-B-01: a column delete had no Undo. On the board its toast carried no action, and Project
// settings deleted a column with no toast at all, while a project's and an issue's delete both offer
// Undo. Now every column delete shows 'Column “X” deleted' with Undo, and Undo puts back what the
// delete changed: the column at its place (title, category, WIP limit), each moved issue's column,
// resolvedAt and history, and it takes away a next occurrence the move made for a repeating issue.
// An edit made between the delete and the Undo is kept. The store's actions are driven over an
// in-memory list (createBoardActions); the real Board and Settings pages over tests/pdf/fake-dom.mjs
// through Vite's loader, inside the kit's ToastProvider. Fictional data only.
// Run: node --test tests/pdf/104-r5-brd-sw-b-01-column-delete-undo.test.mjs
import { before, after, beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { createBoardActions } from '../../src/utils/boardActions.js';

const NOW = new Date(2026, 8, 26, 10, 0).getTime();
const col = (id, title, category, wipLimit = null) => ({ id, title, category, wipLimit });
const issue = (id, number, title, columnId, extra = {}) => ({
  id, number, type: 'task', title, description: '', columnId, priority: 'medium', labelIds: [], due: '', startDate: '',
  estimate: null, epicId: null, sprintId: null, checklist: [], comments: [],
  activity: [{ id: `act-${id}`, at: NOW - 1000, kind: 'created', field: null, from: null, to: null }],
  recurrence: 'none', recurrenceNextId: null, createdAt: NOW - 1000, updatedAt: NOW - 1000, resolvedAt: null, ...extra,
});
const project = (extra = {}) => ({
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1', mode: 'kanban', description: '',
  columns: [col('c1', 'To Do', 'todo'), col('rev', 'Review', 'inprogress', 3), col('c3', 'Done', 'done')],
  labels: [], sprints: [],
  issues: [
    issue('i1', 1, 'Fix the tap', 'rev'),
    issue('i2', 2, 'Water the plants', 'rev', { recurrence: 'weekly', due: '2026-09-28' }),
    issue('i3', 3, 'Buy nails', 'c1'),
  ],
  nextNumber: 4, hideDoneAfterDays: 14, createdAt: NOW - 1000, updatedAt: NOW - 1000,
  ...extra,
});

/** The board actions over a list held here, as the store holds it. */
function actionsOver(boards) {
  let list = boards;
  let at = NOW;
  const a = createBoardActions({ boardsNow: () => list, setBoards: (fn) => { list = fn(list); }, now: () => { at += 1000; return at; } });
  return { a, board: () => list.find((b) => b.id === 'p1'), drop: () => { list = list.filter((b) => b.id !== 'p1'); } };
}
const byId = (b, id) => b.issues.find((i) => i.id === id);

describe('R4-SW-B-01: the store puts a deleted column back', () => {
  it('delete Review into Done (resolving both, a repeating one spawning its next), then restore: the board is as it was', () => {
    const original = project();
    const { a, board } = actionsOver([original]);
    const removed = a.deleteColumn('p1', 'rev', 'c3');
    assert.ok(removed, 'the delete returns what Undo needs');
    const gone = board();
    assert.deepEqual(gone.columns.map((c) => c.id), ['c1', 'c3']);
    assert.ok(byId(gone, 'i1').resolvedAt && byId(gone, 'i2').resolvedAt, 'moved into Done: resolved');
    assert.equal(gone.issues.length, 4, 'the repeating issue made its next occurrence');

    assert.equal(a.restoreColumn(removed), true);
    const back = board();
    assert.deepEqual(back.columns, original.columns, 'the column at its place, with its title, category and WIP limit');
    assert.deepEqual(back.issues, original.issues, 'each issue as it was (column, resolvedAt, history), the next occurrence gone');
    assert.equal(a.restoreColumn(removed), false, 'restored twice: once');
  });

  it('an edit made between the delete and the Undo is kept', () => {
    const original = project();
    const { a, board } = actionsOver([original]);
    const removed = a.deleteColumn('p1', 'rev', 'c3');
    const spawned = board().issues.find((i) => !original.issues.some((o) => o.id === i.id));
    a.updateIssue('p1', 'i3', { title: 'Buy screws' }); // an issue the delete never touched
    a.updateIssue('p1', 'i1', { title: 'Fix the tap, again' }); // a moved issue, edited since
    const added = a.addIssue('p1', { title: 'Sweep the yard', columnId: 'c1' });

    assert.equal(a.restoreColumn(removed), true);
    const back = board();
    assert.deepEqual(back.columns.map((c) => c.id), ['c1', 'rev', 'c3'], 'the column back at its place');
    assert.equal(byId(back, 'i3').title, 'Buy screws', 'the other issue\'s edit is kept');
    assert.equal(byId(back, 'i1').title, 'Fix the tap, again', 'the moved issue edited since is left as it is now');
    assert.equal(byId(back, 'i1').columnId, 'c3');
    assert.deepEqual(byId(back, 'i2'), original.issues[1], 'the untouched moved issue is back in Review, reopened, its history as it was');
    assert.ok(!byId(back, spawned.id), 'its untouched next occurrence is gone');
    assert.ok(byId(back, added.id), 'an issue added meanwhile stays');
  });

  it('a repeating issue edited since the delete keeps the next occurrence the delete made for it', () => {
    const original = project();
    const { a, board } = actionsOver([original]);
    const removed = a.deleteColumn('p1', 'rev', 'c3');
    const next = byId(board(), 'i2').recurrenceNextId;
    assert.ok(next && byId(board(), next), 'resolving the weekly issue made its next occurrence');
    a.updateIssue('p1', 'i2', { title: 'Water the plants and the herbs' });

    assert.equal(a.restoreColumn(removed), true);
    const back = board();
    const i2 = byId(back, 'i2');
    assert.equal(i2.title, 'Water the plants and the herbs', 'the edited issue is left as it is now');
    assert.equal(i2.columnId, 'c3');
    assert.ok(i2.resolvedAt, 'still resolved');
    assert.equal(i2.recurrenceNextId, next);
    assert.ok(byId(back, next), 'its next occurrence stays: the issue it came from was not put back');
    assert.deepEqual(byId(back, 'i1'), original.issues[0], 'the untouched moved issue is put back');
  });

  it('the next occurrence the delete made, edited since, stays, and the untouched repeating issue comes back pointing at it', () => {
    const original = project();
    const { a, board } = actionsOver([original]);
    const removed = a.deleteColumn('p1', 'rev', 'c3');
    const next = byId(board(), 'i2').recurrenceNextId;
    assert.ok(next && byId(board(), next), 'resolving the weekly issue made its next occurrence');
    a.updateIssue('p1', next, { title: 'Water the plants, the herbs too' });

    assert.equal(a.restoreColumn(removed), true);
    const back = board();
    assert.equal(byId(back, next).title, 'Water the plants, the herbs too', 'the edited next occurrence is kept');
    assert.deepEqual(byId(back, 'i2'), { ...original.issues[1], recurrenceNextId: next },
      'the untouched repeating issue is back in Review, reopened, still pointing at its next occurrence');
    // Resolved again, it makes no second next occurrence: it already has one.
    const count = back.issues.length;
    a.moveIssue('p1', 'i2', { columnId: 'c3' });
    assert.ok(byId(board(), 'i2').resolvedAt, 'resolved again');
    assert.equal(board().issues.length, count, 'no second next occurrence');
    assert.equal(board().issues.filter((i) => i.title.startsWith('Water the plants')).length, 2);
  });

  it('an empty column comes back too; with its project gone, Undo does nothing', () => {
    const original = project({ columns: [...project().columns, col('c4', 'Waiting', 'todo', 2)] });
    const { a, board, drop } = actionsOver([original]);
    const removed = a.deleteColumn('p1', 'c4');
    assert.ok(removed);
    assert.equal(a.restoreColumn(removed), true);
    assert.deepEqual(board().columns, original.columns);
    const again = a.deleteColumn('p1', 'c4');
    drop();
    assert.equal(a.restoreColumn(again), false);
    assert.equal(a.deleteColumn('p1', 'nope'), null, 'a refused delete gives nothing to undo');
  });
});

describe('R4-SW-B-01: the pages\' toasts offer Undo', () => {
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
  const tick = async () => { for (let n = 0; n < 5; n += 1) await new Promise((r) => { setImmediate(r); }); await new Promise((r) => { setTimeout(r, 0); }); };

  function mountAt(board, path, route, Page) {
    globalThis.localStorage = new Storage([[KEY, JSON.stringify({ boards: [board], dataVersion: 2 })]]);
    store.subscribe(() => {});
    globalThis.confirm = () => true;
    const view = dom.mount(() => h(ToastProvider, null, h(MemoryRouter, { initialEntries: [path] },
      h(Routes, null, h(Route, { path: route, element: h(Page) })))), {});
    view.window.confirm = () => true;
    const ev = { stopPropagation() {}, preventDefault() {}, key: '', nativeEvent: {} };
    const all = (node) => [...dom.elements(node ?? view.document.body)];
    return {
      view,
      find: (attr, value) => all().find((el) => el.getAttribute(attr) === value),
      byLabel: (label, node) => all(node).find((el) => el.getAttribute('aria-label') === label),
      button: (label, node) => all(node).find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === label),
      item: (label) => all().find((el) => String(el.getAttribute('role')).startsWith('menuitem') && el.textContent.trim() === label),
      click: (el) => view.act(() => dom.reactProps(el).onClick(ev)),
      /** The Undo of the toast titled `title`. */
      undoOf(title) {
        const toast = all().find((el) => el.hasAttribute('data-toast') && el.textContent.includes(title));
        assert.ok(toast, `no '${title}' toast`);
        const undo = all(toast).find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Undo');
        assert.ok(undo, `the '${title}' toast has no Undo`);
        return undo;
      },
    };
  }

  it('the board\'s column menu: Delete, then the toast\'s Undo brings the column and its issues back', async () => {
    const original = project();
    const page = mountAt(original, '/boards/p1', '/boards/:id', Board);
    try {
      page.click(page.byLabel('Review column actions'));
      page.click(page.item('Delete column'));
      await tick();
      assert.deepEqual(boardNow().columns.map((c) => c.id), ['c1', 'c3'], 'deleted');
      page.click(page.undoOf('Column “Review” deleted'));
      const back = boardNow();
      assert.deepEqual(back.columns.map((c) => c.id), ['c1', 'rev', 'c3']);
      assert.deepEqual(back.issues.map((i) => [i.id, i.columnId, i.resolvedAt]), original.issues.map((i) => [i.id, i.columnId, i.resolvedAt]));
    } finally { await page.view.unmount(); }
  });

  it('Project settings: an empty column\'s delete and a delete that moves issues each toast with Undo', async () => {
    const original = project({ columns: [...project().columns, col('c4', 'Waiting', 'todo')] });
    const page = mountAt(original, '/boards/p1/settings', '/boards/:id/settings', BoardSettings);
    try {
      page.click(page.byLabel('Delete column', page.find('data-column', 'c4')));
      await tick();
      assert.ok(!boardNow().columns.some((c) => c.id === 'c4'), 'the empty column is deleted');
      page.click(page.undoOf('Column “Waiting” deleted'));
      assert.deepEqual(boardNow().columns.map((c) => c.id), ['c1', 'rev', 'c3', 'c4']);

      const row = page.find('data-column', 'rev');
      page.click(page.byLabel('Delete column', row));
      page.click(page.button('Delete column', row));
      assert.deepEqual(boardNow().columns.map((c) => c.id), ['c1', 'c3', 'c4']);
      page.click(page.undoOf('Column “Review” deleted'));
      const back = boardNow();
      assert.deepEqual(back.columns.map((c) => c.id), ['c1', 'rev', 'c3', 'c4']);
      assert.deepEqual(back.issues.filter((i) => i.columnId === 'rev').map((i) => i.id), ['i1', 'i2'], 'its issues are back in it');
    } finally { await page.view.unmount(); }
  });
});
