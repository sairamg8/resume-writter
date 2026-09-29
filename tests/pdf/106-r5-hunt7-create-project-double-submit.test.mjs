// R5-HUNT7-CREATE-PROJECT-DOUBLE-SUBMIT: a double-click on "Create project" (or Enter twice in its Name
// field) made two identical projects, the second keyed HR2. The new project's board opens as a
// transition and is a lazy page, so the dialog (its `open` read from the URL) stays on screen, and its
// button live, while the board's code loads; each extra submit ran addBoard again. Now the form makes
// one project per opening. Here onCreated does not close the dialog, as it does not while the board's
// chunk is on its way.
// The real dialog and board store are mounted with react-dom/client over fake-dom, as
// tests/pdf/102-r4-dux-05-discard-typed-create.test.mjs does.
// Run: node --test tests/pdf/106-r5-hunt7-create-project-double-submit.test.mjs
import { before, after, beforeEach, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom, ev } from '../unit/ui-dom-harness.mjs';

let CreateProjectDialog;
let store;
before(async () => {
  await setup();
  patchFakeDom();
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

const tick = async () => {
  for (let n = 0; n < 5; n += 1) await new Promise((r) => { setImmediate(r); });
  await new Promise((r) => { setTimeout(r, 0); });
};

async function dialog() {
  globalThis.localStorage = new Storage([['cpwtcv_boards_v2', JSON.stringify({ boards: [project()], dataVersion: 2 })]]);
  store.subscribe(() => {});
  const created = [];
  // onCreated only navigates in the app; the dialog stays open until the board's page lands.
  const view = mount(() => h(CreateProjectDialog, { open: true, onClose() {}, onCreated: (b) => created.push(b) }), {});
  await tick();
  const all = () => [...elements(view.document.body)];
  const field = (label) => {
    const tag = all().find((el) => el.tagName === 'LABEL' && el.textContent.startsWith(label));
    return tag && all().find((el) => el.tagName === 'INPUT' && el.getAttribute('id') === tag.getAttribute('for'));
  };
  const form = () => all().find((el) => el.tagName === 'FORM');
  return {
    view,
    created,
    async type(label, value) {
      view.act(() => reactProps(field(label)).onChange(ev({ target: { value } })));
      await tick();
    },
    // One submit (a click on Create project, or Enter in a field), then the page renders again.
    async submit() {
      view.act(() => reactProps(form()).onSubmit(ev()));
      await tick();
    },
  };
}

const named = (title) => store.snapshot().boards.filter((b) => b.title === title);

it('a double-click on Create project makes one project', async () => {
  const d = await dialog();
  try {
    await d.type('Name', 'Home renovation');
    await d.submit();
    await d.submit();
    const made = named('Home renovation');
    assert.equal(made.length, 1, `one project: ${made.map((b) => b.key).join(', ')}`);
    assert.equal(made[0].key, 'HR');
    assert.equal(d.created.length, 1, 'onCreated ran once');
    assert.equal(d.created[0].id, made[0].id);
  } finally { await d.view.unmount(); }
});

it('Enter pressed three times in the Name field makes one project', async () => {
  const d = await dialog();
  try {
    await d.type('Name', 'Garden');
    await d.submit();
    await d.submit();
    await d.submit();
    assert.equal(named('Garden').length, 1);
    assert.equal(store.snapshot().boards.length, 2, 'the project there was, and one new');
  } finally { await d.view.unmount(); }
});

it('a submit with no name still makes nothing, and a later one with a name makes one', async () => {
  const d = await dialog();
  try {
    await d.submit();
    assert.equal(store.snapshot().boards.length, 1, 'no nameless project');
    await d.type('Name', 'Garden');
    await d.submit();
    assert.equal(named('Garden').length, 1, 'the name typed after the refused submit made its project');
  } finally { await d.view.unmount(); }
});
