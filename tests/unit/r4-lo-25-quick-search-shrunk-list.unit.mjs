// R4-LO-25: the top bar's quick search kept the highlighted row's index while the list under it
// changed. The list is searched again on every render from the live workspace, so it can shrink while
// it is open (an issue deleted, a sync, another tab): an index past its new end made Enter do
// nothing. And ArrowDown with no results set the index to -1, so once results came Enter did nothing
// either. Pinned: Enter opens the row that is highlighted in the list as it is now.
// The top bar is mounted with react-dom/client over tests/pdf/fake-dom.mjs through Vite's SSR loader,
// as in collection-sync-status.unit.mjs. Run: node --test tests/unit/r4-lo-25-quick-search-shrunk-list.unit.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { kitLoader, patchFakeDom, mount, ev, reactProps, byAttr } from './ui-dom-harness.mjs';

let kit;
let TopBar;
before(async () => {
  patchFakeDom();
  kit = await kitLoader();
  ({ TopBar } = await kit.load('/src/components/shell/TopBar.jsx'));
});
after(() => kit?.close());

const hit = (id) => ({ kind: 'project', id, title: `Project ${id}`, subtitle: id.toUpperCase(), color: '#2563eb', to: `/boards/${id}` });

/** The top bar at '/', searching `hits` (set again with `results(list)`); `where()` the current path. */
function topBar(hits) {
  let where = '/';
  function Where() { where = useLocation().pathname; return null; }
  const App = ({ list }) => createElement(MemoryRouter, { initialEntries: ['/'] },
    createElement(TopBar, { projects: [], search: () => list }), createElement(Where));
  const view = mount(App, { list: hits });
  const box = () => byAttr(view.container, 'aria-label', 'Search issues and projects')[0];
  return {
    view,
    where: () => where,
    results: (list) => view.update({ list }),
    type: (value) => {
      view.act(() => reactProps(box()).onFocus());
      view.act(() => reactProps(box()).onChange({ target: { value } }));
    },
    key: (key) => view.act(() => reactProps(box()).onKeyDown(ev({ key }))),
    // The router moves in a React transition, rendered over several tasks (tests/unit/ui-shell.unit.mjs):
    // Enter, then let it finish before reading where it went.
    enter: async () => {
      view.act(() => reactProps(box()).onKeyDown(ev({ key: 'Enter' })));
      for (let i = 0; i < 40; i += 1) {
        await new Promise((resolve) => { setTimeout(resolve, 0); });
        view.act(() => {});
      }
    },
    highlighted: () => box().getAttribute('aria-activedescendant'),
  };
}

describe('the quick search opens the highlighted row of the list as it is now (R4-LO-25)', () => {
  it('the list shrank past the highlighted row: Enter opens its last row', async () => {
    const t = topBar([hit('a'), hit('b'), hit('c')]);
    try {
      t.type('project');
      t.key('ArrowDown');
      t.key('ArrowDown');
      assert.match(t.highlighted(), /-2$/, 'the third row is highlighted');
      t.results([hit('a')]);
      assert.match(t.highlighted(), /-0$/, 'the only row left is highlighted');
      await t.enter();
      assert.equal(t.where(), '/boards/a', 'Enter opened the row');
    } finally { await t.view.unmount(); }
  });

  it('ArrowDown with no results, then results: Enter opens the first', async () => {
    const t = topBar([]);
    try {
      t.type('proj');
      t.key('ArrowDown');
      t.results([hit('a'), hit('b')]);
      await t.enter();
      assert.equal(t.where(), '/boards/a');
    } finally { await t.view.unmount(); }
  });

  it('ArrowUp from a row past the end moves to the row above the last', async () => {
    const t = topBar([hit('a'), hit('b'), hit('c')]);
    try {
      t.type('project');
      t.key('ArrowDown');
      t.key('ArrowDown');
      t.results([hit('a'), hit('b')]);
      t.key('ArrowUp');
      await t.enter();
      assert.equal(t.where(), '/boards/a');
    } finally { await t.view.unmount(); }
  });
});
