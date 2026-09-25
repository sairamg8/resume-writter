// R2-146: Word's font fallback. Word does not embed fonts, and neither does the export: a reader
// without Inter or Literata got whatever default their Word reached for. The .docx's font table now
// gives every font it names — Font Family's, Name Font's, Heading Font's — the installed font to show
// in its place: Arial for a sans, Georgia for a serif (w:altName, with that font's PANOSE and family,
// which Word matches a missing font against); Georgia itself needs none. A custom font takes its kind
// from Fontsource (sans-serif when that cannot be asked). The résumé and the cover letter alike, and
// Typography says so, from the same list.
import { before, after, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume, unzipEntry } from './harness.mjs';
import { mount, elements } from './fake-dom.mjs';

const realFetch = globalThis.fetch;
/** The CDN: "Testface Serif" is a serif; every other font is offline. */
function network() {
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (!u.includes('cdn.jsdelivr.net')) return realFetch(url, opts);
    if (u.includes('/testface-serif@') && u.endsWith('/metadata.json')) {
      return new Response(JSON.stringify({ family: 'Testface Serif', category: 'serif', weights: [400], styles: ['normal'], subsets: ['latin'] }), { status: 200 });
    }
    throw new TypeError('fetch failed');
  };
}

before(async () => { await setup(); network(); });
afterEach(() => network());
after(async () => { globalThis.fetch = realFetch; await teardown(); });

/** The font table's entries: { name → { altName, panose, family } }. */
function fontTable(xml) {
  const out = {};
  for (const [, name, body] of (xml || '').matchAll(/<w:font w:name="([^"]*)">([\s\S]*?)<\/w:font>/g)) {
    const val = (tag) => (body.match(new RegExp(`<w:${tag} w:val="([^"]*)"/>`)) || [])[1] ?? null;
    out[name] = { altName: val('altName'), panose: val('panose1'), family: val('family') };
  }
  return out;
}
const tableOf = async (blob) => fontTable(unzipEntry(Buffer.from(await blob.arrayBuffer()), 'word/fontTable.xml'));
const resumeTable = async (settings) => {
  const { renderResumeDocx } = await loadModule('/src/utils/wordExport.js');
  return tableOf(await renderResumeDocx(resume({ settings })));
};
const ARIAL = { altName: 'Arial', panose: '020B0604020202020204', family: 'swiss' };
const GEORGIA = { altName: 'Georgia', panose: '02040502050405020303', family: 'roman' };

describe('the Word file names an installed stand-in for each font it uses (R2-146)', () => {
  it('Noto Sans, the default, shows as Arial where it is missing', async () => {
    assert.deepEqual(await resumeTable({}), { 'Noto Sans': ARIAL });
  });

  it('a serif shows as Georgia, a sans as Arial; Georgia is Georgia', async () => {
    assert.deepEqual(await resumeTable({ font: 'literata' }), { Literata: GEORGIA });
    assert.deepEqual(await resumeTable({ font: 'inter' }), { Inter: ARIAL });
    assert.deepEqual(await resumeTable({ font: 'georgia' }), { Georgia: { ...GEORGIA, altName: null } });
  });

  it('Name Font and Heading Font are in the table too', async () => {
    assert.deepEqual(await resumeTable({ font: 'inter', nameFont: 'ptserif', headingFont: 'georgia' }),
      { Inter: ARIAL, 'PT Serif': GEORGIA, Georgia: { ...GEORGIA, altName: null } });
  });

  it('a custom font takes its kind from Fontsource, sans-serif when it cannot be asked', async () => {
    assert.deepEqual(await resumeTable({ customFont: 'Testface Serif' }), { 'Testface Serif': GEORGIA });
    assert.deepEqual(await resumeTable({ customFont: 'Offline Grotesk' }), { 'Offline Grotesk': ARIAL });
  });

  it('the cover letter\'s file carries the same table', async () => {
    const { renderCoverLetterDocx } = await loadModule('/src/utils/wordExport.js');
    assert.deepEqual(await tableOf(await renderCoverLetterDocx(resume({ settings: { font: 'sourceserif' } }))), { 'Source Serif 4': GEORGIA });
  });
});

describe('Typography says what Word shows (R2-146)', () => {
  const note = async (settings) => {
    const { TypographySection } = await loadModule('/src/components/DesignPanelTypography.jsx');
    const view = mount(TypographySection, { settings, template: 'classic', updateSetting: () => {}, onReset: () => {} });
    try {
      for (let i = 0; i < 40; i += 1) {
        const p = [...elements(view.container)].find((el) => el.hasAttribute('data-word-fonts'));
        if (p) return p.textContent;
        await new Promise((r) => { setTimeout(r, 25); });
        view.act(() => {});
      }
      return null;
    } finally {
      view.unmount();
    }
  };

  it('names each font Word may not have and its stand-in; none for Georgia', async () => {
    assert.equal(await note({ font: 'literata', nameFont: 'inter' }),
      'Word does not embed fonts: where they are not installed, Literata shows as Georgia, Inter shows as Arial. The PDF prints them as chosen.');
    assert.equal(await note({ font: 'georgia' }), null);
  });
});
