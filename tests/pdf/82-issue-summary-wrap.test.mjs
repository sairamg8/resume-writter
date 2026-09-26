// An issue whose summary is one long word — a pasted URL — opened in the issue view (B-29b). The
// summary is an InlineEdit in the view's h2, a block as wide as the left column; a word longer
// than that ran past its box, and the issue view scrolled sideways. The summary now carries
// break-words, so the browser wraps the word at the column's edge. The real board page and store
// are mounted with react-dom/client over fake-dom, as tests/pdf/82-board-summary-labels.test.mjs
// does; fake-dom has no layout, so the class the browser wraps by is what is checked (as
// tests/unit/board-checklist-wrap.unit.mjs does for a checklist item, B-29).
import { before, after, beforeEach, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

let Board;
let store;
before(async () => {
  await setup();
  ({ Board } = await loadModule('/src/pages/Board.jsx'));
  store = await loadModule('/src/hooks/useBoardStore.js');
});
after(teardown);

/** localStorage, in memory. */
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

const URL_TITLE = 'https://example.com/a/very/long/path/that/never/breaks/because/it/has/no/spaces/at/all?and=a&query=string&that=goes&on=and&on';

const col = (id, title, category = 'todo') => ({ id, title, category, wipLimit: null });
const issue = (id, number, title, columnId) => ({ id, number, type: 'task', title, columnId, labelIds: [], checklist: [] });
const project = () => ({
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1',
  columns: [col('c1', 'To Do'), col('c2', 'Done', 'done')],
  labels: [],
  sprints: [],
  issues: [issue('i1', 1, URL_TITLE, 'c1')],
  nextNumber: 2,
});

/** The board page at `path`, mounted over fake-dom; the issue view opens in a portal at the end of <body>. */
async function mountBoard(path) {
  globalThis.localStorage = new Storage([['cpwtcv_boards_v2', JSON.stringify({ boards: [project()], dataVersion: 2 })]]);
  store.subscribe(() => {});
  const dom = await import('./fake-dom.mjs');
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const Page = () => createElement(MemoryRouter, { initialEntries: [path] },
    createElement(Routes, null, createElement(Route, { path: '/boards/:id', element: createElement(Board) })));
  const view = dom.mount(Page, {});
  const all = () => [...dom.elements(view.document.body)];
  return {
    view,
    /** The issue view's summary: the button whose text is the summary and its ", edit Summary" hint. */
    summary: (title) => all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === `${title}, edit Summary`),
  };
}

/** The classes of `el`, as a set. */
const classes = (el) => new Set((el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean));

it('B-29b: a summary that is one long word (a pasted URL) wraps in the issue view instead of running past it', async () => {
  const page = await mountBoard('/boards/p1?issue=HOME-1');
  try {
    const summary = page.summary(URL_TITLE);
    assert.ok(summary, 'the issue view did not show the summary');
    assert.equal(summary.parentNode.tagName, 'H2', 'the summary is the view\'s heading');
    const got = classes(summary);
    assert.ok(got.has('block'), 'the summary is a block as wide as its column');
    assert.ok(got.has('break-words'), 'without break-words the URL runs past the column and the view scrolls sideways');
    assert.ok(got.has('text-2xl'), 'still the heading\'s size');
  } finally {
    await page.view.unmount();
  }
});
