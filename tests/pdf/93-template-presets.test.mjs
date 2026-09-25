// Design → Template's designs (R2-138, "I need templates, at least 10 variations"): named looks, each a
// template the app draws (its engine) and a bundle of design settings. This pins the table (at least ten
// choices, every engine offered, every key a Design setting inside the panel's ranges, every design its own
// look), that each one's name and job title read on its header, that picking one goes through the store as
// a template switch does and the picker marks it, that a plain template clears it and Reset keeps it, that
// the badge is the ATS Check's verdict on it, and that JSON Resume, Backup and Word keep it. The ATS battery
// reads every design on every reader in 42-ats-fields.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, experience, section, loadModule, renderDocx, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const noop = () => {};

/** A localStorage stand-in. */
class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

/** `r` after `act(store)` — the editor's own store (useAppStore), as it stores the résumé. */
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
  try {
    renderToString(createElement(Probe));
  } finally {
    delete globalThis.localStorage;
  }
  return store.appState.resumes[0];
}

/** The Design panel's HTML for `r`. */
async function panel(r) {
  const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
  return renderToString(createElement(DesignPanel, { resume: r, updateSetting: noop, setTemplate: noop, resetSettings: noop }));
}

/** The card with data-testid `testid` in `html`: { selected, ats }. */
function cardIn(html, testid) {
  const body = html.split(`data-testid="${testid}"`)[1]?.split('</button>')[0];
  assert.ok(body, `the ${testid} card`);
  const cls = html.split(`data-testid="${testid}"`)[0].split('<button').at(-1) + body;
  return { selected: /border-blue-500/.test(cls), ats: />ATS<\/span>/.test(body) };
}

const cv = (template = 'classic', settings = {}) => resume({
  template, settings,
  personal: { name: 'Robin Sample', title: 'Product Designer', email: 'robin@example.com', phone: '+1 555 0142' },
  sections: [experience([{ company: 'Acme Corp', role: 'Lead Designer', startDate: '2021-01', endDate: '', current: true, description: '<p>Led the design system.</p>' }]),
    section('skills', [{ category: 'Tools', skills: 'Figma, CSS' }])],
});

describe('the designs table (R2-138)', () => {
  it('Design → Template offers at least ten choices, each design over a template the app draws', async () => {
    const { TEMPLATE_PICKER } = await loadModule('/src/constants/templates.js');
    const { PRESET_IDS, TEMPLATE_PRESETS } = await loadModule('/src/constants/templatePresets.js');
    assert.ok(TEMPLATE_PICKER.length + PRESET_IDS.length >= 10, `${TEMPLATE_PICKER.length} templates + ${PRESET_IDS.length} designs`);
    assert.ok(PRESET_IDS.length >= 5);
    const labels = [...TEMPLATE_PICKER.map((t) => t.label), ...PRESET_IDS.map((id) => TEMPLATE_PRESETS[id].label)];
    assert.equal(new Set(labels).size, labels.length, 'every name is its own');
    for (const id of PRESET_IDS) {
      const p = TEMPLATE_PRESETS[id];
      assert.ok(TEMPLATES.includes(p.engine), `${id}: engine ${p.engine}`);
      assert.ok(p.label && p.desc, `${id}: a name and a description`);
      assert.doesNotMatch(p.desc, /ATS/, `${id}: the badge makes the ATS claim, not the words`);
    }
  });

  it('every key is a Design setting, every value one the panel offers and the normaliser keeps', async () => {
    const { PRESET_IDS, TEMPLATE_PRESETS } = await loadModule('/src/constants/templatePresets.js');
    const { ATS_DEFAULTS } = await loadModule('/src/utils/defaultData.js');
    const { withDesignNumbers } = await loadModule('/src/constants/designNumbers.js');
    const { FONTS } = await loadModule('/src/utils/fonts.js');
    const HEADINGS = ['ruled', 'leftbar', 'line', 'underline', 'box', 'plain'];
    for (const id of PRESET_IDS) {
      const s = TEMPLATE_PRESETS[id].settings;
      for (const k of Object.keys(s)) assert.ok(k in ATS_DEFAULTS, `${id}: ${k} is not a Design setting`);
      const r = { settings: { ...s } };
      assert.equal(withDesignNumbers(r), r, `${id}: a number outside the panel's range`);
      if (s.font) assert.ok(FONTS.some((f) => f.id === s.font), `${id}: font ${s.font}`);
      if (s.headingStyle) assert.ok(HEADINGS.includes(s.headingStyle), `${id}: heading ${s.headingStyle}`);
      for (const k of ['accentColor', 'textColor']) if (s[k]) assert.match(s[k], /^#[0-9a-f]{6}$/, `${id}: ${k}`);
    }
  });

  it('each design is its own look: unlike its engine\'s, and unlike every other design\'s', async () => {
    const { PRESET_IDS, TEMPLATE_PRESETS } = await loadModule('/src/constants/templatePresets.js');
    const { defaultSettings } = await loadModule('/src/utils/defaultData.js');
    const look = (s) => [s.font, s.accentColor, s.headingStyle, s.sectionTitleCase, s.headerAlign].join('|');
    const seen = new Map();
    for (const id of PRESET_IDS) {
      const p = TEMPLATE_PRESETS[id];
      const engine = defaultSettings(p.engine);
      const s = { ...engine, ...p.settings };
      assert.notEqual(s.font, engine.font, `${id}: its own font, not ${p.engine}'s`);
      assert.notEqual(s.accentColor, engine.accentColor, `${id}: its own accent`);
      assert.ok(!seen.has(look(s)), `${id} looks like ${seen.get(look(s))}`);
      seen.set(look(s), id);
    }
    // No two designs share a font or an accent: each reads as its own at a glance.
    for (const k of ['font', 'accentColor']) {
      const values = PRESET_IDS.map((id) => TEMPLATE_PRESETS[id].settings[k]);
      assert.equal(new Set(values).size, values.length, `two designs share a ${k}`);
    }
  });

  it('each design\'s name and job title read on its header, its text on the page (TUI-1)', async () => {
    const { PRESET_IDS, TEMPLATE_PRESETS } = await loadModule('/src/constants/templatePresets.js');
    const { defaultSettings } = await loadModule('/src/utils/defaultData.js');
    const { HEADER_READS, headerGround } = await loadModule('/src/templates/pdf/shared/headerColors.js');
    const { resolveTemplateSettings } = await loadModule('/src/templates/pdf/shared/templateSettings.js');
    const { contrast } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    const faint = [];
    for (const id of PRESET_IDS) {
      const p = TEMPLATE_PRESETS[id];
      const s = { ...defaultSettings(p.engine), ...p.settings };
      const ground = headerGround(s, p.engine);
      const shown = resolveTemplateSettings(s, p.engine);
      for (const k of ['nameColor', 'jobTitleColor']) {
        if (!(contrast(shown[k], ground) >= HEADER_READS)) faint.push(`${id}: ${k} ${shown[k]} on ${ground}`);
      }
      if (!(contrast(shown.textColor, '#ffffff') >= 4.5)) faint.push(`${id}: text ${shown.textColor} on the page`);
      if (!(contrast(shown.accentColor, '#ffffff') >= 3)) faint.push(`${id}: accent ${shown.accentColor} on the page`);
    }
    assert.deepEqual(faint, []);
  });
});

describe('picking a design (R2-138)', () => {
  it('goes through the store: its engine, its look, its id — and the picker marks its card, not its engine\'s', async () => {
    const { PRESET_IDS, TEMPLATE_PRESETS } = await loadModule('/src/constants/templatePresets.js');
    for (const id of PRESET_IDS) {
      const p = TEMPLATE_PRESETS[id];
      const from = p.engine === 'classic' ? 'minimal' : 'classic';
      const r = await inStore(cv(from), (s) => s.setTemplate(p.engine, id));
      assert.equal(r.template, p.engine, id);
      assert.equal(r.settings.templatePreset, id, id);
      for (const [k, v] of Object.entries(p.settings)) assert.equal(r.settings[k], v, `${id}: ${k}`);
      const html = await panel(r);
      assert.equal(cardIn(html, `preset-${id}`).selected, true, `${id}: its card is selected`);
      assert.equal(cardIn(html, `template-${p.engine}`).selected, false, `${id}: its engine's card is not`);
    }
  });

  it('the design\'s own card clicked again changes nothing; its engine\'s card switches back to the plain template', async () => {
    const { default: DesignPanel } = await loadModule('/src/components/DesignPanel.jsx');
    const r = await inStore(cv('classic'), (s) => s.setTemplate('classic', 'ledger'));
    const calls = [];
    let tree = null;
    function Capture() {
      tree = DesignPanel({ resume: r, updateSetting: noop, setTemplate: (...a) => calls.push(a), resetSettings: noop });
      return null;
    }
    renderToString(createElement(Capture));
    const buttons = [];
    (function walk(n) {
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if (!n || typeof n !== 'object' || !n.props) return;
      if (n.type === 'button' && n.props['data-testid']) buttons.push(n);
      walk(n.props.children);
    })(tree);
    buttons.find((b) => b.props['data-testid'] === 'preset-ledger').props.onClick();
    assert.deepEqual(calls, [], 'the selected design: no switch');
    buttons.find((b) => b.props['data-testid'] === 'template-classic').props.onClick();
    assert.deepEqual(calls, [['classic']], 'its engine, plainly');
    const plain = await inStore(r, (s) => s.setTemplate('classic'));
    assert.equal(plain.settings.templatePreset, undefined, 'the design is cleared');
    assert.equal(plain.settings.font, 'notosans', 'its font leaves with it');
    assert.equal(plain.settings.accentColor, '#374151', 'and its accent');
    assert.equal(cardIn(await panel(plain), 'template-classic').selected, true);
  });

  it('another design brings its own look over the one before; Reset keeps the design', async () => {
    const r = await inStore(cv('classic'), (s) => s.setTemplate('classic', 'harbor'));
    const mine = { ...r, settings: { ...r.settings, accentColor: '#6d28d9' } };
    const next = await inStore(mine, (s) => s.setTemplate('minimal', 'nordic'));
    assert.equal(next.settings.accentColor, '#0e7490', 'the design picked brings its accent');
    const reset = await inStore({ ...next, settings: { ...next.settings, font: 'roboto', accentColor: '#000000' } }, (s) => s.resetSettings());
    assert.equal(reset.settings.templatePreset, 'nordic', 'Reset keeps the design');
    assert.equal(reset.settings.font, 'lato', 'and returns to its font');
    assert.equal(reset.settings.accentColor, '#0e7490', 'and its accent');
  });

  it('the badge is the ATS Check\'s verdict on each design as it would print', async () => {
    const { PRESET_IDS, TEMPLATE_PRESETS } = await loadModule('/src/constants/templatePresets.js');
    const { withTemplate } = await loadModule('/src/utils/templateSwitch.js');
    const { analyzeAtsScore } = await loadModule('/src/utils/atsChecker.js');
    const html = await panel(cv('classic'));
    const wrong = [];
    for (const id of PRESET_IDS) {
      const r = withTemplate(cv('classic'), TEMPLATE_PRESETS[id].engine, id);
      const pass = analyzeAtsScore(r).categories.layout.items.find((i) => i.id === 'template').status === 'pass';
      if (cardIn(html, `preset-${id}`).ats !== pass) wrong.push(`${id}: badge ${!pass}, ATS Check ${pass ? 'pass' : 'warn'}`);
    }
    assert.deepEqual(wrong, []);
  });
});

describe('a design is kept by every copy of the résumé (R2-138)', () => {
  it('JSON Resume: the export names it, and the import brings its look back', async () => {
    const { cpwtResumeToJsonResume: toJsonResume } = await loadModule('/src/utils/jsonResumeExport.js');
    const { jsonResumeToCpwtResume: fromJsonResume } = await loadModule('/src/utils/jsonResumeImport.js');
    const r = await inStore(cv('banner'), (s) => s.setTemplate('banner', 'sunrise'));
    const file = toJsonResume(r);
    assert.equal(file.meta.design, 'sunrise');
    const back = fromJsonResume(JSON.parse(JSON.stringify(file)));
    assert.equal(back.template, 'banner');
    assert.equal(back.settings.templatePreset, 'sunrise');
    assert.equal(back.settings.font, 'firasans');
    assert.equal(back.settings.accentColor, '#c2410c');
    const plain = toJsonResume(cv('banner'));
    assert.equal('design' in plain.meta, false, 'a résumé on no design names none');
  });

  it('Backup JSON: the stored résumé, normalised as the store imports it, keeps it', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const r = await inStore(cv('timeline'), (s) => s.setTemplate('timeline', 'grove'));
    const back = normalizeResume(JSON.parse(JSON.stringify(r)));
    assert.equal(back.settings.templatePreset, 'grove');
    assert.equal(back.settings.accentColor, '#15803d');
  });

  it('Word prints two designs in their own font and accent', async () => {
    for (const [engine, id, font, accent] of [['classic', 'harbor', 'IBM Plex Sans', '0f4c81'], ['executive', 'crimson', 'Georgia', '9f1239']]) {
      const r = await inStore(cv('classic'), (s) => s.setTemplate(engine, id));
      const doc = await renderDocx(r);
      assert.match(doc.stylesXml + doc.xml, new RegExp(`w:ascii="${font}"`), `${id}: ${font}`);
      assert.match(doc.xml, new RegExp(accent, 'i'), `${id}: its accent #${accent}`);
    }
  });
});
