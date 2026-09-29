// R5-HUNT5-SWIMLANES-EMPTY-BOARD-SAYS-FILTERS: swimlanes hold only lanes with issues, so a board with
// no issues grouped by Epic, Priority or Issue type had no lane at all: it said "No issues match these
// filters." with no filter set, and showed no column to create an issue in. It now shows its columns,
// with "+ Create issue"; with a filter hiding every issue the swimlane view still says so.
// The real Board page and board store over tests/pdf/fake-dom.mjs, through Vite's loader.
// Run: node --test tests/pdf/106-r5-hunt5-swimlanes-empty-board.test.mjs
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

function mountBoard(board) {
  store._resetBoardStoreForTest();
  globalThis.localStorage = new Storage([[KEY, JSON.stringify({ boards: [board], dataVersion: 2 })]]);
  store.subscribe(() => {});
  const view = dom.mount(() => h(MemoryRouter, { initialEntries: ['/boards/p1'] },
    h(Routes, null, h(Route, { path: '/boards/:id', element: h(Board) }))), {});
  const all = () => [...dom.elements(view.document.body)];
  const button = (text) => all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text);
  const item = (text) => all().find((el) => String(el.getAttribute('role')).startsWith('menuitem') && el.textContent.trim() === text);
  const click = (el) => view.act(() => dom.reactProps(el).onClick(harness.ev()));
  const noMatch = () => all().some((el) => el.tagName === 'P' && el.textContent.includes('No issues match these filters.'));
  const creates = () => all().filter((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Create issue').length;
  const groupBy = (label) => { click(button('Group by: None')); click(item(label)); };
  const close = async () => {
    await view.unmount();
    store._resetBoardStoreForTest();
    delete globalThis.localStorage;
  };
  return { view, all, button, item, click, noMatch, creates, groupBy, close };
}

for (const label of ['Epic', 'Priority', 'Issue type']) {
  it(`Board grouped by ${label} with no issues shows its columns to create in, not "No issues match these filters."`, async () => {
    const page = mountBoard(project({ issues: [], nextNumber: 1 }));
    try {
      page.groupBy(label);
      assert.ok(page.button(`Group by: ${label}`), `grouped by ${label}`);
      assert.ok(!page.noMatch(), 'no filter is set: nothing to blame on filters');
      assert.equal(page.creates(), 3, 'each of the three columns offers "+ Create issue"');
    } finally {
      await page.close();
    }
  });
}

it('Board grouped by Priority with a filter hiding every issue still says so, with Clear filters', async () => {
  const page = mountBoard(project({ issues: [issue('i1', 1, 'Fix the tap', 'c1', { priority: 'medium' })], nextNumber: 2 }));
  try {
    page.groupBy('Priority');
    page.click(page.button('Priority'));
    page.click(page.all().find((el) => el.getAttribute('role') === 'option' && el.textContent.trim() === 'Highest'));
    assert.ok(page.noMatch(), 'the filter hides the one issue');
    assert.ok(page.button('Clear filters'), 'and offers a way out');
  } finally {
    await page.close();
  }
});
