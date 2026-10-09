// On /boards the Create project button wrote ?create=1 by REPLACING the history entry and the new board
// replaced it again, so Back from the new board skipped the Projects list (it went to the page before it).
// Now the create step opened from the list is an entry of its own: Back from the new board returns to
// the Projects list, and Cancel steps back to the list without leaving a second entry of it. A link from
// another page (?create=1: the sidebar, the top bar, Your work) has no list entry to keep: the new board
// still replaces the create step and Back goes to that page, and Cancel there stays a replace.
// The real Boards page, dialog and board store over fake-dom, in a memory data router as the app's.
// Run: node --test tests/pdf/343-cyc8-boards-create-back-to-list.test.mjs
import { before, after, beforeEach, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom, ev } from '../unit/ui-dom-harness.mjs';

let Boards;
let store;
before(async () => {
  await setup();
  patchFakeDom();
  ({ Boards } = await loadModule('/src/pages/Boards.jsx'));
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
afterEach(() => { delete globalThis.localStorage; });

const col = (id, title, category = 'todo') => ({ id, title, category, wipLimit: null });
const project = () => ({
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1', mode: 'kanban', description: '',
  columns: [col('c1', 'To Do'), col('c2', 'Done', 'done')],
  labels: [], sprints: [], issues: [], nextNumber: 1, hideDoneAfterDays: 14,
});

const settle = async () => { for (let i = 0; i < 10; i += 1) await new Promise((r) => { setImmediate(r); }); };

/** /boards in a data router whose history is `entries` (the last one is where the page is). */
async function openBoards(entries) {
  const { createMemoryRouter, RouterProvider } = await import('react-router-dom');
  globalThis.localStorage = new Storage([['cpwtcv_boards_v2', JSON.stringify({ boards: [project()], dataVersion: 2 })]]);
  store.subscribe(() => {});
  const router = createMemoryRouter([
    { path: '/work', element: h('p', null, 'YOUR WORK') },
    { path: '/boards', element: h(Boards) },
    { path: '/boards/:id', element: h('p', null, 'THE BOARD') },
  ], { initialEntries: entries, initialIndex: entries.length - 1 });
  const view = mount(() => h(RouterProvider, { router }), {});
  await settle();
  const all = () => [...elements(view.document.body)];
  const button = (label) => all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === label);
  const field = (label) => {
    const tag = all().find((el) => el.tagName === 'LABEL' && el.textContent.startsWith(label));
    return tag && all().find((el) => el.tagName === 'INPUT' && el.getAttribute('id') === tag.getAttribute('for'));
  };
  return {
    view,
    router,
    at: () => `${router.state.location.pathname}${router.state.location.search}`,
    async click(label) {
      const el = button(label);
      assert.ok(el, `a ${label} button`);
      view.act(() => { reactProps(el).onClick(ev()); });
      await settle();
    },
    /** Types a name in the open dialog and submits its form. */
    async createNamed(name) {
      view.act(() => reactProps(field('Name')).onChange(ev({ target: { value: name } })));
      await settle();
      const form = all().find((el) => el.tagName === 'FORM');
      view.act(() => reactProps(form).onSubmit(ev()));
      await settle();
    },
    async back() { view.act(() => { router.navigate(-1); }); await settle(); },
    async close() { await view.unmount(); },
  };
}

it('Create project on the list opens the create step as an entry of its own', async () => {
  const page = await openBoards(['/work', '/boards']);
  try {
    assert.equal(page.at(), '/boards');
    await page.click('Create project');
    assert.equal(page.at(), '/boards?create=1');
    assert.equal(page.router.state.historyAction, 'PUSH', 'a new entry, not a replace of the list');
  } finally { await page.close(); }
});

it('Back from the new board returns to the Projects list, not to the page before it', async () => {
  const page = await openBoards(['/work', '/boards']);
  try {
    await page.click('Create project');
    await page.createNamed('Garden');
    assert.match(page.at(), /^\/boards\/[^?]+$/, 'on the new board');
    assert.match(page.view.container.textContent, /THE BOARD/);
    await page.back();
    assert.equal(page.at(), '/boards', 'the list, with the create step gone');
    await page.back();
    assert.equal(page.at(), '/work', 'then the page before the list');
  } finally { await page.close(); }
});

it('Cancel steps back to the list, leaving no second entry of it', async () => {
  const page = await openBoards(['/work', '/boards']);
  try {
    await page.click('Create project');
    await page.click('Cancel');
    assert.equal(page.at(), '/boards', 'the dialog is closed');
    await page.back();
    assert.equal(page.at(), '/work', 'one Back from the list leaves it');
  } finally { await page.close(); }
});

it('a link from another page (?create=1) still opens the dialog, and its new board replaces that entry', async () => {
  const page = await openBoards(['/work', '/boards?create=1']);
  try {
    assert.ok(page.button('Cancel'), 'the dialog is open');
    await page.createNamed('Garden');
    assert.match(page.at(), /^\/boards\/[^?]+$/);
    await page.back();
    assert.equal(page.at(), '/work', 'Back goes to the page the link was on');
  } finally { await page.close(); }
});

it('Cancel on a dialog opened by another page\'s link replaces the entry, as before', async () => {
  const page = await openBoards(['/work', '/boards?create=1']);
  try {
    await page.click('Cancel');
    assert.equal(page.at(), '/boards');
    await page.back();
    assert.equal(page.at(), '/work');
  } finally { await page.close(); }
});
