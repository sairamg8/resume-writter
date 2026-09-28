// R4-DPH-01: a project's Timeline on a phone. The sticky name column (the header's "Issue" cell and
// every row's name cell) was w-80, 320px, and the today line sat at a literal 320px past the edge:
// in the ~343px scroll box at 375px wide the column covered all but one 28px day, and the bars slid
// under the names as the grid scrolled. Now the column's width is one variable the page sets on the
// grid — 10rem below sm, 20rem (today's 320px) from sm up — read by the header, each row and the
// today line; and below sm an epic's child is indented half as far (12px, not 24px) so its title
// keeps room in the narrower column. The real page is rendered through Vite's loader
// (tests/pdf/harness.mjs) with react-dom/server over the board store, as tests/pdf/82-board-pages
// does; the fake DOM has no layout, so the class tokens and styles that make it are what is read.
import { before, after, afterEach, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { setup, teardown, loadModule } from './harness.mjs';

let ProjectTimeline;
let store;
let dates;
before(async () => {
  await setup();
  ({ ProjectTimeline } = await loadModule('/src/pages/ProjectTimeline.jsx'));
  store = await loadModule('/src/hooks/useBoardStore.js');
  const model = await loadModule('/src/utils/boardModel.js');
  const grid = await loadModule('/src/utils/calendarGrid.js');
  dates = { ...model, ...grid };
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

/** The Timeline of a project with an epic, its child (due in the range) and an issue in no epic. */
function timeline() {
  const due = dates.addDays(dates.todayISO(), 3);
  const project = {
    id: 'p1', key: 'HOME', title: 'Home jobs', color: '#6366f1',
    columns: [col('c1', 'To Do'), col('c2', 'Doing', 'inprogress'), col('c3', 'Done', 'done')],
    labels: [], sprints: [],
    issues: [
      issue('e1', 1, 'Kitchen', { type: 'epic' }),
      issue('i2', 2, 'Fix the tap', { epicId: 'e1', due, startDate: dates.todayISO() }),
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

/** Every opening `tag` in `html`: its class tokens, its style, and the markup after it. */
function opening(html, tag) {
  return [...html.matchAll(new RegExp(`<${tag} ([^>]*)>`, 'g'))].map((m) => ({
    tokens: (/\bclass="([^"]*)"/.exec(m[1])?.[1] ?? '').split(/\s+/).filter(Boolean),
    style: /\bstyle="([^"]*)"/.exec(m[1])?.[1] ?? '',
    after: html.slice(m.index + m[0].length),
  }));
}

it('R4-DPH-01: the grid sets the name column to 10rem on a phone and 20rem from sm up, and a child\'s indent to 12px then 24px', () => {
  const html = timeline();
  const grids = opening(html, 'div').filter((d) => d.tokens.includes('relative') && d.tokens.includes('w-max'));
  assert.equal(grids.length, 1, 'the one grid of rows');
  const [grid] = grids;
  for (const t of ['[--name-w:10rem]', 'sm:[--name-w:20rem]', '[--depth-w:12px]', 'sm:[--depth-w:24px]']) {
    assert.ok(grid.tokens.includes(t), `the grid sets ${t}`);
  }
  assert.match(grid.after, /^<div class="sticky top-0/, 'the header row is inside the grid, so it inherits the widths');
});

it('R4-DPH-01: the header\'s Issue cell and every row\'s name cell are the variable\'s width, not a fixed 320px', () => {
  const html = timeline();
  const sticky = opening(html, 'div').filter((d) => d.tokens.includes('sticky') && d.tokens.includes('left-0'));
  const header = sticky.find((d) => d.after.startsWith('Issue</div>'));
  assert.ok(header, 'the header\'s Issue cell');
  const rows = sticky.filter((d) => d !== header).map((d) => ({ ...d, key: />(HOME-\d+)</.exec(d.after)?.[1] }));
  assert.deepEqual(rows.map((r) => r.key), ['HOME-1', 'HOME-2', 'HOME-3'], 'the epic, its child, then the issue in no epic');
  for (const cell of [header, ...rows]) {
    const name = cell.key ?? 'Issue';
    assert.ok(cell.tokens.includes('w-(--name-w)'), `${name}: the name column's width`);
    assert.ok(!cell.tokens.includes('w-80'), `${name}: no fixed 320px column`);
    assert.ok(cell.tokens.includes('shrink-0'), `${name}: the column keeps its width`);
  }
});

it('R4-DPH-01: a child row is indented by one step of the variable (halved on a phone); top-level rows by none', () => {
  const html = timeline();
  const rows = opening(html, 'div')
    .filter((d) => d.tokens.includes('sticky') && d.tokens.includes('left-0') && !d.after.startsWith('Issue</div>'))
    .map((d) => ({ key: />(HOME-\d+)</.exec(d.after)?.[1], style: d.style }));
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.style]));
  assert.match(byKey['HOME-2'], /padding-left:calc\(12px \+ 1 \* var\(--depth-w\)\)/, 'the epic\'s child: one step in');
  assert.doesNotMatch(byKey['HOME-2'], /padding-left:36px/, 'not a fixed 24px step');
  for (const key of ['HOME-1', 'HOME-3']) assert.match(byKey[key], /padding-left:calc\(12px \+ 0 \* var\(--depth-w\)\)/, `${key}: no step`);
});

it('R4-DPH-01: the today line sits past the name column\'s width, on today\'s day, not at a literal 320px', () => {
  const html = timeline();
  const lines = opening(html, 'span').filter((s) => s.tokens.includes('absolute') && s.tokens.includes('bg-brand/70'));
  assert.equal(lines.length, 1, 'the today line');
  const today = dates.todayISO();
  const todayAt = dates.daysBetween(dates.addDays(dates.weekStart(today), -7), today);
  assert.equal(lines[0].style, `left:calc(var(--name-w) + ${todayAt * 28 + 14}px)`);
  assert.doesNotMatch(lines[0].style, /left:\d+px/);
});
