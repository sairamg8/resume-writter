// PERF-4, the board pages (docs/tracking/HANDOFF.md, follow-ups of 2026-10-06): Board and Backlog built
// their dnd-kit sensor options inline, so every render gave DndContext new sensors and woke every
// draggable under it, as the editor's lists did before KanbanView and EditorResumeTab fixed it. This pins that
// a re-render of either page (an issue edited in the store) hands DndContext the SAME sensors.
//
// How it looks (no component is edited or mocked): a React DevTools hook installed before react-dom loads
// is told of every commit; the walk finds the fiber that holds a `sensors` prop (DndContext) and keeps it.
// Fictional project.
import { before, after, beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const seen = [];
globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
  supportsFiber: true, isDisabled: false, renderers: new Map(),
  inject() { return 1; }, checkDCE() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, setStrictMode() {},
  onCommitFiberRoot(_id, root) {
    const visit = (f) => {
      if (f.memoizedProps && Array.isArray(f.memoizedProps.sensors)) seen.push(f.memoizedProps.sensors);
      for (let c = f.child; c; c = c.sibling) visit(c);
    };
    visit(root.current);
  },
};

const { setup, teardown, loadModule } = await import('./harness.mjs');
const dom = await import('./fake-dom.mjs');
const harness = await import('../unit/ui-dom-harness.mjs');

let store;
let Board;
let Backlog;
before(async () => {
  await setup();
  harness.patchFakeDom();
  store = await loadModule('/src/hooks/useBoardStore.js');
  ({ Board } = await loadModule('/src/pages/Board.jsx'));
  ({ Backlog } = await loadModule('/src/pages/Backlog.jsx'));
});
after(async () => { await teardown(); delete globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__; });

const KEY = 'cpwtcv_boards_v2';
class Storage {
  constructor(entries = []) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}
beforeEach(() => { store._resetBoardStoreForTest(); seen.length = 0; });
afterEach(() => { delete globalThis.localStorage; });

const col = (id, title, category = 'todo') => ({ id, title, category, wipLimit: null });
const issue = (id, number, title, columnId) => ({ id, number, type: 'task', title, columnId, labelIds: [], checklist: [] });
const project = () => ({
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1', mode: 'kanban',
  columns: [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')],
  labels: [], sprints: [],
  issues: [issue('i1', 1, 'Fix the tap', 'c1'), issue('i2', 2, 'Paint the fence', 'c2')],
  nextNumber: 3,
});

const tick = async () => { for (let n = 0; n < 5; n += 1) await new Promise((r) => { setImmediate(r); }); await new Promise((r) => { setTimeout(r, 0); }); };

/** The page at `path`, re-rendered by an edit of an issue's title in the store. */
async function rerendered(Page, path, route) {
  globalThis.localStorage = new Storage([[KEY, JSON.stringify({ boards: [project()], dataVersion: 2 })]]);
  store.subscribe(() => {});
  let actions = null;
  function Grab() { actions = store.useBoardStore(); return null; }
  const view = dom.mount(() => h(MemoryRouter, { initialEntries: [path] }, h(Routes, null, h(Route, { path: route, element: h('div', null, h(Page), h(Grab)) }))), {});
  await tick();
  assert.ok(seen.length >= 1, 'DndContext rendered with sensors');
  const before = seen.length;
  view.act(() => actions.updateIssue('p1', 'i1', { title: 'Fix the tap again' }));
  await tick();
  const first = seen[0];
  const after = seen.slice(before);
  await view.unmount();
  return { first, after };
}

describe('the board pages keep their dnd-kit sensors across renders (PERF-4)', () => {
  it('Board: an issue edit re-renders the page, and DndContext gets the same sensors', async () => {
    const { first, after } = await rerendered(Board, '/boards/p1', '/boards/:id');
    assert.ok(after.length >= 1, 'the page rendered again');
    for (const s of after) assert.equal(s, first, 'a new sensors array at a re-render wakes every card');
  });

  it('Backlog: an issue edit re-renders the page, and DndContext gets the same sensors', async () => {
    const { first, after } = await rerendered(Backlog, '/boards/p1/backlog', '/boards/:id/backlog');
    assert.ok(after.length >= 1, 'the page rendered again');
    for (const s of after) assert.equal(s, first, 'a new sensors array at a re-render wakes every row');
  });
});
