// R4-DPH-05: on a 375px phone a project's Calendar grid is 48rem (768px) wide and pans sideways inside
// the page's scroller — and the Today / previous month / next month / month-title row sat in that same
// scroller, so it slid out of view as you panned toward the weekend, and you had to pan back to change
// the month. Now the controls row sits above the scroller, which holds only the grid: the grid keeps
// its 48rem and pans in its own box, as the board's columns do (the product call: no agenda view),
// and the controls stay on screen. The fake DOM has no layout, so the real page is rendered through
// Vite's loader (tests/pdf/harness.mjs) with react-dom/server, its markup read back as a tree
// (fake-dom's innerHTML), and the grid's nearest scroll box checked for the controls.
import { before, after, beforeEach, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { fakeWindow, elements, withInnerHtml } from './fake-dom.mjs';

let ProjectCalendar;
let store;
let BOARDS_KEY;
before(async () => {
  await setup();
  withInnerHtml();
  ({ ProjectCalendar } = await loadModule('/src/pages/ProjectCalendar.jsx'));
  store = await loadModule('/src/hooks/useBoardStore.js');
  ({ BOARDS_KEY } = await loadModule('/src/constants/boards.js'));
});
after(teardown);

/** localStorage over a Map — enough for the board store to load a saved list. */
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
const issue = (id, number, title, columnId, extra = {}) => ({ id, number, type: 'task', title, columnId, labelIds: [], checklist: [], ...extra });
/** One project whose issues have no due date, so the controls row carries its note too. */
const project = {
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1',
  columns: [col('c1', 'To Do'), col('c2', 'Done', 'done')],
  labels: [],
  sprints: [],
  issues: [issue('i1', 1, 'Fix the tap', 'c1'), issue('i2', 2, 'Paint the fence', 'c1')],
  nextNumber: 3,
};

/** The Calendar page of project p1, rendered as the app's route does and read back as a tree. */
function calendar() {
  globalThis.localStorage = new Storage([[BOARDS_KEY, JSON.stringify({ boards: [project], dataVersion: 2 })]]);
  store.subscribe(() => {});
  const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/boards/p1/calendar'] },
    createElement(Routes, null,
      createElement(Route, { path: '/boards/:id/calendar', element: createElement(ProjectCalendar) }))));
  const root = fakeWindow().document.createElement('div');
  root.innerHTML = html;
  return [...elements(root)];
}

const classes = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
/** A box that scrolls its content: overflow auto or scroll, both ways or sideways only. */
const scrolls = (el) => classes(el).some((c) => /^overflow(-x)?-(auto|scroll)$/.test(c));
/** The nearest ancestor of `el` that scrolls, or null. */
const scrollBoxOf = (el) => {
  for (let n = el.parentNode; n; n = n.parentNode) if (n.nodeType === 1 && scrolls(n)) return n;
  return null;
};

it('R4-DPH-05: the month grid pans in its own scroller, and Today / previous / next / the month are outside it', () => {
  const all = calendar();
  const grid = all.find((el) => el.getAttribute('role') === 'grid');
  assert.ok(grid, 'the month grid is on the page');
  const today = all.find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Today');
  const prev = all.find((el) => el.getAttribute('aria-label') === 'Previous month');
  const next = all.find((el) => el.getAttribute('aria-label') === 'Next month');
  const month = all.find((el) => el.tagName === 'H2' && `${el.textContent} calendar` === grid.getAttribute('aria-label'));
  const note = all.find((el) => el.tagName === 'SPAN' && el.textContent.trim().endsWith('no due date'));
  for (const [name, el] of Object.entries({ today, prev, next, month, note })) assert.ok(el, `the ${name} control is on the page`);
  assert.match(note.textContent, /2 issues have no due date/);

  // The grid keeps its width (no agenda view) and pans sideways in a box of its own.
  assert.ok(classes(grid).includes('min-w-[48rem]'), 'the grid keeps its 48rem width');
  const box = scrollBoxOf(grid);
  assert.ok(box, 'the grid sits in a scroll box');
  assert.ok(classes(box).includes('flex-1') && classes(box).includes('min-h-0'), 'the scroll box fills the rest of the page');

  // The month controls are not in it: panning the grid leaves them where they are.
  for (const [name, el] of Object.entries({ today, prev, next, month, note })) {
    assert.equal(box.contains(el), false, `the ${name} control is outside the grid's scroll box`);
    assert.equal(scrollBoxOf(el), null, `no box around the ${name} control scrolls it away`);
  }
});
