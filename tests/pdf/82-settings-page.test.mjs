// A project's Settings page (/boards/:id/settings), which was a placeholder: nothing on screen could
// set a column's WIP limit, change how long done issues stay on the board, or edit the key, the
// columns or the labels. Here the real page and the real board store are mounted with
// react-dom/client (tests/pdf/fake-dom.mjs, through Vite's loader), their handlers called as the
// browser would, and every change is read back from the store — including what it refuses.
import { before, after, beforeEach, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

const KEY = 'cpwtcv_boards_v2';

let BoardSettings;
let store;
before(async () => {
  await setup();
  ({ BoardSettings } = await loadModule('/src/pages/BoardSettings.jsx'));
  store = await loadModule('/src/hooks/useBoardStore.js');
});
after(teardown);

class Storage {
  constructor(entries = []) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

beforeEach(() => { store._resetBoardStoreForTest(); });
afterEach(() => { delete globalThis.localStorage; delete globalThis.confirm; });

const col = (id, title, category = 'todo') => ({ id, title, category, wipLimit: null });
const issue = (id, number, title, columnId, extra = {}) => ({ id, number, type: 'task', title, columnId, labelIds: [], checklist: [], ...extra });
const project = (id, key, extra = {}) => ({
  id, key, title: `Project ${key}`, color: '#6366f1', mode: 'kanban', description: '',
  columns: [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')],
  labels: [{ id: 'l1', name: 'Urgent', color: '#ef4444' }, { id: 'l2', name: 'Home', color: '#3b82f6' }],
  sprints: [],
  issues: [issue('i1', 1, 'Fix the tap', 'c1', { labelIds: ['l1'] }), issue('i2', 2, 'Paint the fence', 'c2')],
  nextNumber: 3, hideDoneAfterDays: 14,
  ...extra,
});

async function mountSettings(path = '/boards/p1/settings') {
  globalThis.localStorage = new Storage([[KEY, JSON.stringify({ boards: [project('p1', 'HOME'), project('p2', 'WORK')], dataVersion: 2 })]]);
  store.subscribe(() => {});
  const dom = await import('./fake-dom.mjs');
  const view = dom.mount(() => createElement(MemoryRouter, { initialEntries: [path] },
    createElement(Routes, null,
      createElement(Route, { path: '/boards/:id/settings', element: createElement(BoardSettings) }),
      createElement(Route, { path: '/boards', element: createElement('p', null, 'Projects list') }))), {});
  const ev = { stopPropagation() {}, preventDefault() {}, key: '' };
  const all = (node = view.container) => [...dom.elements(node)];
  const props = (el) => dom.reactProps(el);
  const page = {
    view,
    text: () => view.container.textContent,
    find: (attr, value) => all().find((el) => el.getAttribute(attr) === value),
    byLabel: (label, node) => all(node).find((el) => el.getAttribute('aria-label') === label),
    allByLabel: (label, node) => all(node).filter((el) => el.getAttribute('aria-label') === label),
    button: (text, node) => all(node).find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text),
    click: (el) => view.act(() => props(el).onClick(ev)),
    change: (el, value) => view.act(() => props(el).onChange({ ...ev, target: { value } })),
    /** Type into a field that saves when left: change, then blur. */
    enter: (el, value) => { page.change(el, value); view.act(() => props(el).onBlur(ev)); },
  };
  return page;
}

const p1 = () => store.snapshot().boards.find((b) => b.id === 'p1');

it('details: name, description, colour and mode are saved; a taken or bad key is refused and said so', async () => {
  const page = await mountSettings();
  try {
    page.enter(page.byLabel('Project name'), 'House jobs');
    page.enter(page.byLabel('Project description'), 'Things to fix at home');
    page.click(page.byLabel('Colour #10b981'));
    page.change(page.byLabel('Project mode'), 'scrum');
    assert.deepEqual([p1().title, p1().description, p1().color, p1().mode], ['House jobs', 'Things to fix at home', '#10b981', 'scrum']);

    page.change(page.byLabel('Project key'), 'work');
    assert.match(page.text(), /WORK is already the key of “Project WORK”/, 'the live check names the clash');
    assert.ok(page.button('Save key').getAttribute('disabled') !== null);
    page.change(page.byLabel('Project key'), '1X');
    assert.match(page.text(), /Use 2–10 capital letters or digits/);
    page.change(page.byLabel('Project key'), 'house');
    page.click(page.button('Save key'));
    assert.equal(p1().key, 'HOUSE');
    assert.match(page.text(), /HOUSE-1/);
  } finally {
    await page.view.unmount();
  }
});

it('columns: rename, category, WIP limit (blank: none), reorder, add, delete — a column with issues moves them to the one picked', async () => {
  const page = await mountSettings();
  globalThis.confirm = () => true;
  try {
    const row = (id) => page.find('data-column', id);
    page.enter(page.byLabel('Column title', row('c2')), 'In progress');
    page.enter(page.byLabel('WIP limit', row('c2')), '2');
    page.change(page.byLabel('Column category', row('c1')), 'inprogress');
    let c = p1().columns;
    assert.deepEqual([c[1].title, c[1].wipLimit, c[0].category], ['In progress', 2, 'inprogress']);
    page.enter(page.byLabel('WIP limit', row('c2')), '');
    assert.equal(p1().columns[1].wipLimit, null);

    page.click(page.byLabel('Move column down', row('c1')));
    assert.deepEqual(p1().columns.map((x) => x.id), ['c2', 'c1', 'c3']);
    page.click(page.byLabel('Move column up', row('c3')));
    assert.deepEqual(p1().columns.map((x) => x.id), ['c2', 'c3', 'c1']);

    page.change(page.byLabel('New column'), 'Review');
    page.click(page.button('Add', page.byLabel('New column').parentNode));
    assert.equal(p1().columns.at(-1).title, 'Review', 'added at the end, as listed');

    // To Do holds "Fix the tap": deleting it asks where its issue goes.
    page.click(page.byLabel('Delete column', row('c1')));
    assert.ok(p1().columns.some((x) => x.id === 'c1'), 'not deleted before a target is picked');
    page.change(page.byLabel('Move its issues to', row('c1')), 'c3');
    page.click(page.button('Delete column', row('c1')));
    assert.ok(!p1().columns.some((x) => x.id === 'c1'));
    assert.equal(p1().issues.find((i) => i.id === 'i1').columnId, 'c3', 'moved, not lost');
    assert.ok(p1().issues.find((i) => i.id === 'i1').resolvedAt, 'into Done: resolved');
  } finally {
    await page.view.unmount();
  }
});

it('labels: add, rename (a taken name refused), recolour, delete off every issue', async () => {
  const page = await mountSettings();
  globalThis.confirm = () => true;
  try {
    page.change(page.byLabel('New label'), 'Garden');
    page.change(page.byLabel('New label colour'), '#22c55e');
    page.click(page.button('Add', page.byLabel('New label').parentNode));
    assert.deepEqual(p1().labels.find((l) => l.name === 'Garden')?.color, '#22c55e');

    const row = (id) => page.find('data-label', id);
    page.enter(page.byLabel('Label name', row('l2')), 'urgent');
    assert.equal(p1().labels.find((l) => l.id === 'l2').name, 'Home', 'a taken name is refused');
    assert.match(page.text(), /Another label is already called “urgent”/);
    page.enter(page.byLabel('Label name', row('l2')), 'House');
    page.change(page.byLabel('Label colour', row('l2')), '#a855f7');
    assert.deepEqual(p1().labels.find((l) => l.id === 'l2'), { id: 'l2', name: 'House', color: '#a855f7' });

    page.click(page.byLabel('Delete label', row('l1')));
    for (let n = 0; n < 5; n += 1) await new Promise((r) => { setImmediate(r); }); // the question is the kit's (here, the browser's) and answers later
    assert.ok(!p1().labels.some((l) => l.id === 'l1'));
    assert.deepEqual(p1().issues.find((i) => i.id === 'i1').labelIds, []);
  } finally {
    await page.view.unmount();
  }
});

it('R2-041b: a label name the board has, typed with other spacing or case, is refused and said so, adding or renaming', async () => {
  const page = await mountSettings();
  try {
    page.change(page.byLabel('New label'), 'Needs parts');
    page.click(page.button('Add', page.byLabel('New label').parentNode));
    assert.equal(p1().labels.length, 3, 'a new name is added');

    // The store keeps a label's name with runs of spaces made one (cleanTitle) and refuses a second
    // label with that name, case aside. The page compared names only trimmed and lower-cased, so
    // "needs   PARTS" was not taken to it: nothing was said, and the store refused it silently.
    page.change(page.byLabel('New label'), 'needs   PARTS');
    page.click(page.button('Add', page.byLabel('New label').parentNode));
    assert.equal(p1().labels.length, 3, 'no second "Needs parts"');
    assert.match(page.text(), /A label called “needs PARTS” already exists\./, 'the refusal is said, the name shown as it would be saved');

    const row = (id) => page.find('data-label', id);
    page.enter(page.byLabel('Label name', row('l2')), 'Needs    parts');
    assert.equal(p1().labels.find((l) => l.id === 'l2').name, 'Home', 'a taken name, in other spacing, is refused');
    assert.match(page.text(), /Another label is already called “Needs parts”\./);

    page.enter(page.byLabel('Label name', row('l2')), 'Needs  more   parts');
    assert.equal(p1().labels.find((l) => l.id === 'l2').name, 'Needs more parts', 'a name that is free is saved, cleaned');
    assert.doesNotMatch(page.text(), /already/, 'the message goes once a name is accepted');
  } finally {
    await page.view.unmount();
  }
});

it('done issues: the days are set, hiding is turned off (null) and on again; the project is deleted', async () => {
  const page = await mountSettings();
  globalThis.confirm = () => true;
  try {
    page.enter(page.byLabel('Days before done issues are hidden'), '30');
    assert.equal(p1().hideDoneAfterDays, 30);
    page.enter(page.byLabel('Days before done issues are hidden'), '-3');
    assert.equal(p1().hideDoneAfterDays, 30, 'not a day count: ignored');
    page.change(page.byLabel('Hide old done issues'), false);
    assert.equal(p1().hideDoneAfterDays, null);
    page.change(page.byLabel('Hide old done issues'), true);
    assert.equal(p1().hideDoneAfterDays, 14);

    page.click(page.button('Delete project'));
    // The question answers later, and the router's navigation is a transition.
    for (let n = 0; n < 5; n += 1) await new Promise((r) => { setImmediate(r); });
    assert.equal(p1(), undefined);
    assert.match(page.text(), /Projects list/);
    assert.ok(store.snapshot().boards.some((b) => b.id === 'p2'), 'the other project stays');
  } finally {
    await page.view.unmount();
  }
});
