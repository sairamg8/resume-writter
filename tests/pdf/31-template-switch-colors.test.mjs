// Design → a template keeps the résumé's Name & Title Colors only where they read on its header
// (NB-1, src/templates/pdf/shared/headerColors.js). Picking one used to carry a colour picked for
// the old header across: the Sidebar column's white name printed white on Classic's white page.
// The switch runs through the store itself (useAppStore's setTemplate, rendered once on the
// server: a state update during that render is rendered again at once), then the résumé it
// stores is printed — the PDF (= the preview), the cover letter, the letter's Word file.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { setup, teardown, resume, render, renderCover, drawState, loadModule, readDocx } from './harness.mjs';

before(setup);
after(teardown);

/** The old Sidebar seed's name and title (6e57b52 defaultData.js): white and a pale blue, for its dark column. */
const SIDEBAR_SEED = { nameColor: '#ffffff', jobTitleColor: '#bfdbfe' };
/** A white page's picks: an ink name and a blue title. */
const INK = { nameColor: '#1a1a1a', jobTitleColor: '#2563eb' };
const WHITE = '#ffffff';
/** The Sidebar column's default background, and Modern's banner: the accent, #374151 on a new résumé. */
const NAVY = '#1e293b';
const BANNER = '#374151';

/** A localStorage stand-in. */
class MemoryStorage {
  constructor(entries) { this.map = new Map(entries); }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

/** `r` after Design → template `to`, as the store's setTemplate stores it. */
async function switched(r, to) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  globalThis.localStorage = new MemoryStorage([['cpwtcv_v1', JSON.stringify({ resumes: [r], activeId: r.id })]]);
  let store = null;
  let picked = false;
  function Probe() {
    store = useAppStore();
    if (!picked) {
      picked = true;
      store.setTemplate(to);
    }
    return null;
  }
  try {
    renderToString(createElement(Probe));
  } finally {
    delete globalThis.localStorage;
  }
  return store.appState.resumes[0];
}

/** `r` after Design → Template → Layout → Single · ATS-safe, as the store's updateSetting stores it. */
async function toggledSingle(r, value = true) {
  const { useAppStore } = await loadModule('/src/hooks/useResumeStore.js');
  globalThis.localStorage = new MemoryStorage([['cpwtcv_v1', JSON.stringify({ resumes: [r], activeId: r.id })]]);
  let store = null;
  let flipped = false;
  function Probe() {
    store = useAppStore();
    if (!flipped) {
      flipped = true;
      store.updateSetting('sidebarSingleColumn', value);
    }
    return null;
  }
  try {
    renderToString(createElement(Probe));
  } finally {
    delete globalThis.localStorage;
  }
  return store.appState.resumes[0];
}

/** The colour of the Word run that prints `text` in `xml`, as "#rrggbb". */
const wordColour = (xml, text) => `#${(xml.split('</w:r>').find((run) => run.includes(`>${text}<`)) || '').match(/<w:color w:val="([0-9a-fA-F]{6})"/)?.[1]?.toLowerCase()}`;

/**
 * `r`'s name and job title read on `ground` (3:1, WCAG's floor for large text) wherever they print
 * on it: the résumé's header, the letter's letterhead (drawn first: the signature below sits on
 * the page), the letter's Word letterhead.
 */
async function assertReadable(r, ground, label) {
  const { contrast } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
  const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
  for (const [doc, bytes] of [['PDF', await render(r)], ['letter', await renderCover(r)]]) {
    for (const word of ['Person', 'Engineer']) {
      const [hit] = await drawState(bytes, word);
      assert.ok(hit, `${label} ${doc}: "${word}" prints`);
      assert.ok(contrast(hit.fill, ground) >= 3, `${label} ${doc}: "${word}" drawn ${hit.fill} on ${ground}`);
    }
  }
  const docx = readDocx(new Uint8Array(await (await renderCoverLetterDocx(r)).arrayBuffer()));
  const name = wordColour(docx.paragraphs[0].xml, 'Test Person');
  assert.ok(contrast(name, ground) >= 3, `${label} Word letter: the name in ${name} on ${ground}`);
}

describe('Design → a template: Name & Title Colors picked for the old header (NB-1)', () => {
  it('the Sidebar\'s white name and pale title, on Classic, Minimal or Executive: the template\'s own, readable on the white page', async () => {
    for (const to of ['classic', 'minimal', 'executive']) {
      const r = await switched(resume({ template: 'sidebar', settings: SIDEBAR_SEED }), to);
      assert.equal(r.template, to);
      await assertReadable(r, WHITE, `sidebar → ${to}`);
      assert.deepEqual([r.settings.nameColor, r.settings.jobTitleColor], ['', ''], `${to}: the template's own, as the Design panel's ↺ sets`);
    }
  });

  it('a white page\'s ink name and blue title, on the Sidebar column or Modern\'s banner: the template\'s own, readable there', async () => {
    for (const [to, ground] of [['sidebar', NAVY], ['modern', BANNER]]) {
      const r = await switched(resume({ template: 'classic', settings: INK }), to);
      assert.equal(r.template, to);
      await assertReadable(r, ground, `classic → ${to}`);
      assert.deepEqual([r.settings.nameColor, r.settings.jobTitleColor], ['', ''], `${to}: the template's own`);
    }
  });

  // Guards: only a colour the switch made unreadable goes; the fix is the two tests above.
  it('keeps a colour that reads on the new header, or reads no worse there, and still sets the headings the template brings', async () => {
    const keep = [
      // Classic, Minimal and Executive share the white page: an orange title (2.8:1) picked there stays.
      ['classic', 'minimal', { nameColor: '#1e3a8a', jobTitleColor: '#f97316' }],
      ['classic', 'executive', { nameColor: '#1e3a8a', jobTitleColor: '#f97316' }],
      ['executive', 'classic', { nameColor: '#cbd5e1', jobTitleColor: '#94a3b8' }],
      // White and pale blue read on Modern's banner (10.3:1, 7.3:1).
      ['sidebar', 'modern', SIDEBAR_SEED],
      // A light name picked for Modern's banner reads on the Sidebar column.
      ['modern', 'sidebar', { nameColor: '#fde68a', jobTitleColor: '#ffffff' }],
      // (White on a light accent went: Modern's own is a readable tint there since ONB-1, 34-modern-banner-text.)
    ];
    for (const [from, to, settings] of keep) {
      const r = await switched(resume({ template: from, settings }), to);
      const label = `${from} → ${to} ${JSON.stringify(settings)}`;
      assert.deepEqual([r.settings.nameColor, r.settings.jobTitleColor], [settings.nameColor, settings.jobTitleColor], label);
    }
    const { templateStyleDefaults } = await loadModule('/src/constants/templates.js');
    for (const to of ['classic', 'modern', 'minimal', 'executive', 'sidebar']) {
      const r = await switched(resume({ template: to === 'sidebar' ? 'classic' : 'sidebar', settings: { headingStyle: 'box', sectionTitleCase: 'lower' } }), to);
      assert.deepEqual({ headingStyle: r.settings.headingStyle, sectionTitleCase: r.settings.sectionTitleCase }, templateStyleDefaults(to), to);
    }
  });

  /**
   * Pins the ground the switch measures against to the one the header really prints on: every
   * template's own Name and Job title colours — chosen for its own header — read on it. A template
   * added with a banner headerGround() did not know about would fail here, its own white name
   * measured against the white page, instead of silently keeping the next switch's pick.
   */
  it('every template\'s own Name and Job title colours read on the ground headerGround measures', async () => {
    const { headerGround } = await loadModule('/src/templates/pdf/shared/headerColors.js');
    const { TEMPLATE_IDS } = await loadModule('/src/constants/templates.js');
    const { contrast } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    // Timeline (T6) prints its header on the white page, as Classic: headerGround reads no band there.
    // Banner (T7) prints it on its accent band, as Modern: headerGround reads the band's accent.
    // Academic (T8) and Compact (T9) print it on the white page, as Classic.
    assert.deepEqual([...TEMPLATE_IDS].sort(), ['academic', 'banner', 'classic', 'compact', 'executive', 'minimal', 'modern', 'sidebar', 'timeline'], 'a template added needs its ground');
    // The default header, a dark banner/column, and a mid banner beside a light column.
    for (const settings of [{}, { accentColor: '#0f172a', sidebarBg: '#0f172a' }, { accentColor: '#374151', sidebarBg: '#f1f5f9' }]) {
      for (const template of TEMPLATE_IDS) {
        const r = resume({ template, settings });
        const ground = headerGround(r.settings, template);
        const bytes = await render(r);
        for (const word of ['Person', 'Engineer']) {
          const [hit] = await drawState(bytes, word);
          assert.ok(contrast(hit.fill, ground) >= 3, `${template} ${JSON.stringify(settings)}: "${word}" drawn ${hit.fill} on ${ground}`);
        }
      }
    }
  });
});

/**
 * TUI-1 / TUI-2 — Sidebar → Layout → "Single · ATS-safe" prints Classic's page, on the white paper,
 * not the dark column. A Name or Job title colour picked for that column (white, a pale blue) was
 * carried straight onto the white page and printed at 1.0:1 — a résumé exported with no name on it.
 *
 * Two causes, one shape: headerGround() and letterheadLook() both resolved with templateId(), which
 * does not know about the single column, where every other caller uses headerTemplateId(). So the
 * colour rescue measured the pick against a dark band that is not drawn and kept it, and the letter
 * drew that band for real. They are one fix: correcting only the ground moves the fault to the cover
 * letter, where the now-dark name would land on the still-dark band — which is why assertReadable
 * checks the résumé, the letter and the letter's Word file together.
 */
describe('Sidebar → Single · ATS-safe: colours picked for the dark column (TUI-1, TUI-2)', () => {
  it('the white name and pale title go back to the template\'s own, readable on the white page', async () => {
    const r = await toggledSingle(resume({ template: 'sidebar', settings: SIDEBAR_SEED }));
    assert.equal(r.template, 'sidebar', 'still the Sidebar — only its Layout changed');
    assert.equal(r.settings.sidebarSingleColumn, true);
    await assertReadable(r, WHITE, 'sidebar → single column');
    assert.deepEqual(
      [r.settings.nameColor, r.settings.jobTitleColor], ['', ''],
      'the template\'s own, as the Design panel\'s ↺ sets them',
    );
  });

  it('the letterhead drops the Sidebar\'s band in single column, as the page drops the column', async () => {
    const { letterheadLook } = await loadModule('/src/templates/pdf/shared/letterhead.js');
    const { resolveTemplateSettings } = await loadModule('/src/templates/pdf/shared/templateSettings.js');
    const single = { ...SIDEBAR_SEED, sidebarSingleColumn: true };
    assert.equal(
      letterheadLook('sidebar', resolveTemplateSettings(single, 'sidebar')).band, null,
      'no band: the single column prints Classic\'s letterhead',
    );
    assert.equal(
      letterheadLook('sidebar', resolveTemplateSettings(SIDEBAR_SEED, 'sidebar')).band?.color, NAVY,
      'two columns keep the Sidebar\'s band',
    );
  });

  it('headerGround reads the white page in single column, the column in two (the rescue\'s input)', async () => {
    const { headerGround } = await loadModule('/src/templates/pdf/shared/headerColors.js');
    assert.equal(headerGround({ sidebarSingleColumn: true }, 'sidebar'), WHITE);
    assert.equal(headerGround({}, 'sidebar'), NAVY);
  });
});
