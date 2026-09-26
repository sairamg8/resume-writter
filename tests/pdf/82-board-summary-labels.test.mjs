// R2-041 on the tracker look. Its fix to the old card sheet (60b40ff: the title kept a typed space;
// a picked colour whose palette name another label had got a label of its own) went with the sheet
// in the Jira-style revamp, and so did its two tests. The flows that replaced it are pinned here:
// an issue's summary is edited as a draft (the issue view's InlineEdit, a column's "+ Create
// issue" composer) and cleaned only when saved, so a space typed before the next word stays; a
// label is made by name from the Labels picker, gets a label of its own even when its colour is
// another label's, and a name the board already has — in other case or spacing — is not offered as
// new (the store would refuse it and hand back the old one) but found. The real board page and
// store are mounted with react-dom/client over fake-dom (tests/pdf/fake-dom.mjs and the kit's
// harness), as tests/pdf/82-board-pages.test.mjs does.
import { before, after, beforeEach, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

let Board;
let store;
let LABEL_COLORS;
before(async () => {
  await setup();
  ({ Board } = await loadModule('/src/pages/Board.jsx'));
  store = await loadModule('/src/hooks/useBoardStore.js');
  ({ LABEL_COLORS } = await loadModule('/src/constants/boards.js'));
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
const issue = (id, number, title, columnId, extra = {}) => ({ id, number, type: 'task', title, columnId, labelIds: [], checklist: [], ...extra });
/** A project whose two labels have the palette's first and third colours (Red, Amber). */
const project = () => ({
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1',
  columns: [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')],
  labels: [{ id: 'l1', name: 'Urgent', color: '#ef4444' }, { id: 'l2', name: 'Needs parts', color: '#f59e0b' }],
  sprints: [],
  issues: [issue('i1', 1, 'Fix the tap', 'c1', { labelIds: ['l1'] }), issue('i2', 2, 'Paint the fence', 'c2')],
  nextNumber: 3,
});

/** Storage holding the project, and the store loaded from it (as the first page to subscribe does). */
function open() {
  globalThis.localStorage = new Storage([['cpwtcv_boards_v2', JSON.stringify({ boards: [project()], dataVersion: 2 })]]);
  store.subscribe(() => {});
}

/** The board page mounted with react-dom/client (tests/pdf/fake-dom.mjs), its handlers called as clicks and keys. */
async function mountBoard(path) {
  const dom = await import('./fake-dom.mjs');
  const { patchFakeDom } = await import('../unit/ui-dom-harness.mjs');
  patchFakeDom();
  const Page = () => createElement(MemoryRouter, { initialEntries: [path] },
    createElement(Routes, null, createElement(Route, { path: '/boards/:id', element: createElement(Board) })));
  const view = dom.mount(Page, {});
  const ev = (extra = {}) => ({ stopPropagation() {}, preventDefault() {}, key: '', nativeEvent: {}, ...extra });
  // The whole document: menus, popovers and the issue view open in portals at the end of <body>.
  const all = () => [...dom.elements(view.document.body)];
  return {
    view,
    byLabel: (label, node) => (node ? [...dom.elements(node)] : all()).find((el) => el.getAttribute('aria-label') === label),
    button: (label, node) => (node ? [...dom.elements(node)] : all()).find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === label),
    /** The picker's rows (role="option"), by their text. */
    options: () => all().filter((el) => el.getAttribute('role') === 'option').map((el) => el.textContent.trim()),
    option: (text) => all().find((el) => el.getAttribute('role') === 'option' && el.textContent.trim() === text),
    column: (id) => all().find((el) => el.getAttribute('data-column') === id),
    value: (el) => dom.reactProps(el).value,
    click: (el) => view.act(() => dom.reactProps(el).onClick(ev())),
    type: (el, value) => view.act(() => dom.reactProps(el).onChange(ev({ target: { value } }))),
    key: (el, key) => view.act(() => dom.reactProps(el).onKeyDown(ev({ key }))),
  };
}

const boardNow = () => store.snapshot().boards.find((b) => b.id === 'p1');
const issueNow = (id) => boardNow().issues.find((i) => i.id === id);

it('R2-041: the issue view\'s summary keeps each space typed until it is saved; the store keeps it clean', async () => {
  open();
  const page = await mountBoard('/boards/p1?issue=HOME-2');
  try {
    page.click(page.button('Paint the fence, edit Summary'));
    const field = () => page.byLabel('Summary');
    for (const typed of ['Paint', 'Paint ', 'Paint the', 'Paint the  fence ', 'Paint the  fence red']) {
      page.type(field(), typed);
      assert.equal(page.value(field()), typed, 'the field shows what was typed, its spaces included');
    }
    assert.equal(issueNow('i2').title, 'Paint the fence', 'nothing is saved while typing');
    page.key(field(), 'Enter');
    assert.equal(issueNow('i2').title, 'Paint the fence red', 'saved trimmed, one space between words');
    assert.ok(page.button('Paint the fence red, edit Summary'), 'the view shows the saved summary');
  } finally {
    await page.view.unmount();
  }
});

it('R2-041: a column\'s "+ Create issue" composer keeps each space typed; the new issue\'s summary is clean', async () => {
  open();
  const page = await mountBoard('/boards/p1');
  try {
    page.click(page.button('Create issue', page.column('c1')));
    const field = () => page.byLabel('Summary of the new issue', page.column('c1'));
    for (const typed of ['Oil ', 'Oil the ', ' Oil the  gate ']) {
      page.type(field(), typed);
      assert.equal(page.value(field()), typed);
    }
    page.key(field(), 'Enter');
    const added = boardNow().issues.filter((i) => i.id !== 'i1' && i.id !== 'i2');
    assert.deepEqual(added.map((i) => [i.title, i.columnId]), [['Oil the gate', 'c1']], 'one issue, trimmed, one space between words');
  } finally {
    await page.view.unmount();
  }
});

it('R2-041: a label made from the issue view\'s Labels picker is a label of its own, even in another label\'s colour', async () => {
  open();
  const page = await mountBoard('/boards/p1?issue=HOME-2');
  try {
    page.click(page.byLabel('Labels: none'));
    const search = page.byLabel('Search or create labels');
    assert.ok(search, 'the Labels picker opened with its search');
    page.type(search, 'Garden');
    assert.deepEqual(page.options(), ['Create “Garden”']);
    page.click(page.option('Create “Garden”'));

    const labels = boardNow().labels;
    assert.equal(labels.length, 3, 'one new label');
    const made = labels.find((l) => l.name === 'Garden');
    assert.ok(made, 'called what was typed');
    // The third label takes the palette's third colour, Amber, which "Needs parts" has already:
    // a colour is not a label's identity any more, so it is still a label of its own.
    assert.equal(made.color, LABEL_COLORS[2].color);
    assert.equal(made.color, labels.find((l) => l.id === 'l2').color);
    assert.notEqual(made.id, 'l2');
    assert.deepEqual(issueNow('i2').labelIds, [made.id], 'the new label, not the other one of its colour, is on the issue');
    assert.deepEqual(labels.filter((l) => l.id !== made.id), project().labels, 'the other labels are untouched');
    assert.ok(page.byLabel('Labels: Garden'), 'the picker shows it');
  } finally {
    await page.view.unmount();
  }
});

it('R2-041: a name the board has, typed in other case or spacing, is found in the Labels picker, not offered as new', async () => {
  open();
  const page = await mountBoard('/boards/p1?issue=HOME-2');
  try {
    page.click(page.byLabel('Labels: none'));
    const search = () => page.byLabel('Search or create labels');
    page.type(search(), '  needs   PARTS ');
    // The store keeps "Needs parts" and refuses a second label called that, spacing and case aside:
    // offering to create it made nothing new and ticked the old one behind the user's back.
    assert.deepEqual(page.options(), ['Needs parts'], 'the label the board has, and no "Create"');
    page.key(search(), 'Enter');
    assert.deepEqual(issueNow('i2').labelIds, ['l2']);
    assert.equal(boardNow().labels.length, 2, 'no label was added');

    page.type(search(), 'Big   garden ');
    assert.deepEqual(page.options(), ['Create “Big garden”'], 'a new name, shown as it will be saved');
    page.key(search(), 'Enter');
    const made = boardNow().labels.find((l) => l.name === 'Big garden');
    assert.ok(made, 'made under the name shown');
    assert.deepEqual(issueNow('i2').labelIds, ['l2', made.id]);
  } finally {
    await page.view.unmount();
  }
});
