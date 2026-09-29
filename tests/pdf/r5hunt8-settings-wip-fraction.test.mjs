// R5-HUNT8-SETTINGS-WIP-FRACTION-CLEARS-LIMIT: Project settings → Columns → WIP. Typing 2.5 over a
// limit of 3 removed the column's limit (wipOf took any non-integer for "none"), while the board's own
// limit dialog saved the same entry as 2. A fraction now rounds down wherever it is typed; and text
// the number field cannot read ('2,5' in Firefox or Safari, reported as '' with badInput) keeps the
// saved limit instead of clearing it.
// The real BoardSettings page and board store are mounted over fake-dom, as
// tests/pdf/82-board-ime-enter.test.mjs does.
import { before, after, beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom, ev } from '../unit/ui-dom-harness.mjs';

let BoardSettings;
let store;
let ops;
before(async () => {
  await setup();
  patchFakeDom();
  ({ BoardSettings } = await loadModule('/src/pages/BoardSettings.jsx'));
  store = await loadModule('/src/hooks/useBoardStore.js');
  ops = await loadModule('/src/utils/boardOps.js');
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

const project = () => ({
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1', mode: 'kanban', description: '',
  columns: [
    { id: 'c1', title: 'To Do', category: 'todo', wipLimit: 3 },
    { id: 'c2', title: 'Done', category: 'done', wipLimit: null },
  ],
  labels: [], sprints: [], issues: [], nextNumber: 1, hideDoneAfterDays: 14,
});
const limitNow = () => store.snapshot().boards.find((b) => b.id === 'p1').columns[0].wipLimit;

function settings() {
  globalThis.localStorage = new Storage([['cpwtcv_boards_v2', JSON.stringify({ boards: [project()], dataVersion: 2 })]]);
  store.subscribe(() => {});
  const Page = () => h(MemoryRouter, { initialEntries: ['/boards/p1/settings'] },
    h(Routes, null, h(Route, { path: '/boards/:id/settings', element: h(BoardSettings) })));
  const view = mount(Page, {});
  const field = () => [...elements(view.document.body)].find((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === 'WIP limit');
  const target = (v, badInput) => ({ value: v, validity: { badInput } });
  const fire = (name, t, extra = {}) => view.act(() => reactProps(field())[name](ev({ target: t, currentTarget: t, ...extra })));
  return {
    view,
    field,
    type: (v, badInput = false) => fire('onChange', target(v, badInput)),
    blur: (v, badInput = false) => fire('onBlur', target(v, badInput)),
    enter: (v, badInput = false) => fire('onKeyDown', target(v, badInput), { key: 'Enter' }),
  };
}

describe('A column WIP limit typed as a fraction (R5-HUNT8-SETTINGS-WIP-FRACTION-CLEARS-LIMIT)', () => {
  it('2.5 in Project settings saves 2, as the board limit dialog does', async () => {
    const s = settings();
    try {
      assert.ok(s.field(), 'the settings page shows the WIP field');
      assert.equal(limitNow(), 3);
      s.type('2.5');
      s.blur('2.5');
      assert.equal(limitNow(), 2, 'the fraction removed the column limit');
    } finally { await s.view.unmount(); }
  });

  it('text the field cannot read (2,5 reported as "" with badInput) keeps the limit, on Tab or Enter', async () => {
    const s = settings();
    try {
      s.type('', true);
      s.blur('', true);
      assert.equal(limitNow(), 3, 'the unreadable entry cleared the column limit');
      s.type('', true);
      s.enter('', true);
      assert.equal(limitNow(), 3, 'Enter on an unreadable entry cleared the column limit');
    } finally { await s.view.unmount(); }
  });

  it('emptying the field still removes the limit', async () => {
    const s = settings();
    try {
      s.type('');
      s.blur('');
      assert.equal(limitNow(), null);
    } finally { await s.view.unmount(); }
  });

  it('the store rounds a fraction down and keeps "none" for less than 1', () => {
    const b = project();
    assert.equal(ops.updateColumn(b, 'c1', { wipLimit: '2.5' }).columns[0].wipLimit, 2);
    assert.equal(ops.updateColumn(b, 'c1', { wipLimit: 4.9 }).columns[0].wipLimit, 4);
    assert.equal(ops.updateColumn(b, 'c1', { wipLimit: '0.5' }).columns[0].wipLimit, null);
    assert.equal(ops.updateColumn(b, 'c1', { wipLimit: 'abc' }).columns[0].wipLimit, null);
  });
});
