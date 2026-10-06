// The editor panel's two documents — Résumé and Cover Letter — show in one scroll box (EditorTabContent). A
// document switch puts it back at the top, so each opens at its own start (the Résumé at Collapse/Expand All).
// It kept the offset the last one was scrolled to, so the other opened scrolled past its top. Design and ATS are
// docks beside the editor with a scroll box of their own (EditorDock), so opening or closing one leaves this box
// where it is; only the document it shows changing resets it (a dock opened from the letter shows the Résumé).
// Rendered with react-dom/client over tests/pdf/fake-dom.mjs, whose scroll box keeps its scrollTop as a
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
 * The editor's mode bar over its scroll box, wired as Editor.jsx wires them (one open document, one open dock: a
 * dock is the Résumé's, so opening one from the letter shows the Résumé; the Cover Letter closes it), the open
 * document's panel a stand-in naming it. Returns the mount, the scroll box, what it shows, the open dock and
 * `click(testid)` (a bar button by its testid).
 */
async function tabArea() {
  const { EditorModeBar, EditorTabContent } = await modules();
  const open = { dock: null };
  function TabArea({ edit = 0 }) {
    const [view, setView] = useState({ doc: 'resume', dock: null });
    open.dock = view.dock;
    const onPickDoc = (doc) => setView((v) => (doc === 'coverletter' ? { doc, dock: null } : { doc, dock: v.dock }));
    const onToggleDock = (name) => setView((v) => (v.dock === name ? { doc: v.doc, dock: null } : { doc: 'resume', dock: name }));
    return createElement(Fragment, null,
      createElement(EditorModeBar, { doc: view.doc, dock: view.dock, onPickDoc, onToggleDock }),
      createElement(EditorTabContent, { activeTab: view.doc }, createElement('p', null, `${view.doc} document, edit ${edit}`)));
  }
  const view = mount(TabArea, {});
  const box = () => [...elements(view.container)].find((el) => el.className.includes('overflow-y-auto'));
  const button = (id) => [...elements(view.container)].find((el) => el.getAttribute('data-testid') === id);
  const click = (id) => view.act(() => reactProps(button(id)).onClick());
  const shown = () => box().textContent;
  return { view, box, click, shown, dock: () => open.dock };
}

describe('switching the document opens the new one at its top', () => {
  it('Résumé scrolled down, then the Cover Letter: it opens at its top, not at the Résumé\'s offset', async () => {
    const { view, box, click, shown } = await tabArea();
    try {
      box().scrollTop = 800;
      click('doc-switch-letter');
      assert.match(shown(), /^coverletter document/);
      assert.equal(box().scrollTop, 0, 'the Cover Letter opened scrolled past its top');
    } finally { await view.unmount(); }
  });

  it('every trip between the documents starts at the top, a dock opened from the letter included (it shows the Résumé)', async () => {
    const { view, box, click, shown, dock } = await tabArea();
    try {
      const trips = [
        ['doc-switch-letter', /^coverletter document/, null],
        ['design-button', /^resume document/, 'design'], // a dock is the Résumé's: from the letter it shows the Résumé
        ['doc-switch-letter', /^coverletter document/, null], // and the Cover Letter closes the dock
        ['ats-chip', /^resume document/, 'ats'],
        ['doc-switch-letter', /^coverletter document/, null],
        ['doc-switch-resume', /^resume document/, null],
      ];
      for (const [id, doc, open] of trips) {
        box().scrollTop = 640;
        click(id);
        assert.match(shown(), doc, id);
        assert.equal(dock(), open, id);
        assert.equal(box().scrollTop, 0, `${id} → ${shown()}`);
      }
    } finally { await view.unmount(); }
  });

  it('a dock opening, switching and closing over the Résumé leaves its scroll where it was', async () => {
    const { view, box, click, dock } = await tabArea();
    try {
      const before = box();
      before.scrollTop = 500;
      for (const [id, open] of [['design-button', 'design'], ['ats-chip', 'ats'], ['ats-chip', null], ['design-button', 'design'], ['design-button', null]]) {
        click(id);
        assert.equal(dock(), open, id);
        assert.equal(box(), before, `${id} replaced the scroll box`);
        assert.equal(box().scrollTop, 500, `${id} moved the Résumé's scroll (the dock has a scroll box of its own)`);
      }
    } finally { await view.unmount(); }
  });

  it('a re-render on the same document (an edit, the name, a sync) keeps the scroll and the same scroll box', async () => {
    const { view, box, click } = await tabArea();
    try {
      const before = box();
      before.scrollTop = 800;
      view.update({ edit: 1 });
      view.update({ edit: 2 });
      click('doc-switch-resume'); // clicking the document already open is no document change either
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
      // The router's address, as HashRouter reads it from the hash (useEditorTab, R2-076).
      renderToString(createElement(MemoryRouter, { initialEntries: [hash.slice(1)] }, createElement(Capture)));
    } finally {
      delete globalThis.window;
      delete globalThis.localStorage;
    }
    assert.ok(found, 'Editor renders its tabs inside EditorTabContent');
    return found.props;
  }

  it('the Résumé by default and under a dock (?dock=, or the old ?tab=design and ?tab=ats), the Cover Letter when the link names it', async () => {
    assert.equal((await scrollBoxProps('#/editor/x')).activeTab, 'resume');
    assert.equal((await scrollBoxProps('#/editor/x?dock=design')).activeTab, 'resume');
    assert.equal((await scrollBoxProps('#/editor/x?dock=ats')).activeTab, 'resume');
    assert.equal((await scrollBoxProps('#/editor/x?tab=design')).activeTab, 'resume');
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
