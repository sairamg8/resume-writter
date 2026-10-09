// The List view's foot composer ("+ Create issue") made the issue with no sprint, so on a Scrum project with a running sprint it landed in
// the backlog and was not on the Board, while the Board's column composer and the Create dialog put it in the active sprint. The List
// now does what they do: the active sprint when the project runs sprints and one is running; otherwise no sprint (a Kanban project
// whose old sprint is still running, or a Scrum project with none running, keeps it in the backlog). The old UI (00c7283) made it with
// no sprint, in a List that had no sprints to speak of; the owner's direction was to follow the Create dialog.
// The real List page and board store over tests/pdf/fake-dom.mjs, as tests/pdf/105-r5-hunt3-list-backlog-hidden-create.test.mjs mounts it.
// Run: node --test tests/pdf/361-cyc8-list-create-in-active-sprint.test.mjs
import { before, after, beforeEach, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom, ev } from '../unit/ui-dom-harness.mjs';

let ProjectList;
let ToastProvider;
let store;
before(async () => {
  await setup();
  patchFakeDom();
  ({ ProjectList } = await loadModule('/src/pages/ProjectList.jsx'));
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
const issue = (id, number, title, columnId) => ({ id, number, type: 'task', title, columnId, labelIds: [], checklist: [] });
const sprint = (id, name, state) => ({ id, name, goal: '', startDate: '', endDate: '', state, completedAt: null });
const project = (extra) => ({
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1', mode: 'kanban', description: '',
  columns: [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')],
  labels: [],
  sprints: [],
  issues: [issue('i1', 1, 'Fix the tap', 'c1')],
  nextNumber: 2,
  ...extra,
});

/** Creates "Water the plants" from the List of `board` and returns the issue the store made. */
async function createInList(board) {
  globalThis.localStorage = new Storage([['cpwtcv_boards_v2', JSON.stringify({ boards: [board], dataVersion: 2 })]]);
  store.subscribe(() => {});
  const App = () => h(MemoryRouter, { initialEntries: ['/boards/p1/list'] },
    h(ToastProvider, null, h(Routes, null, h(Route, { path: '/boards/:id/list', element: h(ProjectList) }))));
  const view = mount(App, {});
  try {
    const all = () => [...elements(view.document.body)];
    const button = (label) => all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === label);
    view.act(() => reactProps(button('Create issue')).onClick(ev()));
    const field = all().find((el) => el.getAttribute('aria-label') === 'Summary of the new issue');
    assert.ok(field, 'the composer opened');
    view.act(() => reactProps(field).onChange(ev({ target: { value: 'Water the plants' } })));
    view.act(() => reactProps(button('Create')).onClick(ev()));
    for (let i = 0; i < 5; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); }
    const made = store.snapshot().boards.find((b) => b.id === 'p1').issues.find((i) => i.title === 'Water the plants');
    assert.ok(made, 'the issue was made');
    return made;
  } finally {
    await view.unmount();
  }
}

it('Scrum with a running sprint: an issue made in the List is in that sprint, so it is on the Board', async () => {
  const made = await createInList(project({ mode: 'scrum', sprints: [sprint('s1', 'Sprint 1', 'active'), sprint('s2', 'Sprint 2', 'future')] }));
  assert.equal(made.sprintId, 's1');
});

it('Scrum with no running sprint: it goes to the backlog', async () => {
  const made = await createInList(project({ mode: 'scrum', sprints: [sprint('s2', 'Sprint 2', 'future')] }));
  assert.equal(made.sprintId ?? null, null);
});

it('Kanban, even with a sprint left running from when it used sprints: it goes to the backlog, as on the Board', async () => {
  const made = await createInList(project({ mode: 'kanban', sprints: [sprint('s1', 'Sprint 1', 'active')] }));
  assert.equal(made.sprintId ?? null, null);
});
