// R5-HUNT3-list-backlog-create-hidden-by-filters-silent: R4-DUX-08 made the Board's column composer
// say "<KEY> created — hidden by your filters" (with Open) when the filters hide the new issue, but
// the List view's foot composer and each Backlog section's composer still added the issue in
// silence: no row showed and nothing was said, so the create looked like it failed. Pinned: both
// now show the same toast for a hidden issue, and none for an issue the filters match. The real
// pages and board store are mounted with react-dom/client over tests/pdf/fake-dom.mjs.
// Fictional data only.
import { before, after, beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom, ev } from '../unit/ui-dom-harness.mjs';

let ProjectList;
let Backlog;
let ToastProvider;
let store;
before(async () => {
  await setup();
  patchFakeDom();
  ({ ProjectList } = await loadModule('/src/pages/ProjectList.jsx'));
  ({ Backlog } = await loadModule('/src/pages/Backlog.jsx'));
  ({ ToastProvider } = await loadModule('/src/components/ui/index.js'));
  store = await loadModule('/src/hooks/useBoardStore.js');
});
after(teardown);
beforeEach(() => { store._resetBoardStoreForTest(); });
afterEach(() => { delete globalThis.localStorage; });

class Storage {
  constructor(entries = []) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const col = (id, title, category = 'todo') => ({ id, title, category, wipLimit: null });
const issue = (id, number, title, columnId) => ({ id, number, type: 'task', title, columnId, labelIds: [], checklist: [] });
const project = () => ({
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1', mode: 'kanban', description: '',
  columns: [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')],
  labels: [],
  sprints: [],
  issues: [issue('i1', 1, 'Fix the tap', 'c1'), issue('i2', 2, 'Paint the fence', 'c2')],
  nextNumber: 3,
});

function mountPage(path, route, Page) {
  globalThis.localStorage = new Storage([['cpwtcv_boards_v2', JSON.stringify({ boards: [project()], dataVersion: 2 })]]);
  store.subscribe(() => {});
  const App = () => h(MemoryRouter, { initialEntries: [path] },
    h(ToastProvider, null, h(Routes, null, h(Route, { path: route, element: h(Page) }))));
  const view = mount(App, {});
  const all = () => [...elements(view.document.body)];
  const settle = async () => { for (let i = 0; i < 5; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); } };
  const text = () => view.document.body.textContent;
  const button = (label) => all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === label);
  const search = (value) => {
    const input = all().find((el) => el.getAttribute('aria-label') === 'Search this project');
    assert.ok(input, 'the page has its search');
    view.act(() => reactProps(input).onChange(ev({ target: { value } })));
  };
  const create = async (summary) => {
    const open = button('Create issue');
    if (open) view.act(() => reactProps(open).onClick(ev()));
    const field = all().find((el) => el.getAttribute('aria-label') === 'Summary of the new issue');
    assert.ok(field, 'the composer opened');
    view.act(() => reactProps(field).onChange(ev({ target: { value: summary } })));
    view.act(() => reactProps(button('Create')).onClick(ev()));
    await settle();
  };
  return { view, settle, text, search, create };
}

for (const [name, path, route, page] of [
  ['List', '/boards/p1/list', '/boards/:id/list', () => ProjectList],
  ['Backlog', '/boards/p1/backlog', '/boards/:id/backlog', () => Backlog],
]) {
  describe(`R5-HUNT3: ${name} — an issue created while filters hide it`, () => {
    it('says it was made, hidden by the filters; a matching one needs no toast', async () => {
      const p = mountPage(path, route, page());
      try {
        await p.settle();
        p.search('fence');
        await p.settle();
        await p.create('Water the plants');
        assert.equal(store.snapshot().boards[0].issues.length, 3, 'the issue was made');
        assert.ok(p.text().includes('HOME-3 created — hidden by your filters'), 'a toast says the hidden issue was made');
        await p.create('Sand the fence');
        assert.ok(!p.text().includes('HOME-4 created'), 'an issue the filters match needs no toast');
      } finally { await p.view.unmount(); }
    });
  });
}
