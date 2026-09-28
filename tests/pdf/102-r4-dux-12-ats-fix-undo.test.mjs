// R4-DUX-12: ATS Check's one-click section fixes — "Standardize All Section Headings", "Put Job Title
// First (Role / Co.)" and "Print entries one under another (Grids 1)" — say what they changed and offer
// an Undo that puts it back. They used to write at once with no notice and no undo: the button just
// went, and a custom heading, a Co. / Role order or a Grids setting was lost for good.
//
// The panel is mounted as Editor.jsx mounts it — the real useAppStore as its `store`, inside the
// ToastProvider — so what a click and its Undo write is what the app saves.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';

// The kit's toast (its Dismiss button's tooltip) may query the page, as issue-view-page.mjs's does.
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

/**
 * The ATS Check tab over a saved `r`, inside a ToastProvider. `click(label)` presses a panel button by
 * its whole text, `toasts()` is the text of each notice up, `undo()` presses a notice's Undo, `saved()`
 * is the résumé the store now holds.
 */
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
  const toastEls = () => [...elements(view.document.body)].filter((el) => el.getAttribute?.('data-toast') === '');
  return {
    click(label) {
      const button = buttons(view.container).find((el) => text(el) === label);
      assert.ok(button, `no button reads "${label}" — the panel offers: ${buttons(view.container).map(text).join(' | ')}`);
      view.act(() => reactProps(button).onClick());
    },
    toasts: () => toastEls().map(text),
    undo() {
      const button = toastEls().flatMap((t) => buttons(t)).find((el) => text(el) === 'Undo');
      assert.ok(button, `no notice offers Undo — the notices read: ${toastEls().map(text).join(' | ')}`);
      view.act(() => reactProps(button).onClick());
    },
    saved: () => store.appState.resumes[0],
    async unmount() {
      await view.unmount();
      delete globalThis.localStorage;
    },
  };
}

const byId = (r, id) => r.sections.find((s) => s.id === id);

describe('ATS Check one-click section fixes: a notice naming the change, with Undo (R4-DUX-12)', () => {
  it('"Standardize All Section Headings" says which headings it renamed; Undo puts the custom one back', async () => {
    const r = resume({
      template: 'classic',
      sections: [
        { ...section('education', [{ institution: 'State University', degree: 'BSc' }], {}, { title: 'My College' }), id: 'edu' },
        { ...section('skills', [{ category: 'Languages', skills: 'JavaScript' }], {}, { title: 'Technical Skills' }), id: 'sk' },
      ],
    });
    const tab = await atsTab(r);
    try {
      tab.click('Standardize All Section Headings');
      assert.equal(byId(tab.saved(), 'edu').title, 'Education');
      const [notice] = tab.toasts();
      assert.ok(notice, 'a notice is shown');
      assert.match(notice, /Renamed 1 section heading\b/);
      assert.match(notice, /"My College" → "Education"/);
      tab.undo();
      assert.equal(byId(tab.saved(), 'edu').title, 'My College', 'Undo restores the custom heading');
      assert.equal(byId(tab.saved(), 'sk').title, 'Technical Skills', 'a heading the fix left alone stays');
    } finally { await tab.unmount(); }
  });

  it('"Put Job Title First" says so; Undo puts back the Co. / Role order', async () => {
    const r = resume({
      template: 'classic',
      sections: [
        { ...section('experience', [{ company: 'Acme', role: 'Engineer', startDate: '01/2020', endDate: '12/2022' }],
          { titleOrder: 'company' }, { title: 'Work Experience' }), id: 'exp' },
      ],
    });
    const tab = await atsTab(r);
    try {
      tab.click('Put Job Title First (Role / Co.)');
      assert.equal(byId(tab.saved(), 'exp').settings.titleOrder, 'role');
      const [notice] = tab.toasts();
      assert.ok(notice, 'a notice is shown');
      assert.match(notice, /Job title first \(Role \/ Co\.\) in 1 experience section\b/);
      assert.match(notice, /"Work Experience"/);
      tab.undo();
      assert.equal(byId(tab.saved(), 'exp').settings.titleOrder, 'company', 'Undo restores Co. / Role');
    } finally { await tab.unmount(); }
  });

  it('"Print entries one under another (Grids 1)" says so; Undo puts back Grids 2 and keeps the other options', async () => {
    const r = resume({
      template: 'classic',
      sections: [
        { ...section('experience', [{ company: 'Acme', role: 'Engineer' }, { company: 'Initech', role: 'Engineer' }],
          { columns: 2, spacing: 'compact' }, { title: 'Experience' }), id: 'exp' },
      ],
    });
    const tab = await atsTab(r);
    try {
      const settingsBefore = byId(tab.saved(), 'exp').settings;
      tab.click('Print entries one under another (Grids 1)');
      assert.equal(byId(tab.saved(), 'exp').settings.columns, 1);
      const [notice] = tab.toasts();
      assert.ok(notice, 'a notice is shown');
      assert.match(notice, /Grids 1 in 1 section\b/);
      tab.undo();
      assert.deepEqual(byId(tab.saved(), 'exp').settings, settingsBefore, 'Undo restores Grids 2, every other option as it was');
    } finally { await tab.unmount(); }
  });
});
