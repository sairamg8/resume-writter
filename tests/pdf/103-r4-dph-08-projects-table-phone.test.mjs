// R4-DPH-08: on a phone the Projects table (/boards) fits the screen, so each row's actions menu
// (Summary, Project settings, Delete) is in view without a sideways pan. The table was at least
// 48rem (768px) wide at every width, with the menu at about x 720-768 of a 343px content box.
// Below sm it now drops the Key, Type, Lead and Updated columns — in the header and in every
// row — and its 48rem floor applies from sm up only; the Name button is contained inline, so a
// long project name is cut short in its cell rather than widening the table again. From sm up
// every column is back (sm:table-cell). R5-JOB-04: the Name button was contained on a phone only,
// so from sm up a long name still widened the table past its container; it is contained at every
// width now.
// fake-dom has no layout: the real page is rendered over the real board store through Vite's
// loader (tests/pdf/harness.mjs) with react-dom/server, and the classes that make the layout are read.
// Run: node --test tests/pdf/103-r4-dph-08-projects-table-phone.test.mjs
import { before, after, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

let Boards;
let store;
let KEY;
before(async () => {
  await setup();
  ({ Boards } = await loadModule('/src/pages/Boards.jsx'));
  store = await loadModule('/src/hooks/useBoardStore.js');
  ({ BOARDS_KEY: KEY } = await loadModule('/src/constants/boards.js'));
});
after(teardown);
afterEach(() => { delete globalThis.localStorage; });

/** A localStorage stand-in holding `entries`. */
class Storage {
  constructor(entries = []) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const TITLE = 'Home jobs and the long list of chores around the garden';
const project = {
  id: 'p1', key: 'HOME', title: TITLE, color: '#6366f1',
  columns: [{ id: 'c1', title: 'To Do', category: 'todo', wipLimit: null }],
  labels: [], sprints: [],
  issues: [{ id: 'i1', number: 1, type: 'task', title: 'Fix the tap', columnId: 'c1', labelIds: [], checklist: [] }],
  nextNumber: 2,
};

/** The markup of /boards over a saved list of one project. */
function render() {
  store._resetBoardStoreForTest();
  globalThis.localStorage = new Storage([[KEY, JSON.stringify({ boards: [project], dataVersion: 2 })]]);
  store.subscribe(() => {});
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/boards'] },
    createElement(Routes, null, createElement(Route, { path: '/boards', element: createElement(Boards) }))));
}

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const classOf = (attrs) => (/\bclass="([^"]*)"/.exec(attrs)?.[1] ?? '').split(/\s+/).filter(Boolean);
/** Every `<tag>` directly in `html` (cells do not nest here): its classes, its markup and its text. */
const cells = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, 'g'))]
  .map(([, attrs, inner]) => ({ cls: classOf(attrs), inner, text: text(inner) }));
const SIDEBAR_HIDDEN = ['hidden', 'sm:table-cell', 'md:max-lg:hidden']; // Key and Updated: also hidden between md and lg, where the sidebar takes the room (B17 sweep)
const NARROW_HIDDEN = ['hidden', 'xl:table-cell']; // Type and Lead: also hidden below xl (B17 sweep)

it('below sm the Projects table drops Key, Type, Lead and Updated in the header and every row, and loses its 48rem floor', () => {
  const html = render();
  const table = /<table\b([^>]*)>([\s\S]*?)<\/table>/.exec(html);
  assert.ok(table, 'the projects table is rendered');
  const tableClass = classOf(table[1]);
  assert.ok(tableClass.includes('xl:min-w-[48rem]'), `48rem wide from xl up, where all six columns are back (B17 sweep): ${tableClass.join(' ')}`);
  assert.ok(!tableClass.includes('min-w-[48rem]'), 'no 48rem floor on a phone: the table is as wide as the screen');
  assert.ok(tableClass.includes('w-full'));

  const head = cells(/<thead\b[^>]*>([\s\S]*?)<\/thead>/.exec(table[2])[1], 'th');
  assert.deepEqual(head.map((c) => c.text), ['Starred', 'Name', 'Key', 'Type', 'Lead', 'Issues', 'Updated', 'Actions']);
  const firstRow = /<tbody\b[^>]*>[\s\S]*?<tr\b[^>]*>([\s\S]*?)<\/tr>/.exec(table[2]);
  assert.ok(firstRow, 'the project has its row');
  const row = cells(firstRow[1], 'td');
  assert.equal(row.length, head.length, 'one cell per column');
  assert.match(row[2].text, /^HOME$/, 'the Key cell');
  assert.match(row[3].text, /^Kanban$/, 'the Type cell');
  assert.match(row[5].text, /^\d+ open · 1 total$/, 'the Issues cell');
  assert.match(row[7].inner, new RegExp(`aria-label="${TITLE} actions"`), 'the last cell holds the row\'s actions menu');

  const hidden = new Set(['Key', 'Type', 'Lead', 'Updated']);
  head.forEach((th, i) => {
    for (const [where, cell] of [['header', th], ['row', row[i]]]) {
      if (hidden.has(th.text)) {
        const shown = th.text === 'Type' || th.text === 'Lead' ? NARROW_HIDDEN : SIDEBAR_HIDDEN;
        for (const t of shown) assert.ok(cell.cls.includes(t), `${th.text} (${where}) is hidden on a phone and shown from ${shown[1].split(':')[0]} up: ${cell.cls.join(' ')}`);
      } else {
        assert.ok(!cell.cls.includes('hidden'), `${th.text} (${where}) stays on a phone: ${cell.cls.join(' ')}`);
      }
    }
  });
});

it('a long project name is cut short inside its cell at every width, so it cannot widen the table past the menu (R5-JOB-04)', () => {
  const html = render();
  const name = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].find(([, , inner]) => text(inner).endsWith(TITLE));
  assert.ok(name, 'the Name button: the project\'s avatar and title');
  const cls = classOf(name[1]);
  for (const t of ['w-full', 'contain-inline-size', 'min-w-0']) assert.ok(cls.includes(t), `the Name button has ${t}: ${cls.join(' ')}`);
  assert.ok(!cls.some((c) => /^[\w-]+:(w-full|contain-inline-size)$/.test(c)), `contained at every width, not behind a breakpoint: ${cls.join(' ')}`);
  assert.match(name[2], /class="truncate"/, 'the name itself ends in an ellipsis');
});
