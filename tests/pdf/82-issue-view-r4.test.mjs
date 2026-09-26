// The issue view (IssueDialog over the board), Round 4:
//  - R4-BRD-02: opening another issue from the view (an epic's child row, the epic in the trail)
//    showed the new issue with the old one's state: a half-typed description (and Save wrote it into
//    the new issue), an open comment box, the checklist's new row, the Activity tab. Each issue now
//    starts from its own view.
//  - R4-BRD-03: a description being edited was thrown away without a word when the view closed
//    (the X, Escape) or another issue opened. The product call: autosave, as every other field of
//    the view does — the draft is saved into the issue it was typed in; Cancel still discards it.
//  - R4-BRD-05: closing the view pushed one more history entry, so Back reopened the issue. Closing
//    now undoes the opening (an epic and the child opened from it, too), and Back after it leaves
//    the board for the page before; an issue named by a shared link closes in place. Deleting the
//    issue from its view and the trail's project link (on the board) close the same way.
// The real board page and the real board store are mounted with react-dom/client over fake-dom
// (tests/pdf/fake-dom.mjs, the kit's harness), as tests/pdf/82-board-summary-labels.test.mjs does.
// Run: node --test tests/pdf/82-issue-view-r4.test.mjs
import { before, after, beforeEach, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement as h } from 'react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom, ev } from '../unit/ui-dom-harness.mjs';

let Board;
let store;
before(async () => {
  await setup();
  patchFakeDom(); // the issue view's focus trap and menus query the document
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

const col = (id, title, category = 'todo') => ({ id, title, category, wipLimit: null });
const issue = (id, number, title, columnId, extra = {}) => ({ id, number, type: 'task', title, columnId, labelIds: [], checklist: [], ...extra });
/** HOME-3 is an epic; HOME-1 is its child. */
const project = () => ({
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1', mode: 'kanban', description: '',
  columns: [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')],
  labels: [],
  sprints: [],
  issues: [
    issue('i1', 1, 'Fix the tap', 'c1', { epicId: 'i3' }),
    issue('i2', 2, 'Paint the fence', 'c2', { description: 'White' }),
    issue('i3', 3, 'Garden makeover', 'c1', { type: 'epic' }),
  ],
  nextNumber: 4,
});

const boardNow = () => store.snapshot().boards.find((b) => b.id === 'p1');
const issueNow = (id) => boardNow().issues.find((i) => i.id === id);

/**
 * The board page at `path`, with a page before it in the router's history ('/elsewhere'), so a
 * test can read where Back goes. Navigations commit at once (useTransitions: false), inside the
 * act() that caused them.
 */
function mountBoard(path) {
  globalThis.localStorage = new Storage([['cpwtcv_boards_v2', JSON.stringify({ boards: [project()], dataVersion: 2 })]]);
  store.subscribe(() => {});
  let nav = null;
  let loc = null;
  function Probe() {
    nav = useNavigate();
    loc = useLocation();
    return null;
  }
  const Page = () => h(MemoryRouter, { initialEntries: ['/elsewhere', path], initialIndex: 1, useTransitions: false },
    h(Probe),
    h(Routes, null,
      h(Route, { path: '/elsewhere', element: h('p', null, 'Elsewhere') }),
      h(Route, { path: '/boards/:id', element: h(Board) })));
  const view = mount(Page, {});
  // The whole document: the issue view opens in a portal at the end of <body>.
  const all = (node = view.document.body) => [...elements(node)];
  const dialog = () => all().find((el) => el.getAttribute('role') === 'dialog');
  const inView = () => (dialog() ? all(dialog()) : []);
  const page = {
    view,
    dialog,
    /** The open issue view's name ('HOME-1 Fix the tap'), or null when none is open. */
    open: () => dialog()?.getAttribute('aria-label') ?? null,
    path: () => `${loc.pathname}${loc.search}`,
    byLabel: (label) => inView().find((el) => el.getAttribute('aria-label') === label),
    button: (text) => inView().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text),
    /** A button in the view whose text holds `text` (an epic's child row: key, summary, status). */
    buttonWith: (text) => inView().find((el) => el.tagName === 'BUTTON' && el.textContent.includes(text)),
    tab: (text) => inView().find((el) => el.getAttribute('role') === 'tab' && el.textContent.trim().startsWith(text)),
    byId: (id) => inView().find((el) => el.getAttribute('id') === id),
    /** A card on the board ('HOME-2 Paint the fence'). */
    card: (label) => all().find((el) => el.getAttribute('role') === 'button' && el.getAttribute('aria-label') === label),
    /** A menu's item (menus open in a portal of their own, outside the view). */
    item: (label) => all().find((el) => String(el.getAttribute('role')).startsWith('menuitem') && el.textContent.trim() === label),
    click: (el) => view.act(() => reactProps(el).onClick(ev())),
    /** A plain left click on a link, which the router's Link follows unless its onClick prevented it. */
    clickLink: (el) => view.act(() => reactProps(el).onClick(ev({ button: 0 }))),
    /** Types `html` into the description's editor, as its input event hands it on. */
    typeDescription: (html) => {
      const editor = page.byLabel('Description');
      editor.innerHTML = html;
      view.act(() => reactProps(editor).onInput(ev()));
    },
    /** Escape in the view, as its dialog's keydown handler gets it. */
    escape: () => {
      const root = dialog().parentNode.parentNode; // panel → overlay → the dialog's root, which listens
      view.act(() => reactProps(root).onKeyDown(ev({ key: 'Escape' })));
    },
    back: () => view.act(() => nav(-1)),
    async settle() { for (let i = 0; i < 5; i += 1) { await new Promise((r) => { setImmediate(r); }); view.act(() => {}); } },
  };
  return page;
}

it('R4-BRD-02: a child opened from its epic shows its own description, not the epic\'s half-typed draft', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-3');
  try {
    assert.equal(page.open(), 'HOME-3 Garden makeover');
    page.click(page.byLabel('Edit description'));
    page.typeDescription('Plant the roses');
    page.click(page.buttonWith('Fix the tap'));
    await page.settle();
    assert.equal(page.open(), 'HOME-1 Fix the tap', 'the child row opened the child');
    assert.equal(page.byLabel('Description'), undefined, 'the child opened with the epic\'s description editor, its draft in it');
    assert.ok(page.byLabel('Edit description'), 'the child shows its own description, ready to edit');
    // Editing the child's description starts from the child's (empty) one.
    page.click(page.byLabel('Edit description'));
    page.click(page.button('Save'));
    assert.equal(issueNow('i1').description ?? '', '', 'Save wrote the epic\'s draft into the child');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-02: the comment box, the checklist\'s new row and the Activity tab stay with the issue they were opened on', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-1');
  try {
    assert.equal(page.open(), 'HOME-1 Fix the tap');
    page.click(page.button('Add a comment…'));
    assert.ok(page.byLabel('Comment'), 'the comment box opened');
    page.click(page.button('Add checklist item'));
    assert.ok(page.byId('issue-checklist-heading'), 'the checklist opened');
    page.click(page.tab('History'));
    assert.equal(page.tab('History').getAttribute('aria-selected'), 'true');

    // The trail's epic link opens the epic.
    page.click(page.buttonWith('HOME-3'));
    await page.settle();
    assert.equal(page.open(), 'HOME-3 Garden makeover');
    assert.equal(page.byLabel('Comment'), undefined, 'the epic opened with the child\'s comment box open');
    assert.ok(page.button('Add a comment…'));
    assert.equal(page.byId('issue-checklist-heading'), undefined, 'the epic (no checklist) opened with a checklist row to fill');
    assert.equal(page.tab('Comments').getAttribute('aria-selected'), 'true', 'the epic opened on the child\'s History tab');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-03: a description left open is saved when the view closes with its X', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2');
  try {
    page.click(page.byLabel('Edit description'));
    page.typeDescription('Two coats of white');
    page.click(page.byLabel('Close'));
    await page.settle();
    assert.equal(page.open(), null, 'the view closed');
    assert.equal(issueNow('i2').description, 'Two coats of white', 'the typed description was thrown away');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-03: a description left open is saved when the view closes with Escape', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2');
  try {
    page.click(page.byLabel('Edit description'));
    page.typeDescription('Sand it first');
    page.escape();
    await page.settle();
    assert.equal(page.open(), null, 'Escape closed the view');
    assert.equal(issueNow('i2').description, 'Sand it first', 'the typed description was thrown away');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-03: a draft left open when a child opens is saved into the epic it was typed in, not the child', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-3');
  try {
    page.click(page.byLabel('Edit description'));
    page.typeDescription('Plant the roses');
    page.click(page.buttonWith('Fix the tap'));
    await page.settle();
    assert.equal(page.open(), 'HOME-1 Fix the tap');
    assert.equal(issueNow('i3').description, 'Plant the roses', 'the epic\'s draft was thrown away');
    assert.equal(issueNow('i1').description ?? '', '', 'the epic\'s draft went into the child');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-03: Cancel still discards the draft, and an editor opened and left untouched saves nothing', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2');
  try {
    const before = issueNow('i2');
    page.click(page.byLabel('Edit description'));
    page.typeDescription('Not this');
    page.click(page.button('Cancel'));
    page.click(page.byLabel('Edit description'));
    page.click(page.byLabel('Close'));
    await page.settle();
    assert.equal(page.open(), null, 'the view closed');
    assert.equal(issueNow('i2').description, 'White', 'Cancel kept the old description');
    assert.equal(issueNow('i2').updatedAt, before.updatedAt, 'the untouched editor saved a change');
    assert.equal((issueNow('i2').activity ?? []).length, (before.activity ?? []).length, 'the untouched editor logged a change');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-05: closing an issue opened from its card undoes the opening: Back then leaves the board', async () => {
  const page = mountBoard('/boards/p1');
  try {
    page.click(page.card('HOME-2 Paint the fence'));
    await page.settle();
    assert.equal(page.open(), 'HOME-2 Paint the fence');
    assert.equal(page.path(), '/boards/p1?issue=HOME-2');
    page.click(page.byLabel('Close'));
    await page.settle();
    assert.equal(page.open(), null, 'the view closed');
    assert.equal(page.path(), '/boards/p1');
    page.back();
    await page.settle();
    assert.equal(page.path(), '/elsewhere', 'Back after closing the issue opened it again');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-05: Back with the issue open still closes it', async () => {
  const page = mountBoard('/boards/p1');
  try {
    page.click(page.card('HOME-2 Paint the fence'));
    await page.settle();
    page.back();
    await page.settle();
    assert.equal(page.open(), null, 'Back closed the view');
    assert.equal(page.path(), '/boards/p1');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-05: an epic, then a child opened from it, close together; Back from the child goes back to the epic', async () => {
  const page = mountBoard('/boards/p1');
  try {
    page.click(page.card('HOME-3 Garden makeover'));
    await page.settle();
    page.click(page.buttonWith('Fix the tap'));
    await page.settle();
    assert.equal(page.open(), 'HOME-1 Fix the tap');
    page.back();
    await page.settle();
    assert.equal(page.open(), 'HOME-3 Garden makeover', 'Back from the child shows its epic');
    page.click(page.buttonWith('Fix the tap'));
    await page.settle();
    page.escape();
    await page.settle();
    assert.equal(page.open(), null, 'closing the child closed the view, not only the child');
    assert.equal(page.path(), '/boards/p1');
    page.back();
    await page.settle();
    assert.equal(page.path(), '/elsewhere', 'Back after closing opened an issue again');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-05: an issue named by a shared link closes in place; Back then leaves the board', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-2');
  try {
    assert.equal(page.open(), 'HOME-2 Paint the fence');
    page.click(page.byLabel('Close'));
    await page.settle();
    assert.equal(page.open(), null, 'the view closed');
    assert.equal(page.path(), '/boards/p1');
    page.back();
    await page.settle();
    assert.equal(page.path(), '/elsewhere', 'Back after closing the shared issue opened it again');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-05: a child opened from a shared epic, then closed, closes the view — not back to the epic', async () => {
  const page = mountBoard('/boards/p1?issue=HOME-3');
  try {
    page.click(page.buttonWith('Fix the tap'));
    await page.settle();
    assert.equal(page.open(), 'HOME-1 Fix the tap');
    page.click(page.byLabel('Close'));
    await page.settle();
    assert.equal(page.open(), null, 'closing the child showed the epic again');
    assert.equal(page.path(), '/boards/p1');
    page.back();
    await page.settle();
    assert.equal(page.path(), '/elsewhere');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-05: deleting the issue from its view closes it the same way', async () => {
  const page = mountBoard('/boards/p1');
  page.view.window.confirm = () => true;
  try {
    page.click(page.card('HOME-2 Paint the fence'));
    await page.settle();
    page.click(page.byLabel('Issue actions'));
    page.click(page.item('Delete'));
    await page.settle();
    assert.equal(issueNow('i2'), undefined, 'the issue was deleted');
    assert.equal(page.open(), null, 'the view closed');
    assert.equal(page.path(), '/boards/p1');
    page.back();
    await page.settle();
    assert.equal(page.path(), '/elsewhere', 'Back after deleting went to the deleted issue\'s address');
  } finally {
    await page.view.unmount();
  }
});

it('R4-BRD-05: on the board, the trail\'s project link closes the view the same way', async () => {
  const page = mountBoard('/boards/p1');
  try {
    page.click(page.card('HOME-2 Paint the fence'));
    await page.settle();
    const link = page.dialog() && [...elements(page.dialog())].find((el) => el.tagName === 'A' && el.textContent.trim() === 'Home jobs');
    assert.ok(link, 'the trail links the project');
    page.clickLink(link);
    await page.settle();
    assert.equal(page.open(), null, 'the view closed');
    assert.equal(page.path(), '/boards/p1');
    page.back();
    await page.settle();
    assert.equal(page.path(), '/elsewhere', 'Back after the project link opened the issue again');
  } finally {
    await page.view.unmount();
  }
});
