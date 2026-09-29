// R5-HUNT6-TYPE-FILTER-NO-EPIC: the List and the Calendar show epics, but their toolbar's Type filter
// offered only Task, Bug and Story (BoardToolbar left Epic out for every view). An epic-only list
// could not be made, and ticking any type hid every epic with no way to bring them back. Now the
// List and the Calendar offer Epic too, and ticking it lists the epics alone; the Board, which
// shows no epics, still offers the three types. The real pages and board store are mounted with
// react-dom/client over tests/pdf/fake-dom.mjs, through Vite's loader. Fictional data only.
// Run: node --test tests/pdf/107-r5-hunt6-type-filter-epic.test.mjs
import { before, after, beforeEach, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom, ev } from '../unit/ui-dom-harness.mjs';

let pages;
let ToastProvider;
let store;
before(async () => {
  await setup();
  patchFakeDom();
  const { ProjectList } = await loadModule('/src/pages/ProjectList.jsx');
  const { ProjectCalendar } = await loadModule('/src/pages/ProjectCalendar.jsx');
  const { Board } = await loadModule('/src/pages/Board.jsx');
  pages = { ProjectList, ProjectCalendar, Board };
  ({ ToastProvider } = await loadModule('/src/components/ui/index.js'));
  store = await loadModule('/src/hooks/useBoardStore.js');
});
after(teardown);
beforeEach(() => { store._resetBoardStoreForTest(); });
afterEach(() => { delete globalThis.localStorage; });

class Storage {
  constructor(entries = []) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const col = (id, title, category = 'todo') => ({ id, title, category, wipLimit: null });
const issue = (id, number, title, columnId, extra = {}) => ({ id, number, type: 'task', title, columnId, labelIds: [], checklist: [], ...extra });
const project = () => ({
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1', mode: 'kanban', description: '',
  columns: [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')],
  labels: [],
  sprints: [],
  issues: [
    issue('i1', 1, 'Fix the tap', 'c1'),
    issue('e1', 2, 'Garden makeover', 'c1', { type: 'epic' }),
    issue('i3', 3, 'Paint the fence', 'c2', { type: 'bug' }),
  ],
  nextNumber: 4,
});

function mountPage(path, route, Page) {
  globalThis.localStorage = new Storage([['cpwtcv_boards_v2', JSON.stringify({ boards: [project()], dataVersion: 2 })]]);
  store.subscribe(() => {});
  const view = mount(() => h(MemoryRouter, { initialEntries: [path] },
    h(ToastProvider, null, h(Routes, null, h(Route, { path: route, element: h(Page) })))), {});
  const all = () => [...elements(view.document.body)];
  const click = (el) => view.act(() => reactProps(el).onClick(ev()));
  const typeButton = () => all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim().startsWith('Type'));
  /** The Type filter's options, opened from its button. */
  const typeOptions = () => {
    click(typeButton());
    const list = all().find((el) => el.getAttribute('role') === 'listbox' && el.getAttribute('aria-label') === 'Type');
    assert.ok(list, 'the Type filter opened');
    return [...elements(list)].filter((el) => el.getAttribute('role') === 'option');
  };
  return { view, all, click, typeOptions };
}

it('List: the Type filter offers Epic, and ticking it lists the epics alone', async () => {
  const page = mountPage('/boards/p1/list', '/boards/:id/list', pages.ProjectList);
  try {
    const options = page.typeOptions();
    assert.deepEqual(options.map((o) => o.textContent.trim()), ['Task', 'Bug', 'Story', 'Epic'], 'the List shows epics: Type offers Epic');
    page.click(options.find((o) => o.textContent.trim() === 'Epic'));
    const text = page.view.document.body.textContent;
    assert.match(text, /1 of 3 issues/, 'only the epic is listed');
    assert.match(text, /Garden makeover/);
    assert.ok(!text.includes('Fix the tap') && !text.includes('Paint the fence'), 'the task and the bug are filtered out');
  } finally { await page.view.unmount(); }
});

it('Calendar: the Type filter offers Epic too', async () => {
  const page = mountPage('/boards/p1/calendar', '/boards/:id/calendar', pages.ProjectCalendar);
  try {
    assert.deepEqual(page.typeOptions().map((o) => o.textContent.trim()), ['Task', 'Bug', 'Story', 'Epic']);
  } finally { await page.view.unmount(); }
});

it('Board: no epics show there, so Type still offers Task, Bug and Story only', async () => {
  const page = mountPage('/boards/p1', '/boards/:id', pages.Board);
  try {
    assert.deepEqual(page.typeOptions().map((o) => o.textContent.trim()), ['Task', 'Bug', 'Story']);
  } finally { await page.view.unmount(); }
});
