// R5-HUNT2-KANBAN-MOVE-TO-RANK-BY-SPRINT: a Kanban board shows the issues of every sprint in one
// column, but a card's ⋯ 'Move to' ranked the card against its own sprint group ({columnId,
// sprintId}): a backlog card moved into a column holding only a sprint's issues kept its old rank
// and landed above them, while a drop on the column's empty space put it at the bottom. Now 'Move
// to' puts the card at the bottom of the target column, as the drop does.
// The real Board page and board store over tests/pdf/fake-dom.mjs, through Vite's loader.
// Run: node --test tests/pdf/104-r5-hunt2-kanban-move-to-bottom.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { KEY, issue, project, sprint } from './104-r5-brd-helpers.mjs';

let dom;
let harness;
let store;
let Board;
before(async () => {
  await setup();
  dom = await import('./fake-dom.mjs');
  harness = await import('../unit/ui-dom-harness.mjs');
  harness.patchFakeDom();
  store = await loadModule('/src/hooks/useBoardStore.js');
  ({ Board } = await loadModule('/src/pages/Board.jsx'));
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

it('Kanban: Move to puts a backlog card below the column\'s cards of a sprint the project used before', async () => {
  // HOME-3 is in the backlog and first in the rank; HOME-1 and HOME-2 are in Doing, still in Sprint 1
  // from when the project was Scrum.
  const board = project({
    mode: 'kanban',
    sprints: [sprint('s1', 'Sprint 1', 'active')],
    issues: [
      issue('i3', 3, 'Buy nails', 'c1', { sprintId: null }),
      issue('i1', 1, 'Fix the tap', 'c2', { sprintId: 's1' }),
      issue('i2', 2, 'Paint the fence', 'c2', { sprintId: 's1' }),
    ],
  });
  store._resetBoardStoreForTest();
  globalThis.localStorage = new Storage([[KEY, JSON.stringify({ boards: [board], dataVersion: 2 })]]);
  store.subscribe(() => {});
  const view = dom.mount(() => h(MemoryRouter, { initialEntries: ['/boards/p1'] },
    h(Routes, null, h(Route, { path: '/boards/:id', element: h(Board) }))), {});
  const all = () => [...dom.elements(view.document.body)];
  const byLabel = (label, node) => (node ? [...dom.elements(node)] : all()).find((el) => el.getAttribute('aria-label') === label);
  const item = (label) => all().find((el) => String(el.getAttribute('role')).startsWith('menuitem') && el.textContent.trim() === label);
  const click = (el) => view.act(() => dom.reactProps(el).onClick(harness.ev()));
  try {
    click(byLabel('Card actions', byLabel('HOME-3 Buy nails')));
    click(item('Move to'));
    click(item('Doing'));
    const now = store.snapshot().boards.find((b) => b.id === 'p1');
    assert.deepEqual(now.issues.filter((i) => i.columnId === 'c2').map((i) => i.id), ['i1', 'i2', 'i3'],
      'the moved card is at the bottom of Doing, as a drop on the column puts it');
    assert.equal(now.issues.find((i) => i.id === 'i3').sprintId, null, 'still in the backlog');
  } finally {
    await view.unmount();
    store._resetBoardStoreForTest();
    delete globalThis.localStorage;
  }
});
