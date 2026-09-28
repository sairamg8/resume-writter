// R4-DPH-06: on a phone the project toolbar (the board, the list, the calendar, the backlog) is the
// search and one "Filters" button, with how many filters are set; the Epic / Type / Label /
// Priority filters, the quick filters, "Clear filters" and "Group by" show under it once it is
// tapped. They wrapped over three or four rows below the search (about 150px at 375px wide),
// above a board that only scrolls in the height left. From md up the toolbar is one row as before:
// the button is md:hidden and the filters' wrapper md:contents, so its children are the toolbar's.
// fake-dom has no layout: the real BoardToolbar is mounted with react-dom/client over fake-dom,
// through Vite's loader (tests/pdf/harness.mjs), and the classes that make the layout are read.
// Run: node --test tests/pdf/103-r4-dph-06-board-toolbar-filters.test.mjs
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom, ev } from '../unit/ui-dom-harness.mjs';

let BoardToolbar;
let EMPTY_FILTERS;
before(async () => {
  await setup();
  patchFakeDom();
  ({ BoardToolbar, EMPTY_FILTERS } = await loadModule('/src/components/board/BoardToolbar.jsx'));
});
after(teardown);

const tokens = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
/** Whether `el` sits somewhere inside `box`. */
const within = (el, box) => { for (let n = el.parentNode; n; n = n.parentNode) if (n === box) return true; return false; };

// One epic and one label, so every filter shows; a priority and a quick filter set (2 in all).
const board = {
  id: 'p1', key: 'HOME', columns: [], sprints: [],
  labels: [{ id: 'l1', name: 'Urgent', color: '#ef4444' }],
  issues: [{ id: 'e1', number: 1, type: 'epic', title: 'Garden makeover', columnId: 'c1', labelIds: [] }],
};

it('below md: the search and a "Filters" button with the count; the filters open under them; from md up one row as before', async () => {
  const filters = { ...EMPTY_FILTERS, priorities: ['high'], due: 'overdue' };
  const view = mount(BoardToolbar, { board, filters, onChange: () => {}, groupBy: 'none', onGroupBy: () => {} });
  try {
    const all = () => [...elements(view.container)];
    const button = (text) => all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === text);

    const search = all().find((el) => el.tagName === 'INPUT' && el.getAttribute('aria-label') === 'Search this project');
    assert.ok(search, 'the toolbar has its search');
    const searchBox = search.parentNode;
    const bar = searchBox.parentNode;
    assert.deepEqual(tokens(bar), ['flex', 'flex-wrap', 'items-center', 'gap-1.5', 'px-4', 'py-3', 'md:px-8'], 'the toolbar itself is as it was');

    // The search shares its row with the button (it took a whole row of its own: w-full), and is 13rem from md up.
    const box = tokens(searchBox);
    for (const t of ['flex-1', 'min-w-0', 'md:w-52', 'md:flex-initial']) assert.ok(box.includes(t), `the search box has ${t}: ${box.join(' ')}`);
    assert.ok(!box.includes('w-full'), 'the search no longer takes a row of its own on a phone');

    const toggle = all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim().startsWith('Filters'));
    assert.ok(toggle, 'a phone gets one "Filters" button');
    assert.ok(toggle.parentNode === bar, 'the Filters button sits beside the search');
    assert.ok(tokens(toggle).includes('md:hidden'), 'no Filters button from md up: the filters are in the row there');
    assert.equal(toggle.textContent.trim(), 'Filters2', 'it counts what is set: a priority and the Overdue quick filter');
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');

    // Every filter, the quick filters, Clear filters and Group by are in one wrapper, the search not.
    const type = button('Type');
    assert.ok(type, 'the Type filter is rendered');
    const panel = type.parentNode;
    assert.ok(panel !== bar && panel.parentNode === bar, 'the filters sit in a wrapper of their own inside the toolbar');
    for (const name of ['Epic', 'Label', 'Priority1', 'Overdue', 'Due this week', 'Clear filters', 'Group by: None']) {
      const b = button(name);
      assert.ok(b, `${name} is rendered`);
      assert.ok(within(b, panel), `${name} is behind the Filters button on a phone`);
    }
    assert.ok(!within(search, panel) && !within(toggle, panel), 'the search and the Filters button stay out of it');

    const closed = tokens(panel);
    assert.ok(closed.includes('max-md:hidden'), `closed on a phone at first: ${closed.join(' ')}`);
    assert.ok(closed.includes('md:contents'), 'from md up the wrapper leaves the layout, and its buttons are the toolbar\'s as before');

    view.act(() => reactProps(toggle).onClick(ev()));
    const open = tokens(panel);
    assert.ok(!open.includes('max-md:hidden'), `a tap on Filters shows them: ${open.join(' ')}`);
    for (const t of ['flex', 'w-full', 'flex-wrap', 'md:contents']) assert.ok(open.includes(t), `open, a row of its own under the search (${t})`);
    assert.equal(toggle.getAttribute('aria-expanded'), 'true');

    view.act(() => reactProps(toggle).onClick(ev()));
    assert.ok(tokens(panel).includes('max-md:hidden'), 'a second tap folds them away');
  } finally { await view.unmount(); }
});

it('the Filters button shows no count and is drawn plain while nothing is set', async () => {
  const view = mount(BoardToolbar, { board, filters: EMPTY_FILTERS, onChange: () => {} });
  try {
    const toggle = [...elements(view.container)].find((el) => el.tagName === 'BUTTON' && el.textContent.trim().startsWith('Filters'));
    assert.ok(toggle, 'a phone gets one "Filters" button');
    assert.equal(toggle.textContent.trim(), 'Filters');
    assert.ok(!tokens(toggle).includes('bg-brand-subtle'), 'drawn as a filter with nothing ticked');
  } finally { await view.unmount(); }
});
