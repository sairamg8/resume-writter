// Design → Name color and Job title color in the Word résumé (FIDB-51-VF1-NB1-NB1). Its .docx
// printed the name in a fixed #0f172a and the job title in the stored accent, whatever the résumé
// stored, where the PDF (= the preview) prints the picked colours, else the template's own: the
// Text colour for the name, the accent for the title — Minimal's #555555. The letter's Word file
// already took both (23-cover-letter-looks-word).
//
// Word draws no band: Modern's banner and the Sidebar's column print their header on the white
// page, as their contact line already does (33-word-contact-marks). There a colour picked for the
// band that vanishes on the page, or the band's own (the Header Text Color, the Sidebar's readable
// accent), prints as a switch to Classic prints it (headerColorsOnSwitch, 31-template-switch-colors).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderDocx, drawState, loadModule } from './harness.mjs';

before(setup);
after(teardown);

/** Templates whose header is the white page, in the PDF as in Word. */
const PAGE = ['classic', 'minimal', 'executive'];
/** Templates whose PDF prints the header on a band Word does not draw. */
const BANDED = ['modern', 'sidebar'];
const NAME = 'Pat Sample';
const TITLE = 'Staff Engineer';
/** What a new résumé stores (createBlankResume): the name's and the title's page colours. */
const INK = '111111';
const SLATE = '374151';

const cv = (template, settings = {}) => resume({
  template,
  settings,
  personal: { name: NAME, title: TITLE, email: 'pat@example.com', phone: '+1 555 0100', hiddenFields: [] },
});

/** The Word colours of the name's and the title's runs, 'rrggbb'. */
async function wordInk(r) {
  const doc = await renderDocx(r);
  return [NAME, TITLE].map((text) => {
    const p = doc.paragraphs.find((q) => q.text.includes(text));
    assert.ok(p, `"${text}" in ${JSON.stringify(doc.texts)}`);
    const run = p.xml.split('</w:r>').find((x) => x.includes(`>${text}<`)) || '';
    return run.match(/<w:color w:val="([0-9a-fA-F]{6})"/)?.[1]?.toLowerCase();
  });
}

/** The colours the PDF draws the name and the title in, opaque on the white page: 'rrggbb'. */
async function pdfInk(r) {
  const { solid } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
  const bytes = await render(r);
  return Promise.all(['Pat', 'Staff'].map(async (word) => {
    const drawn = [...new Set((await drawState(bytes, word)).map((h) => solid(h.fill, h.alpha).slice(1)))];
    assert.equal(drawn.length, 1, `"${word}" drawn in one colour: ${drawn}`);
    return drawn[0];
  }));
}

describe('the Word résumé prints Design → Name and Job title colours (FIDB-51-VF1-NB1-NB1)', () => {
  it('Classic, Minimal and Executive: the name and title in the colours the PDF draws — picked, else the template\'s own', async () => {
    const cases = [
      {},
      { nameColor: '#7c3aed', jobTitleColor: '#0d9488' },
      { textColor: '#1e3a8a', accentColor: '#e11d48' },
      { textColor: '#7c2d12', jobTitleColor: '#0d9488' },
      // Short hex and a translucent pick: the PDF's blend on the page.
      { nameColor: '#70e', jobTitleColor: 'rgba(13, 148, 136, 0.6)' },
      // Faint on the page, and the PDF prints them so (= the preview): Word does not overrule it.
      { nameColor: '#f97316', jobTitleColor: '#fde68a' },
    ];
    for (const template of PAGE) {
      for (const settings of cases) {
        const r = cv(template, settings);
        assert.deepEqual(await wordInk(r), await pdfInk(r), `${template} ${JSON.stringify(settings)}`);
      }
    }
    // The bug report's scenario, as values.
    assert.deepEqual(await wordInk(cv('classic', { nameColor: '#7c3aed', jobTitleColor: '#0d9488' })), ['7c3aed', '0d9488']);
    assert.deepEqual(await wordInk(cv('classic')), [INK, SLATE], 'Classic: the Text colour and the accent');
    assert.deepEqual(await wordInk(cv('minimal')), [INK, '555555'], 'Minimal: its own grey title');
  });

  it('Modern and Sidebar: a picked colour that reads on the page prints as picked, as the same colours print on Classic', async () => {
    for (const template of BANDED) {
      for (const settings of [
        { nameColor: '#7c3aed', jobTitleColor: '#0d9488' },
        { nameColor: '#70e', jobTitleColor: '#1e3a8a', textColor: '#7c2d12' },
      ]) {
        const at = `${template} ${JSON.stringify(settings)}`;
        const word = await wordInk(cv(template, settings));
        assert.deepEqual(word, await pdfInk(cv('classic', settings)), at);
      }
    }
    // Faint on the page but fainter still on Modern's light banner: kept, as a switch keeps it.
    assert.deepEqual(await wordInk(cv('modern', { accentColor: '#fde68a', headerTextColor: '#1e293b', jobTitleColor: '#f97316' })), [INK, 'f97316']);
  });

  it('Modern and Sidebar: the band\'s colours, picked or its own, never print on the page — the Text colour and the accent do', async () => {
    const cases = [
      [{}, [INK, SLATE]],
      [{ textColor: '#1e3a8a', accentColor: '#e11d48' }, ['1e3a8a', 'e11d48']],
      // The old Sidebar seed's white name and pale blue title, a light yellow picked for a dark band.
      [{ nameColor: '#ffffff', jobTitleColor: '#bfdbfe' }, [INK, SLATE]],
      [{ nameColor: '#ffffff', jobTitleColor: '#fde68a', accentColor: '#1e3a8a' }, [INK, '1e3a8a']],
      // Header Text Color is the band's.
      [{ headerTextColor: '#fde68a' }, [INK, SLATE]],
      [{ headerTextColor: '#1e293b', accentColor: '#0d9488', sidebarBg: '#f1f5f9' }, [INK, '0d9488']],
    ];
    for (const template of BANDED) {
      for (const [settings, expected] of cases) {
        const r = cv(template, settings);
        const at = `${template} ${JSON.stringify(settings)}`;
        assert.deepEqual(await wordInk(r), expected, at);
        // As Classic prints the same Text colour and accent with no picks.
        assert.deepEqual(expected, await pdfInk(cv('classic', { ...settings, nameColor: '', jobTitleColor: '' })), `${at}: Classic's`);
      }
    }
  });

  it('a colour Word cannot take prints as the template\'s own on the page (guard)', async () => {
    for (const [template, own] of [['classic', [INK, SLATE]], ['minimal', [INK, '555555']], ['executive', [INK, SLATE]], ['modern', [INK, SLATE]], ['sidebar', [INK, SLATE]]]) {
      for (const bad of ['notacolor', 'rgb(nope)', '#12']) {
        assert.deepEqual(await wordInk(cv(template, { nameColor: bad, jobTitleColor: bad })), own, `${template} ${bad}`);
      }
    }
  });

  it('saved data from older builds (no dataVersion, no Name, Title or Text colour) exports the colours its PDF prints on the page', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const own = { classic: ['1a1a1a', '2563eb'], minimal: [INK, '555555'], executive: [INK, '2563eb'], modern: ['1f2937', '2563eb'], sidebar: ['1e2937', '2563eb'] };
    for (const template of [...PAGE, ...BANDED]) {
      const old = { ...cv(template, { nameColor: '#7c3aed', jobTitleColor: '#0d9488' }), updatedAt: 5 };
      delete old.dataVersion;
      const picked = normalizeResume(old);
      // As its PDF prints them on the page — for a band, as Classic prints the migrated settings: v11
      // (NB-1) sets back a pick its band cannot show (this purple on Modern's slate banner, 1.8:1).
      const onPage = PAGE.includes(template) ? picked : cv('classic', picked.settings);
      assert.deepEqual(await wordInk(picked), await pdfInk(onPage), `${template}: picked`);
      if (template !== 'modern') assert.deepEqual(await wordInk(picked), ['7c3aed', '0d9488'], `${template}: picked, as stored`);
      const bare = { ...cv(template), updatedAt: 5 };
      delete bare.dataVersion;
      for (const key of ['nameColor', 'jobTitleColor', 'textColor', 'accentColor']) delete bare.settings[key];
      const r = normalizeResume(bare);
      assert.deepEqual(await wordInk(r), own[template], `${template}: the template's own`);
      if (PAGE.includes(template)) assert.deepEqual(own[template], await pdfInk(r), `${template}: its PDF`);
    }
  });
});
