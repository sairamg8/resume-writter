// R4-DUX-30: Design → Template → Save my design took a name another saved design already had and added
// a second design, so the picker showed two "Clean" cards nobody could tell apart. Now a name already
// used (any case, spaces trimmed) shows "You already have a design named Clean — saving replaces it.",
// and Save overwrites that design under its id — on every résumé that holds it, so no copy of the old
// look is left listed (or synced back). Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, experience, loadModule } from './harness.mjs';
import { elements, mount, reactProps } from './fake-dom.mjs';

before(setup);
after(teardown);

class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

/** Every résumé after `act(store)` in the editor's own store, `activeId` open. */
async function inStore(resumes, activeId, act) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  globalThis.localStorage = new MemoryStorage([['cpwtcv_v1', JSON.stringify({ resumes, activeId })]]);
  let store = null;
  let done = false;
  let out = null;
  function Probe() {
    store = useAppStore();
    if (!done) { done = true; out = act(store); }
    return null;
  }
  try { renderToString(createElement(Probe)); } finally { delete globalThis.localStorage; }
  return { resumes: store.appState.resumes, out };
}

const CLEAN = { accentColor: '#0f766e', font: 'literata', headingStyle: 'leftbar' };
const cv = (id, template = 'classic', settings = {}) => ({ ...resume({
  template, settings,
  personal: { name: 'Robin Sample', title: 'Product Designer' },
  sections: [experience([{ company: 'Acme Corp', role: 'Lead Designer', startDate: '2021-01', endDate: '', current: true, description: '<p>Led.</p>' }])],
}), id });

describe('Save my design under a name already used (R4-DUX-30)', () => {
  it('replaces that design, by its id, on every résumé that holds it', async () => {
    const { savedDesigns } = await loadModule('/src/constants/templatePresets.js');
    const { resumes: [a0, b0], out: id } = await inStore([cv('resume_a', 'executive', CLEAN), cv('resume_b', 'minimal')], 'resume_a', (s) => s.saveDesign('Clean'));
    const { resumes: [, onIt] } = await inStore([a0, b0], 'resume_b', (s) => s.applyDesign(savedDesigns([a0])[0]));
    const b1 = { ...onIt, updatedAt: 1 }; // saved long ago
    assert.equal(b1.settings.templatePreset, id, 'the other résumé is on it');

    const edited = { ...a0, settings: { ...a0.settings, accentColor: '#b91c1c' } };
    const { resumes, out } = await inStore([edited, b1], 'resume_a', (s) => s.saveDesign('clean', id));
    assert.equal(out, id, 'the same design, not a new one');
    const designs = savedDesigns(resumes);
    assert.deepEqual(designs.map((d) => [d.id, d.label]), [[id, 'clean']], 'one card, not two named Clean');
    assert.equal(designs[0].settings.accentColor, '#b91c1c', 'with the look saved now');
    for (const r of resumes) {
      assert.equal(r.settings.myDesigns[id].settings.accentColor, '#b91c1c', `${r.id}: no copy of the old look left to list or sync back`);
      assert.equal(r.settings.templatePreset, id, `${r.id}: still on it`);
    }
    assert.ok(resumes[1].updatedAt > b1.updatedAt, 'the other résumé goes a version on, so the sync carries it');
    assert.equal(savedDesigns([resumes[1], resumes[0]])[0].settings.accentColor, '#b91c1c', 'whichever résumé is read first');
  });

  it('the field says a name already used replaces that design, and Save passes its id', async () => {
    const { SavedDesigns } = await loadModule('/src/components/DesignPanelTemplate.jsx');
    const { pickerCards } = await loadModule('/src/utils/templatePicker.js');
    const design = { id: 'design_clean1', label: 'Clean', engine: 'executive', settings: CLEAN };
    const cards = pickerCards(cv('resume_a').settings, [design]).filter((c) => c.own);
    assert.equal(cards.length, 1);
    const calls = [];
    const props = { cards, isOn: () => false, onPick: () => {}, saveDesign: (...args) => { calls.push(args); } };
    const view = mount(SavedDesigns, props);
    const all = () => [...elements(view.container)];
    const button = (name) => all().find((el) => el.tagName === 'BUTTON' && el.textContent.trim() === name);
    const hint = () => all().find((el) => el.getAttribute('data-testid') === 'design-name-taken');
    try {
      view.act(() => reactProps(button('Save my design')).onClick({}));
      const input = all().find((el) => el.tagName === 'INPUT');
      view.act(() => reactProps(input).onChange({ target: { value: 'Fresh' } }));
      assert.equal(hint(), undefined, 'a new name: no hint');
      view.act(() => reactProps(input).onChange({ target: { value: '  clean ' } }));
      assert.ok(hint(), 'before: no hint, and a second "Clean" card');
      assert.equal(hint().textContent, 'You already have a design named Clean — saving replaces it.');
      view.act(() => reactProps(button('Save')).onClick({}));
      assert.deepEqual(calls, [['clean', 'design_clean1']]);
    } finally {
      await view.unmount();
    }
  });
});
