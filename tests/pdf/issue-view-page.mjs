// The issue view (IssueDialog over the board) mounted for the Round 4 tests,
// tests/pdf/82-issue-view-r4-0*.test.mjs: the real board page and the real board store with
// react-dom/client over fake-dom (tests/pdf/fake-dom.mjs, the kit's harness), as
// tests/pdf/82-board-summary-labels.test.mjs does, in a router whose history a test reads.
// One file per row, so a fail-first run on CI tells which fix a failure belongs to.
import { before, after, beforeEach, afterEach } from 'node:test';
import { createElement as h } from 'react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom, ev } from '../unit/ui-dom-harness.mjs';

export { elements, reactProps, ev };

let Board;
let ToastProvider;
let store;

/** Registers the file's hooks: Vite's loader, the board page and store, a fresh store per test. */
export function useIssueViewPage() {
  before(async () => {
    await setup();
    patchFakeDom(); // the issue view's focus trap and menus query the document
    ({ Board } = await loadModule('/src/pages/Board.jsx'));
    ({ ToastProvider } = await loadModule('/src/components/ui/index.js'));
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
const issue = (id, number, title, columnId, extra = {}) => ({ id, number, type: 'task', title, columnId, labelIds: [], checklist: [], ...extra });
/** HOME-3 is an epic; HOME-1 is its child. */
const project = () => ({
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1', mode: 'kanban', description: '',
  columns: [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')],
  labels: [],
  sprints: [],
  issues: [
    issue('i1', 1, 'Fix the tap', 'c1', { epicId: 'i3' }),
    issue('i2', 2, 'Paint the fence', 'c2', { description: 'White' }),
    issue('i3', 3, 'Garden makeover', 'c1', { type: 'epic' }),
  ],
  nextNumber: 4,
});

const boardNow = () => store.snapshot().boards.find((b) => b.id === 'p1');
/** Issue `id` of the project as the store has it now. */
export const issueNow = (id) => boardNow().issues.find((i) => i.id === id);

/**
 * The board page at `path`, with a page before it in the router's history ('/elsewhere'), so a
 * test can read where Back goes. Navigations commit at once (useTransitions: false), inside the
 * act() that caused them.
 */
export function mountBoard(path, { toasts = false } = {}) {
  globalThis.localStorage = new Storage([['cpwtcv_boards_v2', JSON.stringify({ boards: [project()], dataVersion: 2 })]]);
  store.subscribe(() => {});
  let nav = null;
  let loc = null;
  function Probe() {
    nav = useNavigate();
    loc = useLocation();
    return null;
  }
  const routes = h(Routes, null,
    h(Route, { path: '/elsewhere', element: h('p', null, 'Elsewhere') }),
    h(Route, { path: '/boards/:id', element: h(Board) }));
  // `toasts`: under the kit's ToastProvider, so a toast (and its action) is on the page.
  const Page = () => h(MemoryRouter, { initialEntries: ['/elsewhere', path], initialIndex: 1, useTransitions: false },
    h(Probe),
    toasts ? h(ToastProvider, null, routes) : routes);
  const view = mount(Page, {});
  // The whole document: the issue view opens in a portal at the end of <body>.
  const all = (node = view.document.body) => [...elements(node)];
  const dialog = () => all().find((el) => el.getAttribute('role') === 'dialog');
  const inView = () => (dialog() ? all(dialog()) : []);
  const page = {
    view,
    all,
    dialog,
    /** The open issue view's name ('HOME-1 Fix the tap'), or null when none is open. */
    open: () => dialog()?.getAttribute('aria-label') ?? null,
    path: () => `${loc.pathname}${loc.search}`,
    byLabel: (label) => inView().find((el) => el.getAttribute('aria-label') === label),
    button: (text) => inView().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text),
    /** A button in the view whose text holds `text` (an epic's child row: key, summary, status). */
    buttonWith: (text) => inView().find((el) => el.tagName === 'BUTTON' && el.textContent.includes(text)),
    tab: (text) => inView().find((el) => el.getAttribute('role') === 'tab' && el.textContent.trim().startsWith(text)),
    byId: (id) => inView().find((el) => el.getAttribute('id') === id),
    /** A card on the board ('HOME-2 Paint the fence'). */
    card: (label) => all().find((el) => el.getAttribute('role') === 'button' && el.getAttribute('aria-label') === label),
    /** A menu's item (menus open in a portal of their own, outside the view). */
    item: (label) => all().find((el) => String(el.getAttribute('role')).startsWith('menuitem') && el.textContent.trim() === label),
    click: (el) => view.act(() => reactProps(el).onClick(ev())),
    /** A click on a link (`extra`: button, modifiers), which the router's Link follows unless its onClick prevented it. */
    clickLink: (el, extra = { button: 0 }) => {
      const e = ev(extra);
      view.act(() => reactProps(el).onClick(e));
      return e;
    },
    /** Types `html` into the description's editor, as its input event hands it on. */
    typeDescription: (html) => {
      const editor = page.byLabel('Description');
      editor.innerHTML = html;
      view.act(() => reactProps(editor).onInput(ev()));
    },
    /** Escape in the view, as its dialog's keydown handler gets it. */
    escape: () => {
      const root = dialog().parentNode.parentNode; // panel → overlay → the dialog's root, which listens
      view.act(() => reactProps(root).onKeyDown(ev({ key: 'Escape' })));
    },
    back: () => view.act(() => nav(-1)),
    async settle() { for (let i = 0; i < 5; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); } },
  };
  return page;
}

/** A key pressed at `target`, as the window's keydown listeners (useHotkeys) get it. */
export function press(view, key, target) {
  const event = {
    type: 'keydown', key, target, repeat: false, isComposing: false,
    shiftKey: false, metaKey: false, ctrlKey: false, altKey: false,
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
  };
  view.act(() => { view.window.dispatchEvent(event); });
  return event;
}
