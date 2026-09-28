// R4-DPH-04: the workspace top bar's quick search was `hidden sm:block`, display:none below 640 px, so
// a phone could not search issues and projects at all: nothing to tap, and the '/' hotkey focused a
// box that was not shown. No other search on a phone reaches across the projects. Pinned (the
// coordinator's product call): below sm a search button in the top bar opens the same search box as
// a bar over the top bar, focused within the tap (iOS raises its keyboard only for a focus the tap
// makes), and Escape, its X, a result picked or a tap elsewhere puts it away. From sm up the box is
// as it was: its classes then are exactly the old ones, and whatever the phone bar adds applies below
// sm only. The real TopBar is mounted over tests/pdf/fake-dom.mjs through Vite's SSR loader, as in
// tests/unit/r4-lo-25-quick-search-shrunk-list.unit.mjs.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { kitLoader, patchFakeDom, mount, ev, reactProps, byAttr, wait, assertSame } from '../unit/ui-dom-harness.mjs';

let kit;
let TopBar;
before(async () => {
  patchFakeDom();
  kit = await kitLoader();
  ({ TopBar } = await kit.load('/src/components/shell/TopBar.jsx'));
});
after(() => kit?.close());

const hit = (id) => ({ kind: 'project', id, title: `Project ${id}`, subtitle: id.toUpperCase(), color: '#2563eb', to: `/boards/${id}` });
const tokensOf = (el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
/** The search box's frame as it has always been: shown from sm up, display:none below it. */
const CLOSED = ['relative', 'hidden', 'w-full', 'max-w-[20rem]', 'sm:block'];
const sorted = (list) => [...list].sort();

/** The top bar at /boards, its search finding two projects. */
function topBar() {
  let where = '/boards';
  function Where() { where = useLocation().pathname; return null; }
  const App = () => createElement(MemoryRouter, { initialEntries: ['/boards'] },
    createElement(TopBar, { projects: [], search: () => [hit('a'), hit('b')] }), createElement(Where));
  const view = mount(App, {});
  const box = () => byAttr(view.container, 'aria-label', 'Search issues and projects')[0];
  const t = {
    view,
    where: () => where,
    box,
    frame: () => tokensOf(box().parentNode),
    searchButton: () => byAttr(view.container, 'aria-label', 'Search')[0],
    closeButton: () => byAttr(view.container, 'aria-label', 'Close search')[0],
    tap: () => {
      const button = t.searchButton();
      assert.ok(button, 'the top bar has a search button for phones');
      view.act(() => reactProps(button).onClick(ev()));
    },
    /** Let timers, the scheduler and the router's transition run, committing what they set. */
    settle: async () => {
      for (let i = 0; i < 40; i += 1) {
        await wait(0);
        view.act(() => {});
      }
    },
  };
  return t;
}

describe('the quick search on a phone (R4-DPH-04)', () => {
  it('a search button below sm opens the search box over the top bar, focused', async () => {
    const t = topBar();
    try {
      const button = t.searchButton();
      assert.ok(button, 'the top bar has a search button for phones');
      assert.equal(button.tagName, 'BUTTON');
      assert.ok(tokensOf(button).includes('sm:hidden'), 'the button is for phones only: from sm up the box is in the bar');
      assert.deepEqual(sorted(t.frame()), sorted(CLOSED), 'closed, the box is as it was: hidden below sm, shown from sm up');
      assert.equal(t.closeButton(), undefined, 'no X while it is closed');

      t.tap();
      const open = t.frame();
      assert.ok(!open.includes('hidden'), `opened, the box is shown on a phone: ${open.join(' ')}`);
      for (const token of ['max-sm:fixed', 'max-sm:inset-x-2', 'max-sm:top-3', 'max-sm:z-40', 'max-sm:w-auto', 'max-sm:max-w-none']) {
        assert.ok(open.includes(token), `a bar over the top bar, the screen's width: ${token}`);
      }
      // From sm up nothing changes: the old classes stay, and every class it gains is a phone's.
      for (const token of CLOSED.filter((c) => c !== 'hidden')) assert.ok(open.includes(token), `keeps ${token}`);
      assert.deepEqual(open.filter((c) => !CLOSED.includes(c) && !c.startsWith('max-sm:')), [], 'only phone classes are added');
      assertSame(t.view.document.activeElement, t.box(), 'the box is focused within the tap, so the phone keyboard comes up');
      const close = t.closeButton();
      assert.ok(close, 'an X to put it away');
      assert.ok(tokensOf(close).includes('sm:hidden'), 'the X is the phone bar\'s only');
    } finally { await t.view.unmount(); }
  });

  it('the X puts it away', async () => {
    const t = topBar();
    try {
      t.tap();
      t.view.act(() => reactProps(t.closeButton()).onClick(ev()));
      assert.deepEqual(sorted(t.frame()), sorted(CLOSED));
      assert.equal(t.closeButton(), undefined);
    } finally { await t.view.unmount(); }
  });

  it('Escape puts it away', async () => {
    const t = topBar();
    try {
      t.tap();
      t.view.act(() => reactProps(t.box()).onKeyDown(ev({ key: 'Escape' })));
      assert.deepEqual(sorted(t.frame()), sorted(CLOSED));
    } finally { await t.view.unmount(); }
  });

  it('a tap elsewhere (the box losing the focus) puts it away once the results have had their tap', async () => {
    const t = topBar();
    try {
      t.tap();
      t.view.act(() => reactProps(t.box()).onBlur(ev()));
      assert.ok(!t.frame().includes('hidden'), 'still open at once, so a tap on a result lands');
      await wait(150);
      await t.settle();
      assert.deepEqual(sorted(t.frame()), sorted(CLOSED));
    } finally { await t.view.unmount(); }
  });

  it('a result picked opens it and puts the bar away', async () => {
    const t = topBar();
    try {
      t.tap();
      t.view.act(() => reactProps(t.box()).onChange({ target: { value: 'project' } }));
      const options = byAttr(t.view.container, 'role', 'option');
      assert.equal(options.length, 2, 'the results show under the bar');
      t.view.act(() => reactProps(options[1]).onMouseDown(ev()));
      assert.deepEqual(sorted(t.frame()), sorted(CLOSED));
      await t.settle();
      assert.equal(t.where(), '/boards/b', 'the picked project opened');
    } finally { await t.view.unmount(); }
  });
});
