// Typing Chinese, Japanese or Korean in the rest of the board's fields (B-20b). An input method
// composes a word over several keys and Enter picks it, so the Enter that ends a composition is the
// input method's. B-20 taught the checklist's "Add an item" and a column's "+ Create issue" to wait
// (tests/unit/board-ime-enter.unit.mjs); these fields still took that Enter as their own and saved,
// added or submitted the half-typed text: the Create issue dialog's Summary, the board's "Add
// column", the Settings page's fields and Add rows, the Labels picker's search (which also created
// the label), and Story points. InlineEdit waited on isComposing but not on Safari's Enter, which
// comes after compositionend with isComposing false and says so only with keyCode 229.
// The real components and the real board store are mounted with react-dom/client over fake-dom,
// through Vite's loader (tests/pdf/harness.mjs), as tests/pdf/82-board-summary-labels.test.mjs does.
// Run: node --test tests/pdf/82-board-ime-enter.test.mjs
import { before, after, beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom, ev, byAttr, byText } from '../unit/ui-dom-harness.mjs';

let ui;
let PointsInput;
let CreateIssueDialog;
let Board;
let BoardSettings;
let store;
before(async () => {
  await setup();
  patchFakeDom();
  ui = await loadModule('/src/components/ui/index.js');
  ({ PointsInput } = await loadModule('/src/components/board/IssueFields.jsx'));
  ({ CreateIssueDialog } = await loadModule('/src/components/board/CreateIssueDialog.jsx'));
  ({ Board } = await loadModule('/src/pages/Board.jsx'));
  ({ BoardSettings } = await loadModule('/src/pages/BoardSettings.jsx'));
  store = await loadModule('/src/hooks/useBoardStore.js');
});
after(teardown);

/** The keystrokes an input method sends while a word is still being composed. */
const composing = {
  'Enter with isComposing (Chrome, Firefox)': { key: 'Enter', nativeEvent: { isComposing: true } },
  'Enter with keyCode 229 (Safari)': { key: 'Enter', keyCode: 229 },
};

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

const col = (id, title, category = 'todo') => ({ id, title, category, wipLimit: null });
const issue = (id, number, title, columnId) => ({ id, number, type: 'task', title, columnId, labelIds: [], checklist: [] });
const project = () => ({
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1', mode: 'kanban', description: '',
  columns: [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')],
  labels: [{ id: 'l1', name: 'Urgent', color: '#ef4444' }],
  sprints: [],
  issues: [issue('i1', 1, 'Fix the tap', 'c1'), issue('i2', 2, 'Paint the fence', 'c2')],
  nextNumber: 3, hideDoneAfterDays: 14,
});

/** Storage holding the project, and the store loaded from it (as the first page to subscribe does). */
function open() {
  globalThis.localStorage = new Storage([['cpwtcv_boards_v2', JSON.stringify({ boards: [project()], dataVersion: 2 })]]);
  store.subscribe(() => {});
}
const boardNow = () => store.snapshot().boards.find((b) => b.id === 'p1');

/**
 * `component` mounted; `field()` finds the field under test (in the whole document: dialogs and
 * popovers open in portals at the end of <body>); `type` and `key` call its handlers as the browser
 * would; `key` hands back the event, to read what the handler did with it.
 */
function drive(view, find) {
  const field = () => find([...elements(view.document.body)]);
  return {
    view,
    field,
    value: () => reactProps(field()).value,
    type: (value) => view.act(() => reactProps(field()).onChange(ev({ target: { value } }))),
    key: (props) => { const e = ev(props); view.act(() => reactProps(field()).onKeyDown(e)); return e; },
  };
}
/** The input named `label` (a popover's panel and list can carry the same name as its search). */
const labelled = (label) => (all) => all.find((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === label);

describe('Create issue dialog: Summary', () => {
  function dialog() {
    open();
    const Page = () => h(MemoryRouter, null, h(CreateIssueDialog, { open: true, defaults: { boardId: 'p1' }, onClose: () => {} }));
    // The Summary is a TextField: named by its <label>, which points at the input's id.
    return drive(mount(Page, {}), (all) => {
      const label = all.find((el) => el.tagName === 'LABEL' && el.textContent.startsWith('Summary'));
      return label && all.find((el) => el.tagName === 'INPUT' && el.getAttribute('id') === label.getAttribute('for'));
    });
  }

  for (const [name, props] of Object.entries(composing)) {
    it(`${name} picks the word and creates nothing`, async () => {
      const d = dialog();
      try {
        assert.ok(d.field(), 'the dialog shows its Summary');
        d.type('修复登录');
        const e = d.key(props);
        assert.equal(boardNow().issues.length, 2, 'the Enter that ends a composition created the issue');
        assert.equal(e.defaultPrevented, false, 'the input method keeps its Enter');
        assert.equal(d.value(), '修复登录', 'the composed summary stays in the field');
      } finally { await d.view.unmount(); }
    });
  }

  it('the Enter after the composition creates the issue, once', async () => {
    const d = dialog();
    try {
      d.type('修复登录');
      d.key(composing['Enter with keyCode 229 (Safari)']);
      d.key({ key: 'Enter' });
      const added = boardNow().issues.filter((i) => i.id !== 'i1' && i.id !== 'i2');
      assert.deepEqual(added.map((i) => i.title), ['修复登录']);
    } finally { await d.view.unmount(); }
  });
});

describe('Board: Add column', () => {
  function board() {
    open();
    const Page = () => h(MemoryRouter, { initialEntries: ['/boards/p1'] }, h(Routes, null, h(Route, { path: '/boards/:id', element: h(Board) })));
    const d = drive(mount(Page, {}), labelled('Column name'));
    const add = [...elements(d.view.document.body)].find((el) => el.tagName === 'BUTTON' && el.getAttribute('aria-label') === 'Add column');
    d.view.act(() => reactProps(add).onClick(ev()));
    return d;
  }

  for (const [name, props] of Object.entries(composing)) {
    it(`${name} picks the word and adds no column`, async () => {
      const d = board();
      try {
        d.type('待办');
        d.key(props);
        assert.equal(boardNow().columns.length, 3, 'the Enter that ends a composition added the column');
        assert.ok(d.field(), 'the name field stays open');
        assert.equal(d.value(), '待办');
      } finally { await d.view.unmount(); }
    });
  }

  it('an Escape while composing leaves the name field open with its text', async () => {
    const d = board();
    try {
      d.type('待');
      d.key({ key: 'Escape', nativeEvent: { isComposing: true } });
      assert.ok(d.field(), 'the field closed on the input method\'s Escape');
      assert.equal(d.value(), '待');
    } finally { await d.view.unmount(); }
  });

  it('the Enter after the composition adds the column', async () => {
    const d = board();
    try {
      d.type('待办');
      d.key(composing['Enter with isComposing (Chrome, Firefox)']);
      d.key({ key: 'Enter' });
      assert.deepEqual(boardNow().columns.map((c) => c.title), ['To Do', 'Doing', 'Done', '待办']);
    } finally { await d.view.unmount(); }
  });
});

describe('Project settings: a field that saves on Enter, and an Add row', () => {
  function settings(find) {
    open();
    const Page = () => h(MemoryRouter, { initialEntries: ['/boards/p1/settings'] },
      h(Routes, null, h(Route, { path: '/boards/:id/settings', element: h(BoardSettings) })));
    return drive(mount(Page, {}), find);
  }

  for (const [name, props] of Object.entries(composing)) {
    it(`${name} in the project's name saves nothing; the Enter after it saves the name`, async () => {
      const d = settings(labelled('Project name'));
      try {
        d.type('家务');
        d.key(props);
        assert.equal(boardNow().title, 'Home jobs', 'the Enter that ends a composition saved the name');
        assert.equal(d.value(), '家务', 'the composed name stays in the field');
        d.key({ key: 'Enter' });
        assert.equal(boardNow().title, '家务');
      } finally { await d.view.unmount(); }
    });

    it(`${name} in "New label" adds nothing; the Enter after it adds the label`, async () => {
      const d = settings(labelled('New label'));
      try {
        d.type('紧急');
        d.key(props);
        assert.equal(boardNow().labels.length, 1, 'the Enter that ends a composition added the label');
        assert.equal(d.value(), '紧急');
        d.key({ key: 'Enter' });
        assert.deepEqual(boardNow().labels.map((l) => l.name), ['Urgent', '紧急']);
      } finally { await d.view.unmount(); }
    });
  }

  it('an Escape while composing keeps the typed name', async () => {
    const d = settings(labelled('Project name'));
    try {
      d.type('家');
      d.key({ key: 'Escape', keyCode: 229 });
      assert.equal(d.value(), '家', 'the input method\'s Escape put the saved name back');
    } finally { await d.view.unmount(); }
  });
});

describe('Labels picker (MultiSelectPopover): the search', () => {
  function picker() {
    const created = [];
    const changes = [];
    const view = mount(ui.MultiSelectPopover, {
      trigger: h('button', { type: 'button' }, 'Labels'), open: true, onOpenChange: () => {},
      options: [{ value: 'l1', label: 'Urgent' }], value: [], title: 'Labels', searchPlaceholder: 'Search or create labels',
      onChange: (v) => changes.push(v), onCreate: (name) => created.push(name),
    });
    return { ...drive(view, labelled('Search or create labels')), created, changes };
  }

  for (const [name, props] of Object.entries(composing)) {
    it(`${name} picks the word and creates or ticks nothing`, async () => {
      const d = picker();
      try {
        d.type('紧急');
        const e = d.key(props);
        assert.deepEqual([d.created, d.changes], [[], []], 'the Enter that ends a composition made the label');
        assert.equal(e.defaultPrevented, false, 'the input method keeps its Enter');
        assert.equal(d.value(), '紧急');
      } finally { await d.view.unmount(); }
    });
  }

  it('the arrows and Escape while composing are the input method\'s: the row, the text and the popover stay', async () => {
    const d = picker();
    try {
      d.type('U'); // two rows: Urgent, and Create "U"
      const row = () => d.field().getAttribute('aria-activedescendant');
      const first = row();
      const down = d.key({ key: 'ArrowDown', keyCode: 229 });
      assert.equal(row(), first, 'a candidate move moved the active row');
      assert.equal(down.defaultPrevented, false);
      const esc = d.key({ key: 'Escape', nativeEvent: { isComposing: true } });
      assert.equal(d.value(), 'U', 'the input method\'s Escape cleared the search');
      assert.equal(esc.defaultPrevented, false, 'the input method keeps its Escape');
      assert.equal(esc.propagationStopped, true, 'the popover would close on it, the half-typed name with it');
    } finally { await d.view.unmount(); }
  });

  it('the Enter after the composition creates the label, once', async () => {
    const d = picker();
    try {
      d.type('紧急');
      d.key(composing['Enter with keyCode 229 (Safari)']);
      d.key({ key: 'Enter' });
      assert.deepEqual(d.created, ['紧急']);
    } finally { await d.view.unmount(); }
  });
});

describe('Story points and InlineEdit', () => {
  for (const [name, props] of Object.entries(composing)) {
    it(`Story points: ${name} saves nothing; the Enter after it saves`, async () => {
      const saved = [];
      const d = drive(mount(PointsInput, { value: null, onChange: (n) => saved.push(n) }), labelled('Story points'));
      try {
        d.type('3');
        d.key(props);
        assert.deepEqual(saved, [], 'the Enter that ends a composition saved the points');
        assert.equal(d.value(), '3');
        d.key({ key: 'Enter' });
        assert.deepEqual(saved, [3]);
      } finally { await d.view.unmount(); }
    });
  }

  it('InlineEdit: Safari\'s Enter (keyCode 229, isComposing false) picks the word and commits nothing', async () => {
    const commits = [];
    const view = mount(ui.InlineEdit, { value: 'Old', label: 'Issue title', onCommit: (v) => commits.push(v) });
    const d = drive(view, labelled('Issue title'));
    try {
      view.act(() => reactProps(byText(view.container, 'Old, edit Issue title')).onClick(ev()));
      assert.ok(d.field(), 'the title turned into a field');
      d.type('日本語');
      const e = d.key(composing['Enter with keyCode 229 (Safari)']);
      assert.deepEqual(commits, [], 'Safari\'s composition Enter committed the half-typed title');
      assert.equal(e.defaultPrevented, false, 'the input method keeps its Enter');
      assert.ok(d.field(), 'still editing');
      d.key({ key: 'Enter' });
      assert.deepEqual(commits, ['日本語']);
      assert.equal(byAttr(view.container, 'aria-label', 'Issue title').length, 0, 'the edit ended');
    } finally { await view.unmount(); }
  });
});
