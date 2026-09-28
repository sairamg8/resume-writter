// R4-DPH-11 (the top bar's search): the workspace top bar's quick search was 14 px (text-sm) on every
// screen. It shows from 640 px up, iPads and phones on their side among them, and iOS Safari zooms
// the page into any field under 16 px it focuses, so a tap on the search zoomed the whole workspace.
// The kit's controls (controlClass) and the job tracker's fields are 16 px on a touch screen
// (pointer-coarse:text-base, tests/pdf/81-job-inputs-touch-text.test.mjs); pinned: the top bar's
// search is too. The real TopBar is mounted over tests/pdf/fake-dom.mjs through Vite's SSR loader,
// as in tests/unit/r4-lo-25-quick-search-shrunk-list.unit.mjs.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { kitLoader, patchFakeDom, mount, byAttr } from '../unit/ui-dom-harness.mjs';

let kit;
let TopBar;
before(async () => {
  patchFakeDom();
  kit = await kitLoader();
  ({ TopBar } = await kit.load('/src/components/shell/TopBar.jsx'));
});
after(() => kit?.close());

it('the top bar’s search box is 16 px on a touch screen', async () => {
  const App = () => createElement(MemoryRouter, { initialEntries: ['/boards'] },
    createElement(TopBar, { projects: [], search: () => [] }));
  const view = mount(App, {});
  try {
    const box = byAttr(view.container, 'aria-label', 'Search issues and projects')[0];
    assert.ok(box, 'the top bar has its search box');
    assert.equal(box.tagName, 'INPUT');
    const tokens = box.className.split(/\s+/).filter(Boolean);
    assert.ok(tokens.includes('pointer-coarse:text-base'), `14 px on a touch screen, so iOS zooms into it: ${tokens.join(' ')}`);
    // Nothing that only a breakpoint applies shrinks it back under 16 px.
    assert.ok(!tokens.some((t) => /^pointer-coarse:text-(xs|sm|\[)/.test(t)), 'no smaller size for touch screens');
  } finally { await view.unmount(); }
});
