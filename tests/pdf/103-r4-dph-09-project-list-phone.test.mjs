// R4-DPH-09: on a phone a project's List (/boards/:id/list) shows each issue's Status in view.
// The table was at least 64rem (1024px) wide at every width, and Status started about 424px in —
// past the whole 375px screen — behind Type, Key and a 16rem Summary. Below sm the Type, Labels,
// Parent, Points and Updated columns are hidden, in the header and in every row, the 64rem floor
// applies from sm up only, and Summary's floor is 10rem there (16rem from sm up, as before); the
// Summary button is contained inline, so a long summary is cut short in its cell rather than
// widening the column. Key, Summary, Status, Priority and Due date stay. From sm up every column
// is back (sm:table-cell). R5-JOB-06: the Summary button was contained on a phone only, so from sm
// up a long summary still widened the table past its floor; it is contained at every width now.
// fake-dom has no layout: the real page is rendered over the real board store through Vite's
// loader (tests/pdf/harness.mjs) with react-dom/server, and the classes that make the layout are read.
// Run: node --test tests/pdf/103-r4-dph-09-project-list-phone.test.mjs
import { before, after, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

let ProjectList;
let store;
let KEY;
before(async () => {
  await setup();
  ({ ProjectList } = await loadModule('/src/pages/ProjectList.jsx'));
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

const SUMMARY = 'Replace the kitchen tap washer and check every pipe under the sink';
const issue = (id, number, title, extra = {}) => ({ id, number, type: 'task', title, columnId: 'c1', labelIds: [], checklist: [], ...extra });
// HOME-1 fills every column: a label, a parent epic, a due date and points.
const project = {
  id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1',
  columns: [{ id: 'c1', title: 'To Do', category: 'todo', wipLimit: null }, { id: 'c2', title: 'Done', category: 'done', wipLimit: null }],
  labels: [{ id: 'l1', name: 'Urgent', color: '#ef4444' }],
  sprints: [],
  issues: [
    issue('i1', 1, SUMMARY, { labelIds: ['l1'], epicId: 'e1', due: '2030-01-02', estimate: 3 }),
    issue('e1', 2, 'Garden makeover', { type: 'epic' }),
  ],
  nextNumber: 3,
};

/** The markup of the project's List over a saved list holding `project`. */
function render() {
  store._resetBoardStoreForTest();
  globalThis.localStorage = new Storage([[KEY, JSON.stringify({ boards: [project], dataVersion: 2 })]]);
  store.subscribe(() => {});
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/boards/p1/list'] },
    createElement(Routes, null, createElement(Route, { path: '/boards/:id/list', element: createElement(ProjectList) }))));
}

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const classOf = (attrs) => (/\bclass="([^"]*)"/.exec(attrs)?.[1] ?? '').split(/\s+/).filter(Boolean);
/** Every `<tag>` in `html` (none of these nest here): its classes, its markup and its text. */
const cells = (html, tag) => [...html.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, 'g'))]
  .map(([, attrs, inner]) => ({ cls: classOf(attrs), inner, text: text(inner) }));
const PHONE_HIDDEN = ['hidden', 'sm:table-cell'];
const HIDDEN = new Set(['Type', 'Labels', 'Parent', 'Points', 'Updated']);

/** The List's table: its classes, header cells and body rows (each a list of cells). */
function table() {
  const html = render();
  const t = /<table\b([^>]*)>([\s\S]*?)<\/table>/.exec(html);
  assert.ok(t, 'the issues table is rendered');
  assert.match(t[2], /Issues of Home jobs/, 'the List\'s table');
  const head = cells(/<thead\b[^>]*>([\s\S]*?)<\/thead>/.exec(t[2])[1], 'th');
  const rows = cells(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/.exec(t[2])[1], 'tr').map((tr) => cells(tr.inner, 'td'));
  return { cls: classOf(t[1]), head, rows };
}

it('below sm the List drops Type, Labels, Parent, Points and Updated in the header and every row, and loses its 64rem floor', () => {
  const { cls, head, rows } = table();
  assert.ok(cls.includes('sm:min-w-[64rem]'), `64rem wide from sm up, as before: ${cls.join(' ')}`);
  assert.ok(!cls.includes('min-w-[64rem]'), 'no 64rem floor on a phone');
  assert.ok(cls.includes('w-full'));

  assert.deepEqual(head.map((c) => c.text), ['Type', 'Key', 'Summary', 'Status', 'Priority', 'Labels', 'Parent', 'Due date', 'Points', 'Updated']);
  assert.equal(rows.length, 2, 'the issue and its epic');
  const row = rows.find((r) => r[1]?.text === 'HOME-1');
  assert.ok(row, 'HOME-1 has its row');
  // The cells are where the header says: the fixture fills every one.
  assert.match(row[0].inner, /aria-label="Task"/, 'Type');
  assert.equal(row[2].text, SUMMARY, 'Summary');
  assert.match(row[3].inner, /aria-label="Status of HOME-1: To Do"/, 'Status');
  assert.match(row[5].inner, /title="Urgent"/, 'Labels');
  assert.match(row[6].inner, /title="Epic: Garden makeover"/, 'Parent');
  assert.match(row[7].inner, /2030/, 'Due date');
  assert.match(row[8].inner, /title="3 story points"/, 'Points');

  for (const r of rows) {
    assert.equal(r.length, head.length, 'one cell per column');
    head.forEach((th, i) => {
      for (const [where, cell] of [['header', th], [`row ${r[1].text}`, r[i]]]) {
        if (HIDDEN.has(th.text)) {
          for (const t of PHONE_HIDDEN) assert.ok(cell.cls.includes(t), `${th.text} (${where}) is hidden on a phone and shown from sm up: ${cell.cls.join(' ')}`);
        } else {
          assert.ok(!cell.cls.includes('hidden'), `${th.text} (${where}) stays on a phone: ${cell.cls.join(' ')}`);
        }
      }
    });
  }
});

it('on a phone Summary is 10rem at least (16rem from sm up) and a long summary is cut short inside it, so Status stays in view', () => {
  const { head, rows } = table();
  const summary = head.find((c) => c.text === 'Summary').cls;
  assert.ok(summary.includes('min-w-[10rem]') && summary.includes('sm:min-w-[16rem]'), `Summary: ${summary.join(' ')}`);
  assert.ok(!summary.includes('min-w-[16rem]'), 'no 16rem floor on a phone');

  const cell = rows.find((r) => r[1]?.text === 'HOME-1')[2];
  const button = /<button\b([^>]*)>([\s\S]*?)<\/button>/.exec(cell.inner);
  assert.ok(button && text(button[2]) === SUMMARY, 'the Summary button, with the issue\'s summary');
  const cls = classOf(button[1]);
  for (const t of ['w-full', 'contain-inline-size', 'truncate', 'max-w-full']) assert.ok(cls.includes(t), `the Summary button has ${t}: ${cls.join(' ')}`);
  assert.ok(!cls.some((c) => /^[\w-]+:(w-full|contain-inline-size)$/.test(c)), `contained at every width, not behind a breakpoint (R5-JOB-06): ${cls.join(' ')}`);
});
