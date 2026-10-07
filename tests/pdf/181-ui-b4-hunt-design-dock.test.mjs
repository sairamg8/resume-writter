// UI rebuild B4 re-verification (render-cost R1, parity P-1): the Design dock drew DesignPanel from a DEFERRED résumé
// (`useDeferredValue` in EditorDock), which (a) only moved the panel's render out of a key's own commit, so every key
// typed in a section still rendered the whole panel once after it, against the rule that a keystroke renders no dock
// panel, and (b) left its buttons writing from the résumé they were last drawn with, the class of the ATS dock's
// stale-résumé bug: a second click before the deferred render took its Undo snapshot and its "already on this card"
// check from the look before the first. The dock now gives the panel only what it draws (id, template, settings, cover
// letter: one object that keeps its identity until one changes) and the panel reads the whole résumé at the click
// through `getLatest`, as the ATS panel does. Counted as tests/pdf/180-ui-b3-dock-typing counts (renders, never time).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
// The editor harness first: it installs the render probe before react-dom is loaded.
import { prepare, finish, openEditor, loadModule, resume, elements, reactProps } from './180-ui-b3-editor-mount.mjs';
import { mount } from './fake-dom.mjs';

before(prepare); // the harness, the patched fake DOM (the toast region's focus and selectors), a PDF worker that answers at once
after(finish);

const PAUSE = 700;

describe('a keystroke with the Design dock open (R1)', () => {
  it('a burst of keys renders DesignPanel 0 times, in the key\'s commit and after it', async () => {
    const t = await openEditor({ path: '?dock=design' });
    try {
      const w = await t.measure(async () => { t.typeInSummary(); t.typeInSummary(); t.typeInSummary(); }, PAUSE);
      assert.ok(w.commits.length >= 1 && w.commits[0].size >= 1, `the keys rendered their own part, so the count is live. ${w.report()}`);
      assert.equal(w.count('designPanel'), 0, `the panel rendered for text typed in a section. ${w.report()}`);
    } finally { await t.close(); }
  });

  it('the count is live: a setting written with the dock open still renders the panel once', async () => {
    const t = await openEditor({ path: '?dock=design' });
    try {
      const w = await t.measure(() => t.act(() => t.store().updateSetting('fontSize', 11)), 100);
      assert.ok(w.count('designPanel') >= 1, `the panel shows the new setting. ${w.report()}`);
    } finally { await t.close(); }
  });
});

describe('a keystroke with the template gallery closed (R2)', () => {
  it('the gallery, always mounted, renders 0 times for text typed in a section, and once for a setting', async () => {
    const t = await openEditor();
    try {
      const w = await t.measure(async () => { t.typeInSummary(); t.typeInSummary(); t.typeInSummary(); }, PAUSE);
      assert.ok(w.commits.length >= 1 && w.commits[0].size >= 1, `the keys rendered their own part. ${w.report()}`);
      assert.equal(w.count('gallery'), 0, `the gallery's body ran for text typed in a section. ${w.report()}`);
      const live = await t.measure(() => t.act(() => t.store().updateSetting('fontSize', 11)), 100);
      assert.ok(live.count('gallery') >= 1, `the count is live: a look change reaches the gallery. ${live.report()}`);
    } finally { await t.close(); }
  });

  it('a pick reads the latest résumé at the click: its Undo hands back the settings written since the gallery was drawn', async () => {
    const { TemplateGallery } = await loadModule('/src/components/TemplateGallery.jsx');
    const { ToastProvider } = await loadModule('/src/components/ui/Toast.jsx');
    const calls = [];
    const drawn = resume({ settings: { marginV: 9 } });
    const newer = { ...drawn, settings: { marginV: 31, fontSize: 12 } };
    const props = { open: true, onClose() {}, resume: drawn, getLatest: () => newer, designs: [], setTemplate() {}, updateSetting() {}, applyDesign() {}, restoreDesign: (snap) => calls.push(snap) };
    const view = mount(() => createElement(ToastProvider, null, createElement(TemplateGallery, props)), {});
    try {
      const card = [...elements(view.document.body)].find((el) => el.tagName === 'BUTTON' && /^gallery-/.test(el.getAttribute('data-testid') || '') && !/Selected/.test(el.textContent));
      assert.ok(card, 'a card that is not the one on');
      view.act(() => reactProps(card).onClick());
      const region = [...elements(view.document.body)].find((el) => el.getAttribute?.('role') === 'status');
      const undo = [...elements(region)].find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === 'Undo');
      assert.ok(undo, 'the notice offers Undo');
      view.act(() => reactProps(undo).onClick({ preventDefault() {}, stopPropagation() {} }));
      assert.equal(calls.length, 1);
      assert.equal(calls[0].settings, newer.settings, 'the settings the latest résumé had');
    } finally { await view.unmount(); }
  });
});

describe('the Design panel acts on the latest résumé (P-1)', () => {
  it('a preset\'s Undo hands back the look the latest résumé had, not the one the panel was last drawn with', async () => {
    const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
    const { ToastProvider } = await loadModule('/src/components/ui/Toast.jsx');
    const calls = [];
    const drawn = resume({ settings: { marginV: 9 } });
    const newer = { ...drawn, settings: { marginV: 31, fontSize: 12 } }; // written since the panel was drawn
    const props = { resume: drawn, getLatest: () => newer, resetSettings: () => {}, setTemplate: () => {}, updateSetting: () => {}, applyDesign: () => {}, restoreDesign: (snap) => calls.push(snap) };
    const view = mount(() => createElement(ToastProvider, null, createElement(DesignPanel, props)), {});
    const buttonIn = (root, match) => [...elements(root)].find((el) => el.tagName === 'BUTTON' && match(el.textContent.trim()));
    try {
      view.act(() => reactProps(buttonIn(view.container, (t) => t === 'Spacing')).onClick());
      view.act(() => reactProps(buttonIn(view.container, (t) => t.endsWith('Spacious'))).onClick());
      const region = [...elements(view.document.body)].find((el) => el.getAttribute?.('role') === 'status');
      assert.ok(region, 'the notice region');
      view.act(() => reactProps(buttonIn(region, (t) => t === 'Undo')).onClick({ preventDefault() {}, stopPropagation() {} }));
      assert.equal(calls.length, 1, 'Undo restored once');
      assert.equal(calls[0].settings, newer.settings, 'the settings the latest résumé had');
    } finally { await view.unmount(); }
  });
});
