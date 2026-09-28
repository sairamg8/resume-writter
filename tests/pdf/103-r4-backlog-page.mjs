// The Backlog page (/boards/:id/backlog) mounted for the Round 4 layout tests,
// tests/pdf/103-r4-*.test.mjs: the real page and the real board store with react-dom/client over
// fake-dom (tests/pdf/fake-dom.mjs, the kit's harness), in a memory router, as
// tests/pdf/82-backlog-page.test.mjs does. fake-dom has no layout, so a test reads the class
// tokens and the structure that make the browser lay the page out right.
import { before, after, beforeEach, afterEach } from 'node:test';
import { createElement as h } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom, ev } from '../unit/ui-dom-harness.mjs';

export { elements, reactProps, ev };

const KEY = 'cpwtcv_boards_v2';
let Backlog;
let store;

/** Registers the file's hooks: Vite's loader, the page and the store, a fresh store per test. */
export function useBacklogPage() {
  before(async () => {
    await setup();
    patchFakeDom(); // the page's menus and fields query the document and move the focus
    ({ Backlog } = await loadModule('/src/pages/Backlog.jsx'));
    store = await loadModule('/src/hooks/useBoardStore.js');
  });
  after(teardown);
  beforeEach(() => { store._resetBoardStoreForTest(); });
  afterEach(() => { delete globalThis.localStorage; });
}

/** localStorage, in memory. */
class Storage {
  constructor(entries = []) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const col = (id, title, category = 'todo') => ({ id, title, category, wipLimit: null });
export const issue = (id, number, title, columnId, extra = {}) => ({ id, number, type: 'task', title, columnId, labelIds: [], checklist: [], ...extra });
/** A sprint not started yet. */
export const futureSprint = (id, name) => ({ id, name, goal: '', startDate: '', endDate: '', state: 'future', completedAt: null });
/** Project p1 (key HOME, Kanban): three issues in the backlog. */
export const project = (extra = {}) => ({
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1', mode: 'kanban',
  columns: [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')],
  labels: [], sprints: [],
  issues: [issue('i1', 1, 'Fix the tap', 'c1'), issue('i2', 2, 'Paint the fence', 'c2'), issue('i3', 3, 'Buy nails', 'c1')],
  nextNumber: 4,
  ...extra,
});

/** Saves `boards` and mounts p1's backlog; helpers read the whole document (menus open in portals). */
export function mountBacklog(boards = [project()]) {
  globalThis.localStorage = new Storage([[KEY, JSON.stringify({ boards, dataVersion: 2 })]]);
  store.subscribe(() => {});
  const view = mount(() => h(MemoryRouter, { initialEntries: ['/boards/p1/backlog'] },
    h(Routes, null, h(Route, { path: '/boards/:id/backlog', element: h(Backlog) }))), {});
  const all = (node = view.document.body) => [...elements(node)];
  return {
    view,
    all,
    section: (id) => all().find((el) => el.getAttribute('data-section') === id),
    button: (text, node) => all(node).find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text),
    byLabel: (label, node) => all(node).find((el) => el.getAttribute('aria-label') === label),
    click: (el) => view.act(() => reactProps(el).onClick(ev())),
  };
}

/** The class tokens of `el`, as a set. */
export const tokens = (el) => new Set((el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));
