// R4-DVIS-20: a project's Timeline, a row under the pointer. The row turned grey on hover
// (hover:bg-hovered), but its sticky name cell is opaque white, so bars scrolled under it stay
// hidden, and it had no hover colour of its own: the highlight covered the days and stopped at the
// name, at every width. The row is now a hover group and the name cell takes the same grey on the
// row's hover (group-hover:bg-hovered, still opaque), keeping white as its resting colour. The real
// page is rendered through Vite's loader (tests/pdf/harness.mjs) with react-dom/server over the
// board store, as tests/pdf/103-r4-dph-01-timeline-name-column.test.mjs does; the fake DOM has no
// layout or hover, so the class tokens that make it are read. Fictional data only.
import { before, after, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

let ProjectTimeline;
let store;
let model;
before(async () => {
  await setup();
  ({ ProjectTimeline } = await loadModule('/src/pages/ProjectTimeline.jsx'));
  store = await loadModule('/src/hooks/useBoardStore.js');
  model = await loadModule('/src/utils/boardModel.js');
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

const col = (id, title, category = 'todo') => ({ id, title, category, wipLimit: null });
const issue = (id, number, title, extra = {}) => ({ id, number, type: 'task', title, columnId: 'c1', labelIds: [], checklist: [], ...extra });

/** The Timeline of a project with an epic, its child (a bar in the range) and an issue in no epic. */
function timeline() {
  const today = model.todayISO();
  const project = {
    id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1',
    columns: [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')],
    labels: [], sprints: [],
    issues: [
      issue('e1', 1, 'Kitchen', { type: 'epic' }),
      issue('i2', 2, 'Fix the tap', { epicId: 'e1', due: model.addDays(today, 3), startDate: today }),
      issue('i3', 3, 'Buy nails'),
    ],
    nextNumber: 4,
  };
  store._resetBoardStoreForTest();
  globalThis.localStorage = new Storage([['cpwtcv_boards_v2', JSON.stringify({ boards: [project], dataVersion: 2 })]]);
  store.subscribe(() => {});
  return renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/boards/p1/timeline'] },
    createElement(Routes, null, createElement(Route, { path: '/boards/:id/timeline', element: createElement(ProjectTimeline) }))));
}

const classOf = (attrs) => (/\bclass="([^"]*)"/.exec(attrs)?.[1] ?? '').split(/\s+/).filter(Boolean);

/** Every row's sticky name cell: its key, its class tokens, and the class tokens of the row it opens. */
function rows(html) {
  return [...html.matchAll(/<div ([^>]*)>/g)]
    .map((m) => ({ tokens: classOf(m[1]), before: html.slice(0, m.index), after: html.slice(m.index + m[0].length) }))
    .filter((d) => d.tokens.includes('sticky') && d.tokens.includes('left-0') && !d.after.startsWith('Issue</div>'))
    .map((d) => ({
      key: />(HOME-\d+)</.exec(d.after)?.[1],
      cell: d.tokens,
      // The cell is the row's first child, so the row's opening tag ends right before it.
      row: classOf(/<div ([^>]*)>$/.exec(d.before)?.[1] ?? ''),
    }));
}

it('R4-DVIS-20: each Timeline row is a hover group, and its sticky name cell takes the row\'s hover colour', () => {
  const html = timeline();
  const found = rows(html);
  assert.deepEqual(found.map((r) => r.key), ['HOME-1', 'HOME-2', 'HOME-3'], 'the epic, its child, then the issue in no epic');
  for (const { key, cell, row } of found) {
    for (const t of ['group', 'flex', 'h-10', 'hover:bg-hovered']) assert.ok(row.includes(t), `${key}: the row has ${t}: ${row.join(' ')}`);
    for (const t of ['sticky', 'bg-white', 'group-hover:bg-hovered']) assert.ok(cell.includes(t), `${key}: the name cell has ${t}: ${cell.join(' ')}`);
  }
});

it('R4-DVIS-20: the header\'s Issue cell and the grid are no hover group, so one row\'s hover greys no other', () => {
  const html = timeline();
  const divs = [...html.matchAll(/<div ([^>]*)>(Issue<\/div>)?/g)].map((m) => ({ tokens: classOf(m[1]), issue: Boolean(m[2]) }));
  const header = divs.find((d) => d.issue);
  assert.ok(header, 'the header\'s Issue cell');
  assert.ok(header.tokens.includes('bg-white') && !header.tokens.includes('group-hover:bg-hovered'), `the header cell stays white: ${header.tokens.join(' ')}`);
  const at = divs.findIndex((d) => d.tokens.includes('relative') && d.tokens.includes('w-max'));
  assert.ok(at >= 0, 'the grid of rows');
  assert.ok(!divs[at].tokens.includes('group'), 'the grid of rows is not a group');
  // The grid is the page's last block (no issue is open), so what follows it is the grid's own.
  assert.equal(divs.slice(at).filter((d) => d.tokens.includes('group')).length, 3, 'in the grid, only the three rows are hover groups');
});
