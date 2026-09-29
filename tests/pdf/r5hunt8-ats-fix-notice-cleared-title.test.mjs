// R5-HUNT8-ATS-FIX-NOTICE-CLEARED-TITLE-TYPE-ID: a section whose title the user cleared (the PDF prints
// no heading) was named by its internal type id in ATS Check's fix notices — "Renamed 1 section heading:
// "experience" → "Professional Experience"" — and the headings warning listed it as '"" → "Professional
// Experience"'. Both now name it by its type's canonical title, marked as having no heading, as the
// checker's other items (datesOffTitles, section_grids) already did.
//
// The panel is mounted as Editor.jsx mounts it, as in 102-r4-dux-12-ats-fix-undo. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';

before(async () => { patchFakeDom(); await setup(); });
after(teardown);

const KEY = 'cpwtcv_v1';

/** A localStorage stand-in. */
class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();

async function atsTab(r) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { default: AtsCheckerPanel } = await loadModule('/src/components/AtsCheckerPanel.jsx');
  const { ToastProvider } = await loadModule('/src/components/ui/Toast.jsx');
  globalThis.localStorage = new MemoryStorage([[KEY, JSON.stringify({ resumes: [r], activeId: r.id })]]);
  let store = null;
  function AtsTab() {
    store = useAppStore();
    return createElement(ToastProvider, null, createElement(AtsCheckerPanel, { resume: store.activeResume, store }));
  }
  const view = mount(AtsTab, {});
  const buttons = (root) => [...elements(root)].filter((el) => el.tagName === 'BUTTON');
  return {
    click(label) {
      const button = buttons(view.container).find((el) => text(el) === label);
      assert.ok(button, `no button reads "${label}" — the panel offers: ${buttons(view.container).map(text).join(' | ')}`);
      view.act(() => reactProps(button).onClick());
    },
    toasts: () => [...elements(view.document.body)].filter((el) => el.getAttribute?.('data-toast') === '').map(text),
    saved: () => store.appState.resumes[0],
    async unmount() {
      await view.unmount();
      delete globalThis.localStorage;
    },
  };
}

const cleared = () => resume({
  template: 'classic',
  sections: [
    { ...section('experience', [{ role: 'Lamplighter', company: 'Harbor Lights', startDate: '01/2020', endDate: 'Present' }], {}, { title: '' }), id: 'exp' },
    { ...section('skills', [{ category: 'Languages', skills: 'JavaScript' }], {}, { title: 'Skills' }), id: 'sk' },
  ],
});

describe('ATS Check · a section whose title was cleared (R5-HUNT8)', () => {
  it('the headings warning names it by its canonical title, not an empty quote', async () => {
    const { analyzeAtsScore } = await loadModule('/src/utils/atsChecker.js');
    const item = analyzeAtsScore(cleared()).categories.headings.items.find((i) => i.id === 'std_headings');
    assert.equal(item.status, 'warn');
    assert.match(item.detail, /"Professional Experience" \(no heading\) → "Professional Experience"/);
    assert.doesNotMatch(item.detail, /"" →/);
  });

  it('the Standardize notice names it so, never by its type id', async () => {
    const tab = await atsTab(cleared());
    try {
      tab.click('Standardize All Section Headings');
      assert.equal(tab.saved().sections.find((s) => s.id === 'exp').title, 'Professional Experience');
      const [notice] = tab.toasts();
      assert.ok(notice, 'a notice is shown');
      assert.match(notice, /"Professional Experience" \(no heading\) → "Professional Experience"/);
      assert.doesNotMatch(notice, /"experience"/);
    } finally { await tab.unmount(); }
  });

  it('a titled section is quoted as it is (the guard)', async () => {
    const { atsHeadingLabel } = await loadModule('/src/utils/atsChecker.js');
    assert.equal(atsHeadingLabel({ type: 'education', title: ' My College ' }), '"My College"');
    assert.equal(atsHeadingLabel({ type: 'custom', title: '' }), '"Untitled"');
  });
});
