// R5-JOB-03: the top bar's quick-search results had no height cap: 8 two-line rows (~390 px) under
// a box ~52 px down ran past the bottom of a short window (a landscape phone, 740x360), where the
// shell's overflow-hidden clipped them and nothing could scroll to them, and ArrowDown moved the
// highlight onto rows out of sight. Now the panel is at most min(24rem, the window under the box)
// and scrolls inside itself, and the arrow keys keep the highlighted row scrolled into view
// ('nearest', the least scroll). Still 8 results.
// The top bar is mounted with react-dom/client over tests/pdf/fake-dom.mjs through Vite's SSR loader,
// as in r4-lo-25-quick-search-shrunk-list.unit.mjs. fake-dom has no layout, so the cap is read from
// the panel's classes and the scrolling from scrollIntoView's calls.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fakeWindow } from '../pdf/fake-dom.mjs';
import { kitLoader, patchFakeDom, mount, ev, reactProps, byAttr } from './ui-dom-harness.mjs';

let kit;
let TopBar;
before(async () => {
  patchFakeDom();
  kit = await kitLoader();
  ({ TopBar } = await kit.load('/src/components/shell/TopBar.jsx'));
});
after(() => kit?.close());

const hits = Array.from({ length: 8 }, (_, i) => ({
  kind: 'project', id: `p${i}`, title: `Project ${i}`, subtitle: `P${i}`, color: '#2563eb', to: `/boards/p${i}`,
}));

function topBar() {
  const App = () => createElement(MemoryRouter, { initialEntries: ['/'] },
    createElement(TopBar, { projects: [], search: () => hits }));
  const view = mount(App);
  const box = () => byAttr(view.container, 'aria-label', 'Search issues and projects')[0];
  return {
    view,
    type: (value) => {
      view.act(() => reactProps(box()).onFocus());
      view.act(() => reactProps(box()).onChange({ target: { value } }));
    },
    key: (key) => view.act(() => reactProps(box()).onKeyDown(ev({ key }))),
    list: () => byAttr(view.container, 'role', 'listbox')[0],
  };
}

it('R5-JOB-03: the results panel is capped to the window and scrolls inside itself', async () => {
  const t = topBar();
  try {
    t.type('project');
    const list = t.list();
    assert.ok(list, 'the results are shown');
    assert.equal(byAttr(list, 'role', 'option').length, 8, 'still 8 results');
    const panel = list.parentNode;
    const classes = (panel.getAttribute('class') || '').split(/\s+/);
    const cap = classes.find((c) => c.startsWith('max-h-['));
    assert.ok(cap, `a height cap on the panel: ${classes.join(' ')}`);
    assert.match(cap, /100dvh/, 'tied to the window height');
    assert.match(cap, /24rem/, 'and never more than 24rem');
    assert.ok(classes.includes('overflow-y-auto'), 'the panel scrolls');
    assert.ok(!classes.includes('overflow-hidden'), 'not clipped');
  } finally { await t.view.unmount(); }
});

it('R5-JOB-03: ArrowDown keeps the highlighted row scrolled into view', async () => {
  const Element = Object.getPrototypeOf(fakeWindow().document.body);
  const had = Object.hasOwn(Element, 'scrollIntoView');
  const saved = Element.scrollIntoView;
  const calls = [];
  Element.scrollIntoView = function scrollIntoView(options) { calls.push({ id: this.getAttribute('id'), options }); };
  const t = topBar();
  try {
    t.type('project');
    for (let i = 0; i < 7; i += 1) t.key('ArrowDown');
    const last = byAttr(t.list(), 'role', 'option')[7];
    assert.equal(last.getAttribute('aria-selected'), 'true', 'the eighth row is highlighted');
    const call = calls.at(-1);
    assert.ok(call, 'a highlighted row is scrolled into view');
    assert.equal(call.id, last.getAttribute('id'), 'the highlighted row');
    assert.deepEqual(call.options, { block: 'nearest' }, 'by the least scroll');
    t.key('ArrowUp');
    assert.equal(calls.at(-1).id, byAttr(t.list(), 'role', 'option')[6].getAttribute('id'), 'ArrowUp too');
  } finally {
    await t.view.unmount();
    if (had) Element.scrollIntoView = saved; else delete Element.scrollIntoView;
  }
});

// Review of R5-JOB-03: the scroll ran on every change of the highlighted row, hover included.
// Resting the pointer on a row cut off at the panel's bottom scrolled the list; the browser's mouse
// move after a scroll then highlighted the row now under the still pointer, which scrolled again,
// and the list crept to its end on its own. Only the keyboard (the arrows, typing) scrolls now.
it('R5-JOB-03: a row highlighted by the pointer is not scrolled into view', async () => {
  const Element = Object.getPrototypeOf(fakeWindow().document.body);
  const had = Object.hasOwn(Element, 'scrollIntoView');
  const saved = Element.scrollIntoView;
  const calls = [];
  Element.scrollIntoView = function scrollIntoView(options) { calls.push({ id: this.getAttribute('id'), options }); };
  const t = topBar();
  try {
    t.type('project');
    const rows = () => byAttr(t.list(), 'role', 'option');
    const before = calls.length;
    t.view.act(() => reactProps(rows()[7]).onMouseEnter());
    assert.equal(rows()[7].getAttribute('aria-selected'), 'true', 'the hovered row is highlighted');
    t.view.act(() => reactProps(rows()[6]).onMouseEnter());
    assert.equal(rows()[6].getAttribute('aria-selected'), 'true', 'and the next one hovered');
    assert.equal(calls.length, before, `the pointer never scrolls the list: ${JSON.stringify(calls.slice(before))}`);
    t.key('ArrowDown');
    assert.equal(calls.at(-1)?.id, rows()[7].getAttribute('id'), 'the arrow keys still do');
    t.type('projec');
    assert.equal(rows()[0].getAttribute('aria-selected'), 'true', 'typing highlights the first row');
    assert.equal(calls.at(-1)?.id, rows()[0].getAttribute('id'), 'and scrolls it into view');
  } finally {
    await t.view.unmount();
    if (had) Element.scrollIntoView = saved; else delete Element.scrollIntoView;
  }
});
