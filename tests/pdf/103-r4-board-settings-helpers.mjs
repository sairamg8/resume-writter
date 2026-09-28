// Shared by the R4 design tests of a project's Settings page (103-r4-*-settings*.test.mjs): the real
// page and board store mounted with react-dom/client (tests/pdf/fake-dom.mjs, through Vite's
// loader) over a localStorage holding two fictional projects, as 82-settings-page.test.mjs does.
// The fake DOM has no layout, so these tests read the class tokens that make the layout.
import { createElement } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { loadModule } from './harness.mjs';

export const KEY = 'cpwtcv_boards_v2';

/** localStorage in memory; `refused` is a key whose writes fail, as a browser blocking storage. */
class Storage {
  constructor(entries = [], refused = null) { this.map = new Map(entries); this.refused = refused; }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) {
    if (k === this.refused) throw new Error('The operation is insecure.');
    this.map.set(k, String(v));
  }
  removeItem(k) { this.map.delete(k); }
}

const col = (id, title, category = 'todo') => ({ id, title, category, wipLimit: null });
const issue = (id, number, title, columnId, extra = {}) => ({ id, number, type: 'task', title, columnId, labelIds: [], checklist: [], ...extra });
const project = (id, key) => ({
  id, key, title: `Project ${key}`, color: '#6366f1', mode: 'kanban', description: '',
  columns: [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')],
  labels: [{ id: 'l1', name: 'Urgent', color: '#ef4444' }, { id: 'l2', name: 'Home', color: '#3b82f6' }],
  sprints: [],
  // To Do holds "Fix the tap": its Delete column opens the "move its issues to" strip.
  issues: [issue('i1', 1, 'Fix the tap', 'c1', { labelIds: ['l1'] }), issue('i2', 2, 'Paint the fence', 'c2')],
  nextNumber: 3, hideDoneAfterDays: 14,
});

/** An element's class tokens. */
export const classes = (el) => (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

/**
 * /boards/p1/settings mounted. `refuseSave`: storage refuses the boards list, so the page shows
 * its "not being saved" notice. Call `close()` when done.
 */
export async function mountSettings({ refuseSave = false } = {}) {
  const { BoardSettings } = await loadModule('/src/pages/BoardSettings.jsx');
  const store = await loadModule('/src/hooks/useBoardStore.js');
  const dom = await import('./fake-dom.mjs');
  store._resetBoardStoreForTest();
  globalThis.localStorage = new Storage(
    [[KEY, JSON.stringify({ boards: [project('p1', 'HOME'), project('p2', 'WORK')], dataVersion: 2 })]],
    refuseSave ? KEY : null,
  );
  store.subscribe(() => {});
  const view = dom.mount(() => createElement(MemoryRouter, { initialEntries: ['/boards/p1/settings'] },
    createElement(Routes, null, createElement(Route, { path: '/boards/:id/settings', element: createElement(BoardSettings) }))), {});
  const ev = { stopPropagation() {}, preventDefault() {}, key: '', nativeEvent: {} };
  const all = (node = view.container) => [...dom.elements(node)];
  const page = {
    view,
    all,
    find: (attr, value) => all().find((el) => el.getAttribute(attr) === value),
    byLabel: (label, node) => all(node).find((el) => el.getAttribute('aria-label') === label),
    button: (text, node) => all(node).find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text),
    click: (el) => view.act(() => dom.reactProps(el).onClick(ev)),
    /** The column of cards: the parent of the first card (<section>). */
    cards: () => all().find((el) => el.tagName === 'SECTION')?.parentNode,
    /** Opens To Do's delete strip (it holds an issue, so its issues must go somewhere first). */
    openDeleteStrip: () => page.click(page.byLabel('Delete column', page.find('data-column', 'c1'))),
    async close() {
      await view.unmount();
      store._resetBoardStoreForTest();
      delete globalThis.localStorage;
    },
  };
  return page;
}
