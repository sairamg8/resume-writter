// R4-DPH-11: the board's "Add column" name field is 16 px on a touch screen. It was a raw <input>
// at text-sm (14 px) with no pointer-coarse size, so iOS Safari zoomed the whole page into it the
// moment it autofocused after a tap on "+" (the J-38 defect, tests/pdf/81-job-inputs-touch-text.test.mjs).
// The real Board page and the real board store are mounted with react-dom/client over fake-dom,
// through Vite's loader (tests/pdf/harness.mjs), as tests/pdf/82-board-ime-enter.test.mjs does.
// Run: node --test tests/pdf/103-r4-dph-11-add-column.test.mjs
import { before, after, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom, ev } from '../unit/ui-dom-harness.mjs';

let Board;
let store;
before(async () => {
  await setup();
  patchFakeDom();
  ({ Board } = await loadModule('/src/pages/Board.jsx'));
  store = await loadModule('/src/hooks/useBoardStore.js');
  store._resetBoardStoreForTest();
});
after(teardown);
afterEach(() => { delete globalThis.localStorage; });

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
const project = {
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1', mode: 'kanban', description: '',
  columns: [col('c1', 'To Do'), col('c2', 'Done', 'done')],
  labels: [], sprints: [],
  issues: [{ id: 'i1', number: 1, type: 'task', title: 'Fix the tap', columnId: 'c1', labelIds: [], checklist: [] }],
  nextNumber: 2, hideDoneAfterDays: 14,
};

const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

it('the Add column name field is 16 px on a touch screen (14 px with a mouse)', async () => {
  globalThis.localStorage = new Storage([['cpwtcv_boards_v2', JSON.stringify({ boards: [project], dataVersion: 2 })]]);
  store.subscribe(() => {});
  const Page = () => h(MemoryRouter, { initialEntries: ['/boards/p1'] }, h(Routes, null, h(Route, { path: '/boards/:id', element: h(Board) })));
  const view = mount(Page, {});
  try {
    const all = () => [...elements(view.document.body)];
    const add = all().find((el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === 'Add column');
    assert.ok(add, 'the board shows its "+" Add column button');
    view.act(() => reactProps(add).onClick(ev()));
    const input = all().find((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === 'Column name');
    assert.ok(input, 'a tap on "+" opens the Column name field');
    const cls = tokens(input);
    assert.ok(cls.includes('pointer-coarse:text-base'), `16 px on touch, or iOS zooms the page as it focuses: ${cls.join(' ')}`);
    assert.ok(cls.includes('text-sm'), 'still 14 px with a mouse, as the board around it');
  } finally { await view.unmount(); }
});
