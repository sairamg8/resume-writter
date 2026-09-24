// The two board pages over the board store v2 (R2-037, R2-041, R2-155). The store and its
// normaliser were rewritten for v2 projects (columns and issues) while /boards and /boards/:id
// still read v1 boards (lists of cards): `b.lists.reduce` threw on every saved board, so the
// ErrorBoundary replaced both pages on every visit — the v1 list with no cards of R2-041
// included. And the board page never said when a change could not be saved (R2-037): the grid
// did, the page where edits are made did not. Here the real pages and the real store are
// rendered through Vite's loader (tests/pdf/harness.mjs) with react-dom/server, over a
// localStorage stand-in that can be made full.
import { before, after, beforeEach, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

const KEY = 'cpwtcv_boards_v2';
const V1_KEY = 'cpwtcv_boards_v1';

let Boards;
let Board;
let store;
before(async () => {
  await setup();
  ({ Boards } = await loadModule('/src/pages/Boards.jsx'));
  ({ Board } = await loadModule('/src/pages/Board.jsx'));
  store = await loadModule('/src/hooks/useBoardStore.js');
  const { BOARDS_KEY } = await loadModule('/src/constants/boards.js');
  assert.equal(BOARDS_KEY, KEY);
});
after(teardown);

/** localStorage that throws the browser's quota error on every write once `full` is set. */
class Storage {
  constructor(entries = []) { this.map = new Map(entries); this.full = false; }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) {
    if (this.full) throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
    this.map.set(k, String(v));
  }
  removeItem(k) { this.map.delete(k); }
}

beforeEach(() => { store._resetBoardStoreForTest(); });
afterEach(() => { delete globalThis.localStorage; });

/** Storage holding `entries`, and the store loaded from it (as the first page to subscribe does). */
function open(entries) {
  globalThis.localStorage = new Storage(entries);
  store.subscribe(() => {});
  return globalThis.localStorage;
}

/** The markup the app's routes give `path`. */
function page(path) {
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [path] },
    createElement(Routes, null,
      createElement(Route, { path: '/boards', element: createElement(Boards) }),
      createElement(Route, { path: '/boards/:id', element: createElement(Board) }))));
}

/** The visible text of `html`, tags dropped and entities decoded. */
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

const col = (id, title, category = 'todo') => ({ id, title, category, wipLimit: null });
const issue = (id, number, title, columnId, extra = {}) => ({ id, number, type: 'task', title, columnId, labelIds: [], checklist: [], ...extra });
const project = (extra = {}) => ({
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1',
  columns: [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')],
  labels: [{ id: 'l1', name: 'Urgent', color: '#ef4444' }],
  sprints: [],
  issues: [
    issue('i1', 1, 'Fix the tap', 'c1', { labelIds: ['l1'], due: '2030-01-02' }),
    issue('i2', 2, 'Paint the fence', 'c2'),
    issue('i3', 3, 'Buy nails', 'c1', { checklist: [{ id: 'k1', text: 'Box of 100', done: true }, { id: 'k2', text: 'Hammer', done: false }] }),
  ],
  nextNumber: 4,
  ...extra,
});
const saved = (boards) => [KEY, JSON.stringify({ boards, dataVersion: 2 })];

it('/boards lists every project with its column and card counts (the first-run demo included)', () => {
  open([]);
  const demo = store.snapshot().boards;
  assert.ok(demo.length > 0);
  const html = text(page('/boards'));
  for (const b of demo) {
    assert.match(html, new RegExp(b.title));
    const cards = b.issues.length;
    assert.match(html, new RegExp(`${b.columns.length} lists? · ${cards} cards?`));
  }
});

it('/boards/:id shows each column with its cards in rank order, their labels, due dates and checklists', () => {
  open([saved([project()])]);
  const html = page('/boards/p1');
  assert.match(text(html), /Home jobs/);
  // Each column (id="board-col-…"), in order, with its own cards in rank order and their count.
  const columns = html.split('id="board-col-').slice(1).map((c) => text(`<${c}`));
  assert.equal(columns.length, 3);
  assert.match(columns[0], /^ To Do 2 .*Fix the tap .*Buy nails/);
  assert.match(columns[1], /^ Doing 1 .*Paint the fence/);
  assert.match(columns[2], /^ Done 0 /);
  assert.doesNotMatch(columns[2], /Fix the tap|Buy nails|Paint the fence/);
  const t = text(html);
  assert.match(t, /2030-01-02/);
  assert.match(t, /1\/2/); // the checklist's progress
  assert.match(html, /title="Urgent"/); // the label, by the board's own label
});

it('R2-041: a v1 list with no cards array opens on both pages, as an empty column', () => {
  open([[V1_KEY, JSON.stringify({ boards: [{ id: 'b', title: 'B', lists: [{ id: 'l', title: 'x' }] }], dataVersion: 1 })]]);
  assert.match(text(page('/boards')), /B .*1 list · 0 cards/);
  const t = text(page('/boards/b'));
  assert.match(t, /\bx 0\b/);
  assert.match(t, /Add list/);
});

it('R2-037: the board page says when changes are not being saved, as the grid does', () => {
  const storage = open([saved([project()])]);
  assert.doesNotMatch(text(page('/boards/p1')), /not being saved/);
  storage.full = true;
  assert.ok(store.boardActions.addIssue('p1', { title: 'Lost on reload', columnId: 'c1' }));
  const t = text(page('/boards/p1'));
  assert.match(t, /Lost on reload/);
  assert.match(t, /Changes are not being saved: browser storage is full/);
  assert.match(page('/boards/p1'), /role="alert"/);
  assert.match(text(page('/boards')), /Changes are not being saved: browser storage is full/);
});

it('R2-037: the board page shows the recovery notice for a saved list that could not be read in full', () => {
  open([saved([project({ issues: [issue('i1', 1, 'Kept', 'c1'), 42] })])]);
  assert.ok(store.snapshot().recovery);
  const t = text(page('/boards/p1'));
  assert.match(t, /Kept/);
  assert.match(t, /Your saved board list could not be read in full/);
});

it('a project that does not exist says so, with the way back', () => {
  open([saved([project()])]);
  assert.match(text(page('/boards/nope')), /This board doesn.t exist/);
});

/** The board page mounted with react-dom/client (tests/pdf/fake-dom.mjs), its handlers called as clicks. */
async function mountBoard(path) {
  const dom = await import('./fake-dom.mjs');
  const Page = () => createElement(MemoryRouter, { initialEntries: [path] },
    createElement(Routes, null, createElement(Route, { path: '/boards/:id', element: createElement(Board) })));
  const view = dom.mount(Page, {});
  const ev = { stopPropagation() {}, preventDefault() {}, key: '' };
  const under = (node) => [...dom.elements(node)];
  const labelled = (label) => (el) => el.getAttribute('aria-label') === label || el.getAttribute('title') === label;
  /** The column titled `title` (its element, id="board-col-…"). */
  const column = (title) => under(view.container).find((el) => el.getAttribute('id')?.startsWith('board-col-') && el.textContent.startsWith(title));
  return {
    view,
    text: () => view.container.textContent,
    column,
    /** The first element under `node` (default: the page) labelled `label` (aria-label or title). */
    byLabel: (label, node = view.container) => under(node).find(labelled(label)),
    /** The first button under `node` whose text is `text`. */
    button: (text, node = view.container) => under(node).find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text),
    /** The card showing `title`: its clickable wrapper. */
    card: (title) => under(view.container).find((el) => el.tagName === 'DIV' && String(el.getAttribute('class')).includes('cursor-pointer') && el.textContent === title),
    click: (el) => view.act(() => dom.reactProps(el).onClick(ev)),
    type: (el, value) => view.act(() => dom.reactProps(el).onChange({ ...ev, target: { value } })),
  };
}

const boardNow = () => store.snapshot().boards.find((b) => b.id === 'p1');

it('the board page\'s actions reach the v2 store: add a card, label it, delete a list without losing its cards', async () => {
  open([saved([project()])]);
  const page = await mountBoard('/boards/p1');
  const confirms = [];
  globalThis.confirm = (q) => { confirms.push(q); return true; };
  try {
    // Add a card to Doing.
    page.click(page.button('Add a card', page.column('Doing')));
    page.type(page.byLabel('Card title'), 'Oil the gate');
    page.click(page.button('Add card'));
    const added = boardNow().issues.find((i) => i.title === 'Oil the gate');
    assert.equal(added?.columnId, 'c2');
    assert.match(page.text(), /Oil the gate/);

    // Open "Paint the fence" and pick two label colours: the board's own red label, and a new blue one.
    page.click(page.card('Paint the fence'));
    page.click(page.byLabel('Red'));
    page.click(page.byLabel('Blue'));
    const blue = boardNow().labels.find((l) => l.color === '#3b82f6');
    assert.ok(blue, 'a label for the new colour');
    assert.deepEqual(boardNow().issues.find((i) => i.id === 'i2').labelIds, ['l1', blue.id]);
    page.click(page.byLabel('Red'));
    assert.deepEqual(boardNow().issues.find((i) => i.id === 'i2').labelIds, [blue.id]);

    // Delete To Do: its two cards move to the list beside it, none lost.
    page.click(page.byLabel('Delete list', page.column('To Do')));
    assert.equal(confirms.length, 1);
    assert.match(confirms[0], /Its 2 cards will move to "Doing"/);
    const after = boardNow();
    assert.deepEqual(after.columns.map((c) => c.title), ['Doing', 'Done']);
    assert.deepEqual(after.issues.filter((i) => i.columnId === 'c2').map((i) => i.title).sort(), ['Buy nails', 'Fix the tap', 'Oil the gate', 'Paint the fence']);
  } finally {
    delete globalThis.confirm;
    await page.view.unmount();
  }
});

it('the card sheet\'s title takes what is typed — a space between words, a field cleared to retype — and the store keeps a clean title', async () => {
  open([saved([project()])]);
  const page = await mountBoard('/boards/p1');
  const dom = await import('./fake-dom.mjs');
  try {
    page.click(page.card('Paint the fence'));
    const field = () => [...dom.elements(page.view.container)].find((el) => el.tagName === 'TEXTAREA' && el.getAttribute('aria-label') === 'Card title');
    const shows = () => dom.reactProps(field()).value;
    // The store cleans every title (updateIssue: trimmed, never blank); the field used to show
    // the cleaned one back at each keystroke, so the space before a next word was taken away.
    page.type(field(), 'Paint the fence ');
    assert.equal(shows(), 'Paint the fence ');
    page.type(field(), 'Paint the fence white');
    assert.equal(shows(), 'Paint the fence white');
    assert.equal(boardNow().issues.find((i) => i.id === 'i2').title, 'Paint the fence white');
    page.type(field(), '');
    assert.equal(shows(), '', 'a cleared field stays clear while it is being retyped');
    assert.equal(boardNow().issues.find((i) => i.id === 'i2').title, 'Paint the fence white', 'a blank title is never saved');
    page.view.act(() => dom.reactProps(field()).onBlur({}));
    assert.equal(shows(), 'Paint the fence white', 'left blank, the field shows the saved title again');
  } finally {
    await page.view.unmount();
  }
});

it('a label colour whose palette name another label of the board already has gets a label of its own', async () => {
  // "Blue" is the palette's name for #3b82f6; this board already has a green label called "Blue".
  // addLabel hands back the label that has the name, so the card used to get the green one, and
  // the blue swatch never showed as picked.
  open([saved([project({ labels: [{ id: 'l1', name: 'Urgent', color: '#ef4444' }, { id: 'lg', name: 'Blue', color: '#22c55e' }] })])]);
  const page = await mountBoard('/boards/p1');
  try {
    page.click(page.card('Paint the fence'));
    page.click(page.byLabel('Blue'));
    const labels = boardNow().labels;
    const ids = boardNow().issues.find((i) => i.id === 'i2').labelIds;
    assert.equal(ids.length, 1);
    const picked = labels.find((l) => l.id === ids[0]);
    assert.equal(picked.color, '#3b82f6');
    assert.notEqual(picked.id, 'lg');
    assert.equal(labels.find((l) => l.id === 'lg').color, '#22c55e', 'the green label is left as it was');
    assert.equal(page.byLabel('Blue').getAttribute('aria-pressed'), 'true');
  } finally {
    await page.view.unmount();
  }
});

it('the only list is never deleted (the store would refuse): the page says why; an empty list goes without a question', async () => {
  open([saved([project({ columns: [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress')], issues: [issue('i1', 1, 'Fix the tap', 'c1')] })])]);
  const page = await mountBoard('/boards/p1');
  const asked = [];
  globalThis.alert = (m) => asked.push(['alert', m]);
  globalThis.confirm = (m) => { asked.push(['confirm', m]); return true; };
  try {
    page.click(page.byLabel('Delete list', page.column('Doing')));
    assert.deepEqual(asked, [], 'an empty list: no question');
    assert.deepEqual(boardNow().columns.map((c) => c.id), ['c1']);
    page.click(page.byLabel('Delete list', page.column('To Do')));
    assert.deepEqual(asked.map(([kind]) => kind), ['alert']);
    assert.match(asked[0][1], /at least one list/);
    assert.deepEqual(boardNow().columns.map((c) => c.id), ['c1']);
    assert.deepEqual(boardNow().issues.map((i) => i.title), ['Fix the tap']);
  } finally {
    delete globalThis.alert;
    delete globalThis.confirm;
    await page.view.unmount();
  }
});
