// Design → Template → Save my design (R2-138, B4). A user's own look — font, colours, headings, spacing,
// on its template — saved under a name, listed with the app's designs, picked like one on any résumé,
// deleted. It is kept in the résumé's settings (`myDesigns`, and `templatePreset` naming it, as for the
// app's designs), so it syncs and backs up with the résumé and a JSON Resume export carries it back in.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, experience, loadModule } from './harness.mjs';

before(setup);
after(teardown);

const noop = () => {};

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

const MINE = { accentColor: '#6d28d9', font: 'literata', headingStyle: 'leftbar', sectionTitleCase: 'normal', lineHeightValue: 1.45, sectionGap: 20, marginH: 20 };
const cv = (id, template = 'classic', settings = {}) => ({ ...resume({
  template, settings,
  personal: { name: 'Robin Sample', title: 'Product Designer' },
  sections: [experience([{ company: 'Acme Corp', role: 'Lead Designer', startDate: '2021-01', endDate: '', current: true, description: '<p>Led.</p>' }])],
}), id });

/** A: a résumé with a look of its own, saved as "Violet"; B: another, plain. */
async function saved() {
  const a = cv('resume_a', 'executive', MINE);
  const b = cv('resume_b', 'minimal');
  const { resumes, out: id } = await inStore([a, b], 'resume_a', (s) => s.saveDesign('Violet'));
  return { id, a: resumes[0], b: resumes[1] };
}

describe('Save my design (B4)', () => {
  it('saves the open résumé\'s look under its name, on its template, and the résumé is on it', async () => {
    const { presetOf } = await loadModule('/src/constants/templatePresets.js');
    const { id, a } = await saved();
    assert.match(id, /^design_/);
    const d = a.settings.myDesigns[id];
    assert.equal(d.label, 'Violet');
    assert.equal(d.engine, 'executive');
    for (const [k, v] of Object.entries(MINE)) assert.equal(d.settings[k], v, k);
    assert.equal(a.settings.templatePreset, id);
    assert.equal(presetOf(a.settings, a.template)?.label, 'Violet');
  });

  it('never saves the uploaded icons, the paper or the designs themselves into a look', async () => {
    const { designLook } = await loadModule('/src/constants/templatePresets.js');
    const look = designLook({ ...MINE, customContactIcons: { email: 'data:image/png;base64,AAAA' }, pageSize: 'LETTER', templatePreset: 'x', myDesigns: { x: {} }, bad: { nested: 1 } });
    assert.deepEqual(look, MINE);
  });

  it('is listed with the designs on every résumé, and picked on another it brings the whole look', async () => {
    const { savedDesigns } = await loadModule('/src/constants/templatePresets.js');
    const { id, a, b } = await saved();
    const designs = savedDesigns([a, b]);
    assert.deepEqual(designs.map((d) => [d.id, d.label, d.engine]), [[id, 'Violet', 'executive']]);
    const html = renderToString(createElement((await loadModule('/src/components/DesignPanel.jsx')).default,
      { resume: b, designs, updateSetting: noop, setTemplate: noop, resetSettings: noop, saveDesign: noop }));
    assert.match(html, new RegExp(`data-testid="design-${id}"`), 'its card, on the other résumé');
    const { resumes } = await inStore([a, b], 'resume_b', (s) => s.applyDesign(designs[0]));
    const picked = resumes[1];
    assert.equal(picked.template, 'executive');
    assert.equal(picked.settings.templatePreset, id);
    assert.equal(picked.settings.myDesigns[id].label, 'Violet', 'the design travels with the résumé now on it');
    for (const [k, v] of Object.entries(MINE)) assert.equal(picked.settings[k], v, k);
    const html2 = renderToString(createElement((await loadModule('/src/components/DesignPanel.jsx')).default,
      { resume: picked, designs, updateSetting: noop, setTemplate: noop, resetSettings: noop, saveDesign: noop }));
    const card = html2.split(`data-testid="design-${id}"`)[0].split('<button').at(-1) + html2.split(`data-testid="design-${id}"`)[1].split('>')[0];
    assert.match(card, /border-blue-500/, 'and its card is the one selected');
  });

  it('a Job Title size or Title Spacing left unset is part of the look: picked where they are set, it unsets them', async () => {
    const { savedDesigns } = await loadModule('/src/constants/templatePresets.js');
    const { a } = await saved();
    assert.equal(a.settings.fontSizeTitleDelta, null, 'the saved résumé leaves them unset');
    assert.equal(a.settings.sectionLetterSpacing, null);
    const set = cv('resume_b', 'minimal', { fontSizeTitleDelta: 4, sectionLetterSpacing: 12 });
    const { resumes: [, picked] } = await inStore([a, set], 'resume_b', (s) => s.applyDesign(savedDesigns([a])[0]));
    assert.equal(picked.settings.fontSizeTitleDelta, null);
    assert.equal(picked.settings.sectionLetterSpacing, null);
  });

  it('Reset returns to it; a plain template takes its look away; the design stays saved', async () => {
    const { id, a } = await saved();
    const { resumes: [reset] } = await inStore([{ ...a, settings: { ...a.settings, accentColor: '#000000', font: 'roboto' } }], 'resume_a', (s) => s.resetSettings());
    assert.equal(reset.settings.templatePreset, id);
    assert.equal(reset.settings.accentColor, MINE.accentColor);
    assert.equal(reset.settings.font, MINE.font);
    const { resumes: [plain] } = await inStore([a], 'resume_a', (s) => s.setTemplate('classic'));
    assert.equal(plain.settings.templatePreset, undefined);
    assert.notEqual(plain.settings.font, MINE.font, 'its font leaves with it');
    assert.equal(plain.settings.myDesigns[id].label, 'Violet', 'still saved');
  });

  it('deleted, it leaves every résumé that holds it; one on it keeps its look as its own settings', async () => {
    const { savedDesigns } = await loadModule('/src/constants/templatePresets.js');
    const { id, a, b } = await saved();
    const { resumes: [, onIt] } = await inStore([a, b], 'resume_b', (s) => s.applyDesign(savedDesigns([a])[0]));
    const { resumes } = await inStore([a, onIt], 'resume_a', (s) => s.deleteDesign(id));
    assert.deepEqual(savedDesigns(resumes), []);
    for (const r of resumes) {
      assert.equal(r.settings.templatePreset, undefined, r.id);
      assert.deepEqual(r.settings.myDesigns?.[id], { deleted: true }, `${r.id}: its deletion, kept for every device (R3-008)`);
      assert.equal(r.settings.font, MINE.font, `${r.id}: prints as it did`);
    }
  });

  it('deleted in one browser, a résumé from another that still holds it does not list it again (R3-008)', async () => {
    const { savedDesigns, presetOf } = await loadModule('/src/constants/templatePresets.js');
    const { id, a, b } = await saved();
    const { resumes: [, stale] } = await inStore([a, b], 'resume_b', (s) => s.applyDesign(savedDesigns([a])[0])); // the other browser's copy
    const { resumes: [gone] } = await inStore([a], 'resume_a', (s) => s.deleteDesign(id));
    assert.deepEqual(savedDesigns([gone, stale]), [], "before: [Violet] — the other browser's copy listed it again");
    assert.equal(presetOf(gone.settings, gone.template), null);
  });

  it('a JSON Resume export carries it, and its import comes back on it', async () => {
    const { cpwtResumeToJsonResume: toJsonResume } = await loadModule('/src/utils/jsonResumeExport.js');
    const { jsonResumeToCpwtResume: fromJsonResume } = await loadModule('/src/utils/jsonResumeImport.js');
    const { presetOf } = await loadModule('/src/constants/templatePresets.js');
    const { id, a } = await saved();
    const file = JSON.parse(JSON.stringify(toJsonResume(a)));
    assert.equal(file.meta.design, id);
    assert.equal(file.meta.designLook.label, 'Violet');
    const back = fromJsonResume(file, 'resume_c');
    assert.equal(back.template, 'executive');
    assert.equal(presetOf(back.settings, back.template)?.label, 'Violet');
    for (const [k, v] of Object.entries(MINE)) assert.equal(back.settings[k], v, k);
  });

  it('an export\'s design that is not one over its template, or not a design, brings nothing', async () => {
    const { jsonResumeToCpwtResume: fromJsonResume } = await loadModule('/src/utils/jsonResumeImport.js');
    const base = { basics: { name: 'Robin Sample' } };
    const other = fromJsonResume({ ...base, meta: { template: 'classic', design: 'design_x', designLook: { label: 'X', engine: 'modern', settings: { font: 'lato' } } } }, 'r1');
    assert.equal(other.settings.templatePreset, undefined);
    assert.notEqual(other.settings.font, 'lato');
    const junk = fromJsonResume({ ...base, meta: { template: 'classic', design: 'design_x', designLook: 'lato' } }, 'r2');
    assert.equal(junk.settings.templatePreset, undefined);
  });
});
