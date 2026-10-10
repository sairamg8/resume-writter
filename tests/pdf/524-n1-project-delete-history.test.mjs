// Defect: deleting a project from its Settings page pushed the projects list, so the history read
// [..., settings of the project, projects list]: Back from the list opened the settings of the project that was
// just deleted, as "This project doesn't exist". The list now takes the Settings page's place (replace), as the
// Job page's delete does (487-h4). The real Settings page and board store over tests/pdf/fake-dom.mjs, in a
// memory data router as the app's, under the kit's toast and confirm hosts. Fictional data only.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const KEY = 'cpwtcv_boards_v2';
const col = (id, title, category = 'todo') => ({ id, title, category, wipLimit: null });
const project = (id, key) => ({
  id, key, title: `Project ${key}`, color: '#6366f1', mode: 'kanban', description: '',
  columns: [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')],
  labels: [], sprints: [], issues: [], nextNumber: 1, hideDoneAfterDays: 14,
});

function memoryStorage(entries = []) {
  const map = new Map(entries);
  return {
    get length() { return map.size; }, key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k),
  };
}
const ev = (props = {}) => ({ preventDefault() {}, stopPropagation() {}, key: '', nativeEvent: {}, ...props });

it('deleting a project from its settings: the list takes the settings page\'s place, and Back leaves the project for where it was opened from', async () => {
  const dom = await import('./fake-dom.mjs');
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const { createElement: h } = await import('react');
  const { createMemoryRouter, RouterProvider, Routes, Route } = await import('react-router-dom');
  const { BoardSettings } = await loadModule('/src/pages/BoardSettings.jsx');
  const { ToastProvider, ConfirmProvider } = await loadModule('/src/components/ui/index.js');
  const store = await loadModule('/src/hooks/useBoardStore.js');
  globalThis.localStorage = memoryStorage([[KEY, JSON.stringify({ boards: [project('p1', 'HOME'), project('p2', 'WORK')], dataVersion: 2 })]]);
  globalThis.sessionStorage = memoryStorage();
  store._resetBoardStoreForTest();
  store.subscribe(() => {});

  const routes = () => h(ToastProvider, null, h(ConfirmProvider, null, h(Routes, null,
    h(Route, { path: '/', element: h('p', null, 'HOME PAGE') }),
    h(Route, { path: '/boards', element: h('p', null, 'PROJECT LIST') }),
    h(Route, { path: '/boards/:id/settings', element: h(BoardSettings) }))));
  const router = createMemoryRouter([{ path: '*', element: h(routes) }], { initialEntries: ['/', '/boards/p1/settings'], initialIndex: 1 });
  const view = dom.mount(() => h(RouterProvider, { router }), {});
  const all = (node = view.document.body) => [...dom.elements(node)];
  const settle = async () => {
    for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); }
    await new Promise((r) => { setTimeout(r, 30); });
    for (let i = 0; i < 10; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); }
  };
  const button = (label, node) => all(node).find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === label);
  try {
    await settle();
    view.act(() => dom.reactProps(button('Delete project')).onClick(ev()));
    await settle();
    view.act(() => dom.reactProps(button('Delete project', all().find((el) => el.getAttribute('role') === 'alertdialog'))).onClick(ev()));
    await settle();

    assert.equal(router.state.location.pathname, '/boards', 'on the projects list');
    assert.deepEqual(store.boardsNow().map((b) => b.id), ['p2'], 'the project is deleted');
    view.act(() => { router.navigate(-1); });
    await settle();
    assert.equal(router.state.location.pathname, '/', 'Back leaves for where the project was opened from, not for its deleted settings');
  } finally {
    await view.unmount();
    store._resetBoardStoreForTest();
    delete globalThis.localStorage;
    delete globalThis.sessionStorage;
  }
});
