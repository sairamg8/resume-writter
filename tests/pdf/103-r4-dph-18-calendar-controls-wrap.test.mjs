// R4-DPH-18: on a 375px phone, when some of a project's filtered issues have no due date, the
// Calendar's controls row (Today, previous and next month, the month's name, then "N issues have no
// due date" pushed right with ml-auto) could not wrap: the month's name and the note were squeezed
// side by side into a word or two per line each. Now the row wraps, the note takes a line of its own
// under the controls on a phone (w-full) and goes back to the right of the row from 640px (sm:),
// and the month's name never breaks. The fake DOM has no layout, so the real page is rendered through
// Vite's loader (tests/pdf/harness.mjs) with react-dom/server, its markup read back as a tree
// (fake-dom's innerHTML), and the classes that make the layout checked.
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
/** One project with an issue due on a set day and one with no due date. */
const project = {
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1',
  columns: [col('c1', 'To Do'), col('c2', 'Done', 'done')],
  labels: [],
  sprints: [],
  issues: [issue('i1', 1, 'Fix the tap', 'c1', { due: '2030-01-02' }), issue('i2', 2, 'Paint the fence', 'c1')],
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

it('R4-DPH-18: the controls row wraps, the no-due-date note takes its own line on a phone, and the month never breaks', () => {
  const all = calendar();
  const grid = all.find((el) => el.getAttribute('role') === 'grid');
  const today = all.find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Today');
  const month = all.find((el) => el.tagName === 'H2' && `${el.textContent} calendar` === grid?.getAttribute('aria-label'));
  const note = all.find((el) => el.tagName === 'SPAN' && el.textContent.trim().endsWith('no due date'));
  for (const [name, el] of Object.entries({ grid, today, month, note })) assert.ok(el, `the ${name} is on the page`);
  assert.equal(note.textContent.trim(), '1 issue has no due date');

  // The row the controls and the note share wraps instead of squeezing them.
  const row = today.parentNode;
  assert.ok(row.contains(month) && row.contains(note), 'the month and the note are in the Today button\'s row');
  assert.ok(classes(row).includes('flex-wrap'), `the controls row wraps: ${row.getAttribute('class')}`);
  assert.ok(!classes(row).includes('flex-nowrap'));

  // On a phone the note is a line of its own; from 640px it sits at the row's right end, as before.
  const n = classes(note);
  assert.ok(n.includes('w-full'), `the note takes the row's full width on a phone: ${note.getAttribute('class')}`);
  assert.ok(n.includes('sm:w-auto') && n.includes('sm:ml-auto'), 'from 640px the note is pushed to the right, at its own width');
  assert.ok(!n.includes('ml-auto'), 'no bare ml-auto squeezing the note beside the month on a phone');

  // The month's name stays on one line: it moves down whole rather than breaking.
  assert.ok(classes(month).includes('whitespace-nowrap'), `the month's name never breaks: ${month.getAttribute('class')}`);
});
