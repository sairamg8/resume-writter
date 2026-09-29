// Shared by the R5 board tests (104-r5-brd-*.test.mjs): the real Backlog page and board store mounted
// with react-dom/client over tests/pdf/fake-dom.mjs, through Vite's loader, over a localStorage
// holding one fictional project — as 82-backlog-r4.test.mjs does. Call `load()` in a before hook
// (after the harness's setup()), and `page.close()` when done.
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { loadModule } from './harness.mjs';

export const KEY = 'cpwtcv_boards_v2';

class Storage {
  constructor(entries = []) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

export const col = (id, title, category = 'todo') => ({ id, title, category, wipLimit: null });
export const issue = (id, number, title, columnId, extra = {}) => ({ id, number, type: 'task', title, columnId, labelIds: [], checklist: [], ...extra });
export const sprint = (id, name, state, extra = {}) => ({ id, name, goal: '', startDate: '', endDate: '', state, completedAt: state === 'closed' ? 1 : null, ...extra });
export const project = (extra = {}) => ({
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1', mode: 'kanban', description: '',
  columns: [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')],
  labels: [], sprints: [],
  issues: [issue('i1', 1, 'Fix the tap', 'c1'), issue('i2', 2, 'Paint the fence', 'c2'), issue('i3', 3, 'Buy nails', 'c1')],
  nextNumber: 4, hideDoneAfterDays: 14,
  ...extra,
});

let dom;
let harness;
let store;
let Backlog;
let ToastProvider;
/** The modules the pages need; call once the harness is set up. */
export async function load() {
  dom = await import('./fake-dom.mjs');
  harness = await import('../unit/ui-dom-harness.mjs');
  harness.patchFakeDom();
  store = await loadModule('/src/hooks/useBoardStore.js');
  ({ Backlog } = await loadModule('/src/pages/Backlog.jsx'));
  ({ ToastProvider } = await loadModule('/src/components/ui/Toast.jsx'));
  return { dom, harness, store };
}

export const boardNow = () => store.snapshot().boards.find((b) => b.id === 'p1');
export const issueNow = (id) => boardNow().issues.find((i) => i.id === id);

/** The Backlog page for `board`, inside the kit's ToastProvider, with the finders and clicks the tests need. */
export function mountBacklog(board) {
  store._resetBoardStoreForTest();
  globalThis.localStorage = new Storage([[KEY, JSON.stringify({ boards: [board], dataVersion: 2 })]]);
  store.subscribe(() => {});
  globalThis.confirm = () => true;
  const view = dom.mount(() => h(ToastProvider, null, h(MemoryRouter, { initialEntries: ['/boards/p1/backlog'] },
    h(Routes, null, h(Route, { path: '/boards/:id/backlog', element: h(Backlog) })))), {});
  view.window.confirm = () => true;
  const all = (node) => [...dom.elements(node ?? view.document.body)];
  const page = {
    view,
    all,
    section: (id) => all().find((el) => el.getAttribute('data-section') === id),
    button: (text, node) => all(node).find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text),
    byLabel: (label, node) => all(node).find((el) => el.getAttribute('aria-label') === label),
    items: () => all().filter((el) => String(el.getAttribute('role')).startsWith('menuitem')),
    item: (label) => page.items().find((el) => el.textContent.trim() === label),
    click: (el) => view.act(() => dom.reactProps(el).onClick(harness.ev())),
    /** The page's DndContext onDragEnd, read off the rendered tree. */
    onDragEnd(event) {
      const el = page.section('backlog');
      let fiber = el[Object.keys(el).find((k) => k.startsWith('__reactFiber$'))];
      while (fiber && typeof fiber.memoizedProps?.onDragEnd !== 'function') fiber = fiber.return;
      assert.ok(fiber, 'the backlog is inside a DndContext');
      view.act(() => fiber.memoizedProps.onDragEnd(event));
    },
    /** The Undo of the toast titled `title`. */
    undoOf(title) {
      const toast = all().find((el) => el.hasAttribute('data-toast') && el.textContent.includes(title));
      assert.ok(toast, `no '${title}' toast`);
      const undo = all(toast).find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Undo');
      assert.ok(undo, `the '${title}' toast has no Undo`);
      return undo;
    },
    async close() {
      await view.unmount();
      store._resetBoardStoreForTest();
      delete globalThis.localStorage;
      delete globalThis.confirm;
    },
  };
  return page;
}

/** Lets the confirm's promise and the page's effects run. */
export const tick = async () => { for (let n = 0; n < 5; n += 1) await new Promise((r) => { setImmediate(r); }); await new Promise((r) => { setTimeout(r, 0); }); };
