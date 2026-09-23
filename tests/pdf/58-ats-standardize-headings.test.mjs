// The ATS Check tab's "Standardize Headings" buttons change the headings the report flagged, and
// nothing else (TUI-7).
//
// Both buttons — "Standardize All Section Headings" in the quick fixes and "Standardize Headings
// Now" on the std_headings warning — ran standardizeSectionsForAts (src/utils/atsChecker.js), which
// did two things the label never said:
//   (a) it set titleOrder: 'role' on every experience section, top level and settings, so every job's
//       bold line flipped from company-first to role-first and the Section Options choice was gone;
//   (b) it set every typed section's title to its canonical heading, whether or not the report had
//       flagged it — "Work Experience" and "Technical Skills", which the report passes, were
//       overwritten, and so were hidden sections, which the report never looks at.
// Nothing in the app undoes either. Title order has its own honest fix, "Put Job Title First", which
// shows only while the report warns about it.
//
// The panel is mounted over the real store, as tests/pdf/56-ats-layout-fix-buttons.test.mjs does,
// so what a click writes is what the app saves.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

const KEY = 'cpwtcv_v1';

/** The two buttons that standardize headings: the quick fix, and the one on the warning itself. */
const STANDARDIZE_ALL = 'Standardize All Section Headings';
const STANDARDIZE_NOW = 'Standardize Headings Now';
const TITLE_FIRST = 'Put Job Title First (Role / Co.)';

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
 * The ATS Check tab over a saved `r`, wired as Editor.jsx wires it: the real useAppStore as its
 * `store`, the résumé that store holds as its `resume`. `labels()` is every button's text,
 * `click(label)` presses one by its whole text, `saved()` is the résumé the store now holds.
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
      const button = buttons().find((el) => text(el) === label);
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

/**
 * One heading the report flags ("My College"), two it passes because they are on its alias list
 * ("Work Experience", "Technical Skills"), a hidden section it never inspects ("Side Quests"), and
 * a company-first experience section chosen in Section Options.
 */
function mixedResume() {
  return resume({
    template: 'classic',
    sections: [
      section('experience', [{ company: 'Acme', role: 'Engineer', startDate: '01/2020', endDate: '12/2022' }],
        { titleOrder: 'company' }, { title: 'Work Experience' }),
      section('education', [{ institution: 'State University', degree: 'BSc' }], {}, { title: 'My College' }),
      section('skills', [{ category: 'Languages', skills: 'JavaScript, SQL' }], {}, { title: 'Technical Skills' }),
      section('projects', [{ name: 'Side project' }], {}, { title: 'Side Quests', visible: false }),
    ],
  });
}

const byType = (r, type) => r.sections.find((s) => s.type === type);

describe('ATS Check → Standardize Headings: only the headings the report flagged (TUI-7)', () => {
  it('the report flags only "My College", so both buttons are offered for that one heading', async () => {
    const { analyzeAtsScore } = await loadModule('/src/utils/atsChecker.js');
    const item = analyzeAtsScore(mixedResume()).categories.headings.items.find((i) => i.id === 'std_headings');
    assert.equal(item.status, 'warn');
    assert.match(item.detail, /"My College" → "Education"/);
    assert.doesNotMatch(item.detail, /Work Experience|Technical Skills|Side Quests/, 'the report passes the others');
    const tab = await atsTab(mixedResume());
    try {
      const labels = tab.labels();
      for (const label of [STANDARDIZE_ALL, STANDARDIZE_NOW]) {
        assert.ok(labels.includes(label), `"${label}" is offered — the panel offers: ${labels.join(' | ')}`);
      }
    } finally { await tab.unmount(); }
  });

  for (const label of [STANDARDIZE_ALL, STANDARDIZE_NOW]) {
    describe(`"${label}"`, () => {
      it('renames the heading the report flagged', async () => {
        const tab = await atsTab(mixedResume());
        try {
          tab.click(label);
          assert.equal(byType(tab.saved(), 'education').title, 'Education');
        } finally { await tab.unmount(); }
      });

      it('leaves the headings the report passed as the user typed them', async () => {
        const tab = await atsTab(mixedResume());
        try {
          tab.click(label);
          const saved = tab.saved();
          assert.equal(byType(saved, 'experience').title, 'Work Experience', '"Work Experience" is on the alias list');
          assert.equal(byType(saved, 'skills').title, 'Technical Skills', '"Technical Skills" is on the alias list');
        } finally { await tab.unmount(); }
      });

      it('leaves a hidden section\'s heading alone — the report never looked at it', async () => {
        const tab = await atsTab(mixedResume());
        try {
          tab.click(label);
          const projects = byType(tab.saved(), 'projects');
          assert.equal(projects.title, 'Side Quests');
          assert.equal(projects.visible, false, 'and it stays hidden');
        } finally { await tab.unmount(); }
      });

      it('does not touch the experience entries\' title order: that is "Put Job Title First"', async () => {
        const tab = await atsTab(mixedResume());
        try {
          tab.click(label);
          const exp = byType(tab.saved(), 'experience');
          assert.equal(exp.settings.titleOrder, 'company', 'the Section Options choice stays company-first');
          assert.equal(exp.titleOrder, undefined, 'and no top-level titleOrder is written');
        } finally { await tab.unmount(); }
      });

      it('clears the warning it was offered for, and leaves the title-order warning to its own button', async () => {
        const { analyzeAtsScore } = await loadModule('/src/utils/atsChecker.js');
        const tab = await atsTab(mixedResume());
        try {
          tab.click(label);
          const report = analyzeAtsScore(tab.saved());
          assert.equal(report.categories.headings.items.find((i) => i.id === 'std_headings').status, 'pass');
          assert.equal(report.categories.experience.items.find((i) => i.id === 'exp_title_order').status, 'warn');
          const labels = tab.labels();
          assert.equal(labels.includes(STANDARDIZE_ALL) || labels.includes(STANDARDIZE_NOW), false,
            'nothing is left to standardize, so neither button shows');
          assert.ok(labels.includes(TITLE_FIRST), `"${TITLE_FIRST}" is still offered — the panel offers: ${labels.join(' | ')}`);
        } finally { await tab.unmount(); }
      });
    });
  }
});
