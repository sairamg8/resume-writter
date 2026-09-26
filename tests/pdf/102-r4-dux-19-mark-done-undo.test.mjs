// R4-DUX-19: on "Your work", the ✓ on a row moved its issue into the project's done column and the
// row dropped out of the list at once, with no word of it and no way back. Now a toast says
// "<KEY> marked done" and its Undo puts the issue back in the column it came from, at its old place
// in the rank (an epic next to it included), unresolved, and the row is back in its section.
// The real page and board store under the UI kit's ToastProvider, with react-dom/client over
// tests/pdf/fake-dom.mjs (as tests/pdf/82-your-work-page.test.mjs mounts it). Fictional data only.
import { before, after, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

const KEY = 'cpwtcv_boards_v2';

let YourWork;
let ToastProvider;
let store;
before(async () => {
  await setup();
  ({ YourWork } = await loadModule('/src/pages/YourWork.jsx'));
  ({ ToastProvider } = await loadModule('/src/components/ui/index.js'));
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

afterEach(() => { delete globalThis.localStorage; store._resetBoardStoreForTest(); });

const col = (id, title, category = 'todo') => ({ id, title, category, wipLimit: null });
const issue = (id, number, title, columnId, extra = {}) => ({ id, number, type: 'task', title, columnId, labelIds: [], checklist: [], updatedAt: number, ...extra });
const columns = [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')];

it('✓ says "<KEY> marked done"; its Undo puts the issue back in its column, at its place in the rank', async () => {
  store._resetBoardStoreForTest();
  const board = {
    id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1', mode: 'kanban', columns, labels: [], sprints: [], nextNumber: 6,
    issues: [
      issue('a', 1, 'Sand the door', 'c2'),
      issue('b', 2, 'Paint the fence', 'c2'),
      issue('e', 3, 'Garden makeover', 'c2', { type: 'epic' }), // in the rank, though not on the list
      issue('c', 4, 'Oil the hinges', 'c2'),
      issue('d', 5, 'Fix the tap', 'c3', { resolvedAt: 1 }), // so the done move takes b to the end of the rank
    ],
  };
  globalThis.localStorage = new Storage([[KEY, JSON.stringify({ boards: [board], dataVersion: 2 })]]);
  store.subscribe(() => {});
  const dom = await import('./fake-dom.mjs');
  const harness = await import('../unit/ui-dom-harness.mjs');
  harness.patchFakeDom();
  const view = dom.mount(() => h(ToastProvider, null, h(MemoryRouter, { initialEntries: ['/work'] },
    h(Routes, null, h(Route, { path: '/work', element: h(YourWork) })))), {});
  // The whole document: the toast stack is in a portal at the end of <body>.
  const all = () => [...dom.elements(view.document.body)];
  const byLabel = (label) => all().find((el) => el.getAttribute('aria-label') === label);
  const button = (text) => all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text);
  const toasts = () => all().filter((el) => el.getAttribute('data-toast') !== null).map((el) => el.textContent);
  // The In progress rows, sorted (the section lists the latest update first).
  const rows = () => all().filter((el) => el.tagName === 'LI').map((el) => el.getAttribute('data-issue')).sort();
  const click = (el) => view.act(() => dom.reactProps(el).onClick({ stopPropagation() {}, preventDefault() {}, key: '' }));
  const issues = () => store.snapshot().boards[0].issues;
  try {
    assert.deepEqual(rows(), ['a', 'b', 'c']);
    click(byLabel('Mark HOME-2 done'));
    assert.equal(issues().find((i) => i.id === 'b').columnId, 'c3', 'into the done column');
    assert.deepEqual(issues().map((i) => i.id), ['a', 'e', 'c', 'd', 'b'], 'after the done column\'s last issue');
    assert.ok(!rows().includes('b'), 'off the list');
    assert.ok(toasts().some((t) => t.includes('HOME-2 marked done')), `a toast names it: ${JSON.stringify(toasts())}`);

    const undo = button('Undo');
    assert.ok(undo, 'the toast offers Undo');
    click(undo);
    const back = issues().find((i) => i.id === 'b');
    assert.equal(back.columnId, 'c2', 'back in the column it came from');
    assert.equal(back.resolvedAt ?? null, null, 'no longer resolved');
    assert.deepEqual(issues().map((i) => i.id), ['a', 'b', 'e', 'c', 'd'], 'at its old place in the rank');
    assert.deepEqual(rows(), ['a', 'b', 'c'], 'and back on the list');
  } finally {
    await view.unmount();
  }
});
