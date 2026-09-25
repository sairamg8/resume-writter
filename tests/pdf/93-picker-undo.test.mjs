// Design → Template: Undo a switch (R2-139, A4). A pick applies at once and changes more than the
// template — the heading style and title case, a design's whole look, Compact's type and spacing and a
// section's Grids — and nothing in the app could undo it. The switch's notice now carries Undo, which puts
// back the look the résumé had as a pair: its template with its settings and each section's settings,
// since unset colours and entry layouts print per template. Content typed since is kept.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, experience, section, loadModule } from './harness.mjs';

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

/** `r` after `act(store)` in the editor's own store (useAppStore). */
async function inStore(r, act) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  globalThis.localStorage = new MemoryStorage([['cpwtcv_v1', JSON.stringify({ resumes: [r], activeId: r.id })]]);
  let store = null;
  let done = false;
  function Probe() {
    store = useAppStore();
    if (!done) { done = true; act(store); }
    return null;
  }
  try { renderToString(createElement(Probe)); } finally { delete globalThis.localStorage; }
  return store.appState.resumes[0];
}

const cv = () => resume({
  template: 'classic',
  settings: { accentColor: '#9f1239', font: 'lato', headingStyle: 'box', sectionTitleCase: 'normal', lineHeightValue: 1.4 },
  personal: { name: 'Robin Sample', title: 'Product Designer' },
  sections: [experience([{ company: 'Acme Corp', role: 'Lead Designer', startDate: '2021-01', endDate: '', current: true, description: '<p>Led.</p>' }]),
    section('skills', [{ category: 'Tools', skills: 'Figma, CSS' }]), section('certifications', [{ name: 'CPD', issuer: 'X', date: '2020' }])],
});
const look = (r) => ({ template: r.template, settings: r.settings, sections: r.sections.map((s) => ({ id: s.id, settings: s.settings })) });

describe('Undo a template switch (A4)', () => {
  it('a switch to Compact changes the look, and Undo puts every part of it back', async () => {
    const { designSnapshot } = await loadModule('/src/utils/templateSwitch.js');
    const before = cv();
    const switched = await inStore(before, (s) => s.setTemplate('compact'));
    assert.notDeepEqual(look(switched), look(before), 'the switch changed the look');
    const undone = await inStore(switched, (s) => s.restoreDesign(designSnapshot(before)));
    assert.deepEqual(look(undone), look(before));
    assert.equal(undone.personal.name, 'Robin Sample', 'the content is untouched');
  });

  it('a design picked, then Undo: the plain template and the user\'s own look again', async () => {
    const { designSnapshot } = await loadModule('/src/utils/templateSwitch.js');
    const before = cv();
    const switched = await inStore(before, (s) => s.setTemplate('minimal', 'nordic'));
    assert.equal(switched.settings.templatePreset, 'nordic');
    const undone = await inStore(switched, (s) => s.restoreDesign(designSnapshot(before)));
    assert.deepEqual(look(undone), look(before));
  });

  it('content typed after the switch stays; a section added since keeps its own settings', async () => {
    const { designSnapshot } = await loadModule('/src/utils/templateSwitch.js');
    const before = cv();
    const switched = await inStore(before, (s) => s.setTemplate('compact'));
    const edited = {
      ...switched,
      personal: { ...switched.personal, name: 'Robin Q. Sample' },
      sections: [...switched.sections, section('languages', [{ language: 'French', proficiency: 'B2' }], { columns: 2 })],
    };
    const undone = await inStore(edited, (s) => s.restoreDesign(designSnapshot(before)));
    assert.equal(undone.personal.name, 'Robin Q. Sample');
    assert.equal(undone.template, 'classic');
    assert.deepEqual(undone.settings, before.settings);
    assert.deepEqual(undone.sections.at(-1).settings, { columns: 2 });
  });

  it('a section that had no settings of its own has none again — never an undefined Firestore refuses', async () => {
    const { designSnapshot, withDesignSnapshot } = await loadModule('/src/utils/templateSwitch.js');
    const bare = { ...cv(), sections: [{ id: 'sec_x', type: 'skills', title: 'Skills', items: [] }] };
    const snap = designSnapshot(bare);
    const later = withDesignSnapshot({ ...bare, sections: [{ ...bare.sections[0], settings: { columns: 2 } }] }, snap);
    assert.equal(Object.hasOwn(later.sections[0], 'settings'), false);
  });
});
