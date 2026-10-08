// B11 (workspace shell on the canvas look): the lazy workspace wears the shared AppBar and the phone's
// BottomTabBar, and the quick search names its two groups (Issues, Projects). Every shell function
// stays: Create, the project switcher, the menu button, the sidebar. TopBar is mounted over
// tests/pdf/fake-dom.mjs as in 103-r4-dph-04-phone-search.test.mjs; the layout is rendered to markup.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { kitLoader, patchFakeDom, mount, reactProps, byAttr, elements, wait } from '../unit/ui-dom-harness.mjs';

let kit;
let TopBar;
let WorkspaceLayout;
before(async () => {
  patchFakeDom();
  kit = await kitLoader();
  ({ TopBar } = await kit.load('/src/components/shell/TopBar.jsx'));
  ({ WorkspaceLayout } = await kit.load('/src/components/shell/WorkspaceLayout.jsx'));
});
after(() => kit?.close());

const issue = { kind: 'issue', id: 'i1', title: 'Fix the gutter', subtitle: 'Website', key: 'WEB-1', type: 'task', to: '/boards/w?issue=WEB-1' };
const project = { kind: 'project', id: 'w', title: 'Website', subtitle: 'WEB', color: '#2b59ff', to: '/boards/w' };

describe('B11: the workspace shell', () => {
  it('the layout has the shared app bar and the phone tab bar, and keeps Create and the sidebar', () => {
    const page = createElement('p', null, 'PAGE');
    const out = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/boards'] },
      createElement(Routes, null,
        createElement(Route, { element: createElement(WorkspaceLayout, { projects: [] }) },
          createElement(Route, { path: '/boards', element: page })))));
    assert.match(out, /data-testid="app-bar"/);
    assert.match(out, /data-testid="bottom-tab-bar"/);
    assert.match(out, /title="Create an issue \(c\)"/);
    assert.match(out, /aria-label="Sidebar"/);
    assert.match(out, /Switch project/);
  });

  it('the search names its Issues and Projects groups once each, above their rows', async () => {
    const App = () => createElement(MemoryRouter, { initialEntries: ['/boards'] },
      createElement(TopBar, { projects: [], search: () => [issue, project] }));
    const view = mount(App, {});
    try {
      const box = byAttr(view.container, 'aria-label', 'Search issues and projects')[0];
      view.act(() => reactProps(box).onChange({ target: { value: 'web' } }));
      for (let i = 0; i < 10; i += 1) { await wait(0); view.act(() => {}); }
      const list = byAttr(view.container, 'role', 'listbox')[0];
      assert.ok(list, 'results are listed');
      const text = [...elements(list)].filter((el) => el.tagName === 'LI').map((el) => el.textContent);
      assert.equal(text.filter((t) => t === 'Issues').length, 1);
      assert.equal(text.filter((t) => t === 'Projects').length, 1);
      assert.equal(byAttr(list, 'role', 'option').length, 2, 'the headings are not options');
    } finally { await view.unmount(); }
  });
});
