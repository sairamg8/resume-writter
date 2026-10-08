// The board grouped into swimlanes pans sideways (every column is 272 px). Two things were meant to stay in view while it does,
// and neither could: (1) the "No issues match these filters." line sat inside the row that is as wide as all the columns together
// and was centred in that width, so on a phone (and with four or more columns on a laptop) it was off the screen with its
// "Clear filters" button; it now sits in the scroll box itself, as wide as the window. (2) A lane's heading is `sticky left-0`,
// but a flex child of the lane stretches to the lane's full width and a sticky box as wide as its parent cannot move: it panned
// away with the columns. `self-start` makes it as wide as its text, so it sticks at the left edge.
// The real Board page and board store over tests/pdf/fake-dom.mjs, through Vite's loader (as 106-r5-hunt5-swimlanes-empty-board).
// Run: node --test tests/pdf/279-cyc6-swimlane-sticky-stays-in-view.test.mjs
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
  const groupBy = (label) => { click(button('Group by: None')); click(item(label)); };
  const close = async () => {
    await view.unmount();
    store._resetBoardStoreForTest();
    delete globalThis.localStorage;
  };
  return { view, all, button, click, groupBy, close };
}

const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

it('the "No issues match these filters." line is not inside the row that is as wide as all the columns', async () => {
  const page = mountBoard(project({ issues: [issue('i1', 1, 'Fix the tap', 'c1', { priority: 'medium' })], nextNumber: 2 }));
  try {
    page.groupBy('Priority');
    page.click(page.button('Priority'));
    page.click(page.all().find((el) => el.getAttribute('role') === 'option' && el.textContent.trim() === 'Highest'));
    const line = page.all().find((el) => el.tagName === 'P' && el.textContent.includes('No issues match these filters.'));
    assert.ok(line, 'the filter hides the one issue, and the line says so');
    for (let node = line.parentNode; node && node.nodeType === 1; node = node.parentNode) {
      assert.ok(!tokens(node).includes('w-max'), `an ancestor <${node.tagName}> "${node.getAttribute('class')}" is as wide as every column together`);
    }
    assert.ok(page.button('Clear filters'), 'and offers a way out');
  } finally {
    await page.close();
  }
});

it('a lane heading that is sticky at the left edge is as wide as its text (self-start), so it can stick', async () => {
  const page = mountBoard(project({
    issues: [issue('i1', 1, 'Fix the tap', 'c1', { priority: 'medium' }), issue('i2', 2, 'Paint the fence', 'c2', { priority: 'highest' })],
    nextNumber: 3,
  }));
  try {
    page.groupBy('Priority');
    const headings = page.all().filter((el) => el.tagName === 'BUTTON' && el.hasAttribute('aria-expanded') && tokens(el).includes('sticky'));
    assert.ok(headings.length >= 2, `one heading per lane (${headings.length})`);
    for (const heading of headings) {
      assert.ok(tokens(heading).includes('left-0'), 'it sticks at the left edge');
      assert.ok(tokens(heading).includes('self-start'), `a stretched sticky box cannot move: ${heading.getAttribute('class')}`);
    }
  } finally {
    await page.close();
  }
});
