// The editor panel's three tabs — Résumé, Design, Cover Letter — show in one scroll box
// (EditorTabContent). A tab change puts it back at the top, so each tab opens at its own start:
// Design at Template, the Résumé at Collapse/Expand All. It kept the offset the last tab was
// scrolled to, so Design (or the Résumé again) opened scrolled past its top. Rendered with
// react-dom/client over tests/pdf/fake-dom.mjs, whose scroll box keeps its scrollTop as a
// browser's does; cypress/e2e/23-editor-panels.cy.js walks the same trip in the real editor.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, Fragment, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { setup, teardown, loadModule, resume } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const modules = async () => ({
  ...(await loadModule('/src/components/EditorHeader.jsx')),
  ...(await loadModule('/src/components/EditorTabContent.jsx')),
});

/**
 * The editor's tab bar over its scroll box, wired as Editor.jsx wires them (one activeTab), each
 * tab's panel a stand-in naming the tab. Returns the mount, the scroll box, what it shows and
 * `click(name)` (a tab bar button by its text or title).
 */
async function tabArea() {
  const { EditorModeBar, EditorTabContent } = await modules();
  function TabArea({ edit = 0 }) {
    const [activeTab, setActiveTab] = useState('resume');
    return createElement(Fragment, null,
      createElement(EditorModeBar, { activeTab, setActiveTab }),
      createElement(EditorTabContent, { activeTab }, createElement('p', null, `${activeTab} tab, edit ${edit}`)));
  }
  const view = mount(TabArea, {});
  const box = () => [...elements(view.container)].find((el) => el.className.includes('overflow-y-auto'));
  const button = (name) => [...elements(view.container)].find((el) => el.tagName === 'BUTTON'
    && (el.getAttribute('title') === name || el.textContent.trim() === name));
  const click = (name) => view.act(() => reactProps(button(name)).onClick());
  const shown = () => box().textContent;
  return { view, box, click, shown };
}

describe('switching editor tabs opens the new tab at its top', () => {
  it('Résumé scrolled down, then Design: Design opens at its top (Template), not at the Résumé\'s offset', async () => {
    const { view, box, click, shown } = await tabArea();
    try {
      box().scrollTop = 800;
      click('Design & Customize');
      assert.match(shown(), /^design tab/);
      assert.equal(box().scrollTop, 0, 'Design opened scrolled past its top');
    } finally { await view.unmount(); }
  });

  it('every trip between the three tabs, the Design toggle back to the Résumé included, starts at the top', async () => {
    const { view, box, click, shown } = await tabArea();
    try {
      const trips = [
        ['Cover Letter', /^coverletter tab/],
        ['Design & Customize', /^design tab/],
        ['Design & Customize', /^resume tab/], // the Design button again closes Design
        ['Cover Letter', /^coverletter tab/],
        ['Resume', /^resume tab/],
      ];
      for (const [name, tab] of trips) {
        box().scrollTop = 640;
        click(name);
        assert.match(shown(), tab, name);
        assert.equal(box().scrollTop, 0, `${name} → ${shown()}`);
      }
    } finally { await view.unmount(); }
  });

  it('a re-render on the same tab (an edit, the name, a sync) keeps the scroll and the same scroll box', async () => {
    const { view, box, click } = await tabArea();
    try {
      const before = box();
      before.scrollTop = 800;
      view.update({ edit: 1 });
      view.update({ edit: 2 });
      click('Resume'); // clicking the tab already open is no tab change either
      assert.equal(box(), before, 'the scroll box was replaced, which drops the focus in a field');
      assert.equal(box().scrollTop, 800);
    } finally { await view.unmount(); }
  });
});

describe('the Editor gives its scroll box the tab on screen', () => {
  /** The props of the EditorTabContent that Editor.jsx renders, opened at `hash`. */
  async function scrollBoxProps(hash) {
    const { Editor } = await loadModule('/src/pages/Editor.jsx');
    const { EditorTabContent } = await modules();
    const r = resume();
    const store = { activeResume: r, appState: { activeId: r.id, resumes: [r] } };
    let found = null;
    function Capture() {
      const tree = Editor({ store, auth: {}, sync: {} });
      found = [...walkElements(tree)].find((el) => el.type === EditorTabContent);
      return null;
    }
    Object.assign(globalThis, { window: { location: { hash } }, localStorage: { getItem: () => null } });
    try {
      renderToString(createElement(MemoryRouter, null, createElement(Capture)));
    } finally {
      delete globalThis.window;
      delete globalThis.localStorage;
    }
    assert.ok(found, 'Editor renders its tabs inside EditorTabContent');
    return found.props;
  }

  it('the Résumé by default, the ?tab= one when the link names it', async () => {
    assert.equal((await scrollBoxProps('#/editor/x')).activeTab, 'resume');
    assert.equal((await scrollBoxProps('#/editor/x?tab=design')).activeTab, 'design');
    assert.equal((await scrollBoxProps('#/editor/x?tab=coverletter')).activeTab, 'coverletter');
  });
});

/** Every element of a React tree, outermost first — the elements as written, components uncalled. */
function* walkElements(node) {
  if (Array.isArray(node)) { for (const child of node) yield* walkElements(child); return; }
  if (!node || typeof node !== 'object' || !node.props) return;
  yield node;
  yield* walkElements(node.props.children);
}
