// The ATS Check tab's layout fix says what it does, and offers the cheap one first (TUI-3).
//
// It had one button, labelled "Switch to Single-Column ATS Layout" — the name of the Sidebar's own
// Layout toggle (Design → Template → Layout, `sidebarSingleColumn`) — whose handler called
// store.setTemplate('classic'). A Sidebar user clicking it to become ATS-safe lost the Sidebar
// template, and with it the heading style and title case setTemplate() overwrites
// (src/hooks/useResumeStore.js), with no undo anywhere in the app. The single-column Layout the
// label promised reaches the same ATS-safe page (atsRating rates it `certified`, TUI-5) and keeps
// all three — so the panel now offers that first and keeps the template switch beside it under its
// own name.
//
// The panel is mounted over the real store (react-dom/client through tests/pdf/fake-dom.mjs, with
// an in-memory localStorage), so what a click writes is what the app writes: a stand-in store would
// only prove the panel calls the method it was handed, which is exactly what the bug did correctly.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { setup, teardown, resume, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const KEY = 'cpwtcv_v1';
const PANEL = fileURLToPath(new URL('../../src/components/AtsCheckerPanel.jsx', import.meta.url));

/** The two buttons the layout warning must offer, in this order: the cheap fix, then the costly one. */
const KEEP_SIDEBAR = 'Keep Sidebar · switch to Single column';
const SWITCH_TEMPLATE = 'Switch to Classic';

/**
 * Heading style and title case no template brings on its own, so "untouched" is a real assertion:
 * Classic's are 'ruled' and 'upper', the Sidebar's 'plain' and 'upper' (src/constants/templates.js).
 */
const PICKED_HEADINGS = { headingStyle: 'box', sectionTitleCase: 'normal' };

/** A localStorage stand-in. */
class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

/**
 * The ATS Check tab over a saved `r`, wired as Editor.jsx wires it — the real useAppStore as its
 * `store`, the résumé that store holds as its `resume`. Returns `labels()` (every button's text, as
 * the user reads it), `click(label)` (a button by its whole text, or by its start — a category
 * header carries its score), `saved()` (the résumé the store now holds) and `unmount()`.
 */
async function atsTab(r) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { default: AtsCheckerPanel } = await loadModule('/src/components/AtsCheckerPanel.jsx');
  globalThis.localStorage = new MemoryStorage([[KEY, JSON.stringify({ resumes: [r], activeId: r.id })]]);
  let store = null;
  function AtsTab() {
    store = useAppStore();
    return createElement(AtsCheckerPanel, { resume: store.activeResume, store });
  }
  const view = mount(AtsTab, {});
  const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
  const buttons = () => [...elements(view.container)].filter((el) => el.tagName === 'BUTTON');
  return {
    labels: () => buttons().map(text),
    click(label) {
      const button = buttons().find((el) => text(el) === label) ?? buttons().find((el) => text(el).startsWith(label));
      assert.ok(button, `no button reads "${label}" — the panel offers: ${buttons().map(text).join(' | ')}`);
      view.act(() => reactProps(button).onClick());
    },
    saved: () => store.appState.resumes[0],
    async unmount() {
      await view.unmount();
      delete globalThis.localStorage;
    },
  };
}

/** A two-column Sidebar résumé with a heading style and title case it was given by hand. */
const sidebarResume = () => resume({ template: 'sidebar', settings: PICKED_HEADINGS });

/** The settings keys whose value differs between `before` and `after`, sorted. */
const changedKeys = (before, after) => [...new Set([...Object.keys(before), ...Object.keys(after)])]
  .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])).sort();

describe('ATS Check → a multi-column layout: the cheap fix first, the costly one named (TUI-3)', () => {
  it('offers the Sidebar\'s own Layout toggle and the template switch, each under the name of what it does', async () => {
    const tab = await atsTab(sidebarResume());
    try {
      const labels = tab.labels();
      assert.ok(labels.includes(KEEP_SIDEBAR), `the Layout toggle is not offered — the panel offers: ${labels.join(' | ')}`);
      assert.ok(labels.includes(SWITCH_TEMPLATE), `the template switch is not named — the panel offers: ${labels.join(' | ')}`);
      // The bug itself: the one button promised a single column and replaced the template instead.
      assert.deepEqual(
        labels.filter((l) => /single.column/i.test(l)), [KEEP_SIDEBAR],
        'only the button that switches the Layout may promise a single column',
      );
    } finally { await tab.unmount(); }
  });

  it('the Layout toggle writes sidebarSingleColumn and nothing else: the template, heading style and title case stay', async () => {
    const tab = await atsTab(sidebarResume());
    try {
      const before = tab.saved();
      tab.click(KEEP_SIDEBAR);
      const after = tab.saved();
      assert.equal(after.template, 'sidebar', 'the résumé keeps the template it chose');
      assert.equal(after.settings.headingStyle, PICKED_HEADINGS.headingStyle, 'its heading style is untouched');
      assert.equal(after.settings.sectionTitleCase, PICKED_HEADINGS.sectionTitleCase, 'its title case is untouched');
      assert.equal(after.settings.sidebarSingleColumn, true, 'the Layout is single column');
      assert.deepEqual(changedKeys(before.settings, after.settings), ['sidebarSingleColumn'], 'one key moved');
      // And it really is the fix: the app's single answer now rates the résumé ATS-safe (TUI-5).
      const { atsRating } = await loadModule('/src/constants/templates.js');
      assert.equal(atsRating(after.template, after.settings).safe, true);
      assert.equal(atsRating(before.template, before.settings).safe, false, 'it was not before');
    } finally { await tab.unmount(); }
  });

  it('the template switch is the costly one, and its label names the template it leaves behind', async () => {
    const tab = await atsTab(sidebarResume());
    try {
      tab.click(SWITCH_TEMPLATE);
      const after = tab.saved();
      const { templateStyleDefaults } = await loadModule('/src/constants/templates.js');
      assert.equal(after.template, 'classic', `"${SWITCH_TEMPLATE}" switches the template`);
      // What it costs, and why it is not offered first: setTemplate() overwrites both, with no undo.
      assert.deepEqual(
        { headingStyle: after.settings.headingStyle, sectionTitleCase: after.settings.sectionTitleCase },
        templateStyleDefaults('classic'),
        'the heading style and title case go with the template',
      );
    } finally { await tab.unmount(); }
  });

  it('the ATS Layout category offers the same two fixes on the warning itself', async () => {
    const tab = await atsTab(sidebarResume());
    try {
      tab.click('ATS Layout & Parser Safety'); // the category is collapsed until opened
      const labels = tab.labels();
      for (const label of [KEEP_SIDEBAR, SWITCH_TEMPLATE]) {
        assert.equal(labels.filter((l) => l === label).length, 2, `"${label}" shows in the quick fixes and on the warning`);
      }
    } finally { await tab.unmount(); }
  });

  it('the warning\'s own advice matches the buttons: the Layout first, the template switch as a replacement', async () => {
    const { analyzeAtsScore } = await loadModule('/src/utils/atsChecker.js');
    const r = sidebarResume();
    const item = analyzeAtsScore(r).categories.layout.items.find((i) => i.id === 'template');
    assert.equal(item.status, 'warn');
    assert.match(item.detail, /single-column Layout/i, 'the detail advises the Layout toggle');
    assert.match(item.detail, /replaces/i, 'and says the template switch replaces what it keeps');
  });

  /**
   * TUI-3 was a label that named one thing and a handler that did another. The names are the
   * templates' own, so the panel must not write any of them itself — `templateLabel()` is the one
   * place a template's name comes from (TUI-5), and a name typed into the panel is a name that can
   * drift from the id the handler beside it uses. Comments are stripped first: they may of course
   * say "Sidebar".
   */
  it('the panel writes no template name of its own — every one it shows comes from templateLabel()', async () => {
    const { TEMPLATE_IDS, templateLabel } = await loadModule('/src/constants/templates.js');
    const src = fs.readFileSync(PANEL, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
    for (const id of TEMPLATE_IDS) {
      const label = templateLabel(id);
      assert.equal(
        new RegExp(`\\b${label}\\b`).test(src), false,
        `AtsCheckerPanel.jsx writes "${label}" itself: use templateLabel(), so the label cannot drift from what the button does`,
      );
    }
  });
});
