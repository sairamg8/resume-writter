// R5-HUNT3-ATS-FIX-UNDO-WRITES-OTHER-RESUME: the Undo on ATS Check's section fixes (R4-DUX-12) called
// store.updateSection(id, …), which patches whichever résumé is open when Undo is clicked. Section ids
// repeat across résumés ('experience' in every blank one), and the Editor (with its notices) stays
// mounted from /resume/A to /resume/B, so an Undo clicked within the notice's 8 s wrote A's old
// heading, title order or Grids into B. It also wrote over a heading retyped while the notice was up.
// Now the notices leave when another résumé opens, their Undo writes only into the résumé the fix
// changed, and only while the section still holds what the fix wrote.
//
// The panel is mounted as Editor.jsx mounts it — the real useAppStore as its `store`, inside the
// ToastProvider — with two saved résumés whose Experience sections share the id 'experience'.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { setup, teardown, resume, section, loadModule } from './harness.mjs';
import { mount, elements, reactProps } from './fake-dom.mjs';
import { patchFakeDom } from '../unit/ui-dom-harness.mjs';

before(async () => { patchFakeDom(); await setup(); });
after(teardown);

const KEY = 'cpwtcv_v1';

class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const text = (el) => el.textContent.replace(/\s+/g, ' ').trim();
const settle = async () => { for (let i = 0; i < 5; i += 1) await new Promise((r) => { setImmediate(r); }); };

/** A résumé `id` whose one Experience section has the id every blank résumé gives it. */
const withExperience = (id, extra, settings = {}) => ({
  ...resume({
    template: 'classic',
    sections: [{
      ...section('experience', [{ company: 'Acme', role: 'Engineer', startDate: '01/2020', endDate: '12/2022' },
        { company: 'Initech', role: 'Engineer', startDate: '01/2018', endDate: '12/2019' }], settings, extra),
      id: 'experience',
    }],
  }),
  id,
});

async function atsTab(resumes) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  const { default: AtsCheckerPanel } = await loadModule('/src/components/AtsCheckerPanel.jsx');
  const { ToastProvider } = await loadModule('/src/components/ui/Toast.jsx');
  globalThis.localStorage = new MemoryStorage([[KEY, JSON.stringify({ resumes, activeId: resumes[0].id })]]);
  let store = null;
  function AtsTab() {
    store = useAppStore();
    return createElement(ToastProvider, null, createElement(AtsCheckerPanel, { resume: store.activeResume, store }));
  }
  const view = mount(AtsTab, {});
  const buttons = (root) => [...elements(root)].filter((el) => el.tagName === 'BUTTON');
  const toastEls = () => [...elements(view.document.body)].filter((el) => el.getAttribute?.('data-toast') === '');
  const undos = () => toastEls().flatMap((t) => buttons(t)).filter((el) => text(el) === 'Undo');
  return {
    click(label) {
      const button = buttons(view.container).find((el) => text(el) === label);
      assert.ok(button, `no button reads "${label}" — the panel offers: ${buttons(view.container).map(text).join(' | ')}`);
      view.act(() => reactProps(button).onClick());
    },
    undos,
    undoAll() { for (const undo of undos()) view.act(() => reactProps(undo).onClick()); },
    open(id) { view.act(() => store.setActiveId(id)); },
    edit(fn) { view.act(() => fn(store)); },
    experience: (id) => store.appState.resumes.find((r) => r.id === id).sections.find((s) => s.id === 'experience'),
    async unmount() {
      await view.unmount();
      delete globalThis.localStorage;
    },
  };
}

describe('ATS Check fixes\' Undo never writes into another résumé (R5-HUNT3)', () => {
  it('Standardize, then another résumé opens: Undo leaves its heading alone', async () => {
    const tab = await atsTab([withExperience('A', { title: 'My Jobs' }), withExperience('I', { title: 'Where I\'ve Worked' })]);
    try {
      tab.click('Standardize All Section Headings');
      const fixed = tab.experience('A').title;
      assert.notEqual(fixed, 'My Jobs', 'the fix renamed A\'s heading');
      assert.equal(tab.undos().length, 1, 'its notice offers Undo');
      tab.open('I');
      await settle();
      tab.undoAll();
      assert.equal(tab.experience('I').title, 'Where I\'ve Worked', 'I keeps its own heading');
      await new Promise((r) => { setTimeout(r, 300); }); // past the notice's exit
      await settle();
      assert.equal(tab.undos().length, 0, 'the notice left when I opened');
    } finally { await tab.unmount(); }
  });

  it('Put Job Title First and Grids 1: Undo after another résumé opens leaves its settings alone', async () => {
    const tab = await atsTab([
      withExperience('A', { title: 'Experience' }, { titleOrder: 'company', columns: 2 }),
      withExperience('I', { title: 'Experience' }, { titleOrder: 'role', columns: 1 }),
    ]);
    try {
      tab.click('Put Job Title First (Role / Co.)');
      tab.click('Print entries one under another (Grids 1)');
      assert.equal(tab.experience('A').settings.titleOrder, 'role');
      assert.equal(tab.experience('A').settings.columns, 1);
      const before = tab.experience('I');
      tab.open('I');
      await settle();
      tab.undoAll();
      assert.deepEqual(tab.experience('I'), before, 'I\'s section is untouched');
    } finally { await tab.unmount(); }
  });

  it('a heading retyped while the notice is up is kept by Undo', async () => {
    const tab = await atsTab([withExperience('A', { title: 'My Jobs' })]);
    try {
      tab.click('Standardize All Section Headings');
      tab.edit((store) => store.updateSection('experience', (s) => ({ ...s, title: 'Career' })));
      tab.undoAll();
      assert.equal(tab.experience('A').title, 'Career', 'Undo keeps the retyped heading');
    } finally { await tab.unmount(); }
  });
});
