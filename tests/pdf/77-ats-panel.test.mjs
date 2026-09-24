// The ATS Check tab's buttons, clicked, over the real store (R2-163, R2-166): what each one writes is
// what the app saves. tests/pdf/56 and 58 cover the layout and heading fixes; this file covers the rest
// of the tab, each against the row that found it broken:
//   - "Print entries one under another (Grids 1)", the side-by-side warning's fix (R2-021).
//
// The panel is mounted as Editor.jsx mounts it — the real useAppStore as its `store`, the résumé that
// store holds as its `resume` — through react-dom/client in tests/pdf/fake-dom.mjs, with an in-memory
// localStorage, as tests/pdf/56-ats-layout-fix-buttons.test.mjs does.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';

before(setup);
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

/**
 * The ATS Check tab over a saved `r`. Returns `labels()` (every button's text), `click(label)` (a
 * button by its text), `paste(jd)` (types a job description into the scanner), `chips(kind)`
 * (the scanner's 'missing' keyword buttons or 'matched' keyword chips, by text), `saved()` (the
 * résumé the store now holds), `view` and `unmount()`.
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
  const all = () => [...elements(view.container)];
  const buttons = () => all().filter((el) => el.tagName === 'BUTTON');
  return {
    view,
    labels: () => buttons().map(text),
    button: (label) => buttons().find((el) => text(el) === label),
    click(label) {
      // By its whole text, or by its start: a category header carries its score.
      const button = buttons().find((el) => text(el) === label) ?? buttons().find((el) => text(el).startsWith(label));
      assert.ok(button, `no button reads "${label}" — the panel offers: ${buttons().map(text).join(' | ')}`);
      view.act(() => reactProps(button).onClick());
    },
    paste(jd) {
      const box = all().find((el) => el.tagName === 'TEXTAREA');
      view.act(() => reactProps(box).onChange({ target: { value: jd } }));
    },
    chips(kind) {
      const els = kind === 'missing'
        ? buttons().filter((el) => el.getAttribute('title') === 'Click to add to Skills')
        : all().filter((el) => el.tagName === 'SPAN' && /bg-emerald-50 text-emerald-800/.test(el.getAttribute('class') || ''));
      return els.map(text);
    },
    saved: () => store.appState.resumes[0],
    async unmount() {
      await view.unmount();
      delete globalThis.localStorage;
    },
  };
}

const byId = (r, id) => r.sections.find((s) => s.id === id);

describe('ATS Check → entries printed side by side: its fix sets Grids 1 on those sections only (R2-021)', () => {
  const GRIDS_ONE = 'Print entries one under another (Grids 1)';
  const gridResume = () => resume({
    template: 'classic',
    sections: [
      { ...section('experience', [{ company: 'Acme', role: 'Engineer' }, { company: 'Initech', role: 'Engineer' }], { columns: 2, spacing: 'compact' }), id: 'exp' },
      { ...section('skills', [{ category: 'Tools', skills: 'Go' }, { category: 'Cloud', skills: 'AWS' }], { columns: 2 }), id: 'sk' },
    ],
  });

  it('offers the fix in the quick fixes and on the warning, and it writes Grids 1 on the experience alone', async () => {
    const tab = await atsTab(gridResume());
    try {
      assert.ok(tab.labels().includes(GRIDS_ONE), `the fix is offered — the panel offers: ${tab.labels().join(' | ')}`);
      tab.click('ATS Layout & Parser Safety');
      assert.equal(tab.labels().filter((l) => l === GRIDS_ONE).length, 2, 'in the quick fixes and on the warning');
      const before = tab.saved();
      tab.click(GRIDS_ONE);
      const after = tab.saved();
      assert.deepEqual(byId(after, 'exp').settings, { ...byId(before, 'exp').settings, columns: 1 }, 'Grids 1, every other option kept');
      assert.deepEqual(byId(after, 'sk'), byId(before, 'sk'), 'the skills grid is not the warning\'s');
      assert.equal(after.template, 'classic');
      assert.ok(!tab.labels().includes(GRIDS_ONE), 'the warning and its fix are gone');
    } finally { await tab.unmount(); }
  });
});
