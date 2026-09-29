// R5-HUNT2-STALE-EPIC-FILTER-AFTER-EPIC-DELETED (review): an epic ticked in the filter bar and then
// deleted filters nothing any more (boardQuery.liveFilters), but the Board page still counted its
// id as a filter set: with no card left it said "No issues match these filters." and offered
// "Clear filters" over a project that simply has no issues. It now reads the same live filters.
// The real Board page and board store over tests/pdf/fake-dom.mjs, through Vite's loader.
// Run: node --test tests/pdf/104-r5-hunt2-board-stale-filter.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { KEY, issue, project } from './104-r5-brd-helpers.mjs';

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

it('Board: an epic ticked and then deleted leaves no "No issues match these filters." on a project with no issues', async () => {
  const board = project({ issues: [issue('e1', 1, 'Garden makeover', 'c1', { type: 'epic' })], nextNumber: 2 });
  store._resetBoardStoreForTest();
  globalThis.localStorage = new Storage([[KEY, JSON.stringify({ boards: [board], dataVersion: 2 })]]);
  store.subscribe(() => {});
  const view = dom.mount(() => h(MemoryRouter, { initialEntries: ['/boards/p1'] },
    h(Routes, null, h(Route, { path: '/boards/:id', element: h(Board) }))), {});
  const all = () => [...dom.elements(view.document.body)];
  const button = (text) => all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text);
  const option = (text) => all().find((el) => el.getAttribute('role') === 'option' && el.textContent.trim() === text);
  const noMatch = () => all().some((el) => el.tagName === 'P' && el.textContent.includes('No issues match these filters.'));
  const click = (el) => view.act(() => dom.reactProps(el).onClick(harness.ev()));
  try {
    click(button('Epic'));
    click(option('Garden makeover'));
    assert.ok(noMatch(), 'ticked, the epic filters every card out, and the board says so');
    view.act(() => { store.boardActions.deleteIssue('p1', 'e1'); });
    assert.equal(store.snapshot().boards.find((b) => b.id === 'p1').issues.length, 0, 'the epic is deleted');
    assert.ok(!noMatch(), 'a deleted epic is no filter: an empty project is not "no match"');
    assert.ok(!button('Clear filters'), 'nothing to clear');
  } finally {
    await view.unmount();
    store._resetBoardStoreForTest();
    delete globalThis.localStorage;
  }
});
