// R4-DUX-05: the Create issue and Create project dialogs threw typed input away on Escape or a
// click on the dimmed page beside them — the Dialog closes on both by default and unmounts its form.
// Now, with a summary (or a project's name) typed, Escape and that click ask "Discard this issue?" /
// "Discard this project?" first (the kit's confirm; the browser's confirm() outside the workspace
// shell, as here): No keeps the dialog and the text, Discard closes it. With nothing typed they
// still close at once.
// The real dialogs and board store are mounted with react-dom/client over fake-dom, through Vite's
// loader (tests/pdf/harness.mjs), as tests/pdf/82-board-ime-enter.test.mjs does.
// Run: node --test tests/pdf/102-r4-dux-05-discard-typed-create.test.mjs
import { before, after, beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom, ev } from '../unit/ui-dom-harness.mjs';

let CreateIssueDialog;
let CreateProjectDialog;
let store;
before(async () => {
  await setup();
  patchFakeDom();
  ({ CreateIssueDialog } = await loadModule('/src/components/board/CreateIssueDialog.jsx'));
  ({ CreateProjectDialog } = await loadModule('/src/components/board/CreateProjectDialog.jsx'));
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

const col = (id, title, category = 'todo') => ({ id, title, category, wipLimit: null });
const project = () => ({
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1', mode: 'kanban', description: '',
  columns: [col('c1', 'To Do'), col('c2', 'Done', 'done')],
  labels: [], sprints: [], issues: [], nextNumber: 1, hideDoneAfterDays: 14,
});

/** Storage holding one fictional project, and the store loaded from it. */
function load() {
  globalThis.localStorage = new Storage([['cpwtcv_boards_v2', JSON.stringify({ boards: [project()], dataVersion: 2 })]]);
  store.subscribe(() => {});
}

/** Lets effects and the awaited confirm settle. */
const tick = async () => {
  for (let n = 0; n < 5; n += 1) await new Promise((r) => { setImmediate(r); });
  await new Promise((r) => { setTimeout(r, 0); });
};

/**
 * `element` mounted with a counted onClose and scripted confirm answers. `type(label, value)` types
 * into the TextField labelled `label`; `escape()` presses Escape in the dialog; `clickBeside()` is a
 * press that starts and ends on the dimmed page around it.
 */
function drive(element) {
  let closes = 0;
  const asked = [];
  const answers = [];
  const view = mount(() => element(() => { closes += 1; }), {});
  view.window.confirm = (question) => { asked.push(question); return answers.shift() ?? false; };
  const all = () => [...elements(view.document.body)];
  const field = (label) => {
    const tag = all().find((el) => el.tagName === 'LABEL' && el.textContent.startsWith(label));
    return tag && all().find((el) => el.tagName === 'INPUT' && el.getAttribute('id') === tag.getAttribute('for'));
  };
  const keyLayer = () => all().find((el) => reactProps(el)?.className === 'fixed inset-0 z-50');
  const overlay = () => all().find((el) => typeof reactProps(el)?.onPointerDown === 'function');
  return {
    view,
    asked,
    answer: (value) => answers.push(value),
    closes: () => closes,
    value: (label) => reactProps(field(label)).value,
    async type(label, value) {
      view.act(() => reactProps(field(label)).onChange(ev({ target: { value } })));
      await tick();
    },
    async escape() {
      view.act(() => reactProps(keyLayer()).onKeyDown(ev({ key: 'Escape' })));
      await tick();
    },
    async clickBeside() {
      const el = overlay();
      view.act(() => {
        reactProps(el).onPointerDown(ev({ target: el, currentTarget: el }));
        reactProps(el).onPointerUp(ev({ target: el, currentTarget: el }));
        reactProps(el).onClick(ev({ target: el, currentTarget: el }));
      });
      await tick();
    },
  };
}

describe('Create issue: Escape or a click beside it with a summary typed', () => {
  const issueDialog = () => {
    load();
    return drive((onClose) => h(MemoryRouter, null, h(CreateIssueDialog, { open: true, defaults: { boardId: 'p1' }, onClose })));
  };

  it('with nothing typed, Escape closes at once without asking', async () => {
    const d = issueDialog();
    try {
      await tick();
      await d.escape();
      assert.deepEqual(d.asked, []);
      assert.equal(d.closes(), 1);
    } finally { await d.view.unmount(); }
  });

  it('asks "Discard this issue?": No keeps the dialog and the summary, Discard closes it', async () => {
    const d = issueDialog();
    try {
      await d.type('Summary', 'Fix the garden gate');
      d.answer(false);
      await d.escape();
      assert.deepEqual(d.asked, ['Discard this issue?'], 'Escape threw the typed summary away without asking');
      assert.equal(d.closes(), 0, 'the dialog closed although the discard was declined');
      assert.equal(d.value('Summary'), 'Fix the garden gate');

      d.answer(true);
      await d.clickBeside();
      assert.deepEqual(d.asked, ['Discard this issue?', 'Discard this issue?'], 'a click beside the dialog did not ask');
      assert.equal(d.closes(), 1, 'Discard closes the dialog');
    } finally { await d.view.unmount(); }
  });
});

describe('Create project: Escape or a click beside it with a name typed', () => {
  const projectDialog = () => {
    load();
    return drive((onClose) => h(CreateProjectDialog, { open: true, onClose, onCreated: () => {} }));
  };

  it('with nothing typed, a click beside it closes at once without asking', async () => {
    const d = projectDialog();
    try {
      await tick();
      await d.clickBeside();
      assert.deepEqual(d.asked, []);
      assert.equal(d.closes(), 1);
    } finally { await d.view.unmount(); }
  });

  it('asks "Discard this project?": No keeps the dialog and the name, Discard closes it', async () => {
    const d = projectDialog();
    try {
      await d.type('Name', 'Allotment plans');
      d.answer(false);
      await d.clickBeside();
      assert.deepEqual(d.asked, ['Discard this project?'], 'a click beside the dialog threw the typed name away without asking');
      assert.equal(d.closes(), 0, 'the dialog closed although the discard was declined');
      assert.equal(d.value('Name'), 'Allotment plans');

      d.answer(true);
      await d.escape();
      assert.deepEqual(d.asked, ['Discard this project?', 'Discard this project?'], 'Escape did not ask');
      assert.equal(d.closes(), 1, 'Discard closes the dialog');
    } finally { await d.view.unmount(); }
  });
});
