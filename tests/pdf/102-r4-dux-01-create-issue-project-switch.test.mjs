// R4-DUX-01: in the Create issue dialog, picking another Project wiped everything typed so far
// (the form was keyed by the project, so it remounted and started afresh). The fields any project
// can hold (summary, type, priority, points, dates, description) now stay; only the status,
// labels, epic and sprint start again from the new project's defaults. The real dialog and board
// store are mounted with react-dom/client over tests/pdf/fake-dom.mjs, as
// tests/pdf/82-board-ime-enter.test.mjs does. Fictional data only.
import { before, after, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom, ev } from '../unit/ui-dom-harness.mjs';

let CreateIssueDialog;
let store;
before(async () => {
  await setup();
  patchFakeDom();
  ({ CreateIssueDialog } = await loadModule('/src/components/board/CreateIssueDialog.jsx'));
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
afterEach(() => { delete globalThis.localStorage; });

const col = (id, title, category = 'todo') => ({ id, title, category, wipLimit: null });
const project = (id, key, title, columns) => ({
  id, key, title, color: '#6366f1', mode: 'kanban', description: '',
  columns, labels: [], sprints: [], issues: [], nextNumber: 1, hideDoneAfterDays: 14,
});
const boards = () => [
  project('p1', 'HOME', 'Home jobs', [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')]),
  // The new project's default status is its first to-do column, not its first column.
  project('p2', 'GARD', 'Garden', [col('d1', 'Doing', 'inprogress'), col('d2', 'Queue'), col('d3', 'Done', 'done')]),
];
const boardNow = (id) => store.snapshot().boards.find((b) => b.id === id);

const all = (view) => [...elements(view.document.body)];
/** The control a <label> starting with `text` points at. */
const labelled = (view, tag, text) => {
  const els = all(view);
  const label = els.find((el) => el.tagName === 'LABEL' && el.textContent.startsWith(text));
  return label && els.find((el) => el.tagName === tag && el.getAttribute('id') === label.getAttribute('for'));
};
const named = (view, tag, label) => all(view).find((el) => el.tagName === tag && el.getAttribute('aria-label') === label);
const change = (view, el, value) => view.act(() => reactProps(el).onChange(ev({ target: { value } })));

it('switching project keeps the typed summary and dates, and takes the new project\'s status', async () => {
  store._resetBoardStoreForTest();
  globalThis.localStorage = new Storage([['cpwtcv_boards_v2', JSON.stringify({ boards: boards(), dataVersion: 2 })]]);
  store.subscribe(() => {});
  const view = mount(() => h(MemoryRouter, null, h(CreateIssueDialog, { open: true, defaults: { boardId: 'p1' }, onClose: () => {} })), {});
  try {
    const summary = () => labelled(view, 'INPUT', 'Summary');
    assert.ok(summary(), 'the dialog shows its Summary');
    change(view, summary(), 'Prune the apple tree');
    change(view, named(view, 'SELECT', 'Status'), 'c2');
    change(view, named(view, 'INPUT', 'Due date'), '2026-10-15');

    change(view, labelled(view, 'SELECT', 'Project'), 'p2');

    assert.equal(reactProps(labelled(view, 'SELECT', 'Project')).value, 'p2', 'the project changed');
    assert.equal(reactProps(summary()).value, 'Prune the apple tree', 'switching project wiped the summary');
    assert.equal(reactProps(named(view, 'SELECT', 'Status')).value, 'd2', 'the status is the new project\'s default');

    view.act(() => reactProps(summary()).onKeyDown(ev({ key: 'Enter' })));
    assert.equal(boardNow('p1').issues.length, 0, 'nothing was made in the old project');
    const made = boardNow('p2').issues;
    assert.equal(made.length, 1, 'the issue was made in the new project');
    assert.equal(made[0].title, 'Prune the apple tree');
    assert.equal(made[0].columnId, 'd2');
    assert.equal(made[0].due, '2026-10-15', 'switching project wiped the due date');
  } finally { await view.unmount(); }
});
