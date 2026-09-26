// Design → Name color and Job title color in the Word résumé (FIDB-51-VF1-NB1-NB1). Its .docx
// printed the name in a fixed #0f172a and the job title in the stored accent, whatever the résumé
// stored, where the PDF (= the preview) prints the picked colours, else the template's own: the
// Text colour for the name, the accent for the title — Minimal's #555555. The letter's Word file
// already took both (23-cover-letter-looks-word).
//
// Modern's banner and the Sidebar's column: Word draws their band since R2-137 (92-word-header-band),
// and prints the name and title on it in the colours the PDF draws there — the picked ones, else the
// band's own (the Header Text Color, the Sidebar's readable accent), Modern's title at 90 % — as the
// letter's letterhead does. Before, Word drew no band and printed them as a switch to Classic prints
// them (headerColorsOnSwitch).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderDocx, drawState, loadModule } from './harness.mjs';

before(setup);
after(teardown);

/** Templates whose header is the white page, in the PDF as in Word. */
const PAGE = ['classic', 'minimal', 'executive'];
/** Templates whose PDF prints the header on a band, as Word now does (R2-137). */
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

/**
 * The colours the PDF draws the name and the title in on the band, opaque: 'rrggbb'. Modern's title
 * prints at 90 %, which the PDF stores in 255ths — Word's blend of it can differ by one per channel.
 */
async function pdfInkOnBand(r) {
  const { solid } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
  const { letterheadLook } = await loadModule('/src/templates/pdf/shared/letterhead.js');
  const { resolveTemplateSettings } = await loadModule('/src/templates/pdf/shared/templateSettings.js');
  const ground = letterheadLook(r.template, resolveTemplateSettings(r.settings, r.template)).band.color;
  const bytes = await render(r);
  return Promise.all(['Pat', 'Staff'].map(async (word) => {
    const drawn = [...new Set((await drawState(bytes, word)).map((h) => solid(h.fill, h.alpha, ground).slice(1)))];
    assert.equal(drawn.length, 1, `"${word}" drawn in one colour: ${drawn}`);
    return drawn[0];
  }));
}
/** Two lists of 'rrggbb' within 2 per channel of each other. */
const close = (a, b) => a.length === b.length && a.every((x, i) => x && b[i] && [0, 2, 4].every((k) => Math.abs(parseInt(x.slice(k, k + 2), 16) - parseInt(b[i].slice(k, k + 2), 16)) <= 2));

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

  it('Modern and Sidebar: on the band, in the colours the PDF draws there — picked, else the band\'s own', async () => {
    for (const template of BANDED) {
      for (const settings of [
        {},
        { nameColor: '#7c3aed', jobTitleColor: '#0d9488' },
        { textColor: '#1e3a8a', accentColor: '#e11d48' },
        // The old Sidebar seed's white name and pale blue title, a light yellow picked for a dark band.
        { nameColor: '#ffffff', jobTitleColor: '#bfdbfe' },
        { nameColor: '#ffffff', jobTitleColor: '#fde68a', accentColor: '#1e3a8a' },
        // Header Text Color is the band's.
        { headerTextColor: '#fde68a' },
        { headerTextColor: '#1e293b', accentColor: '#0d9488', sidebarBg: '#f1f5f9' },
        { accentColor: '#fde68a', headerTextColor: '#1e293b', jobTitleColor: '#f97316' },
      ]) {
        const r = cv(template, settings);
        const [word, pdf] = [await wordInk(r), await pdfInkOnBand(r)];
        assert.ok(close(word, pdf), `${template} ${JSON.stringify(settings)}: Word ${word}, the PDF ${pdf}`);
      }
    }
    // A new résumé's Modern: white on its #374151 banner, the title at 90 % of it.
    const { solid } = await loadModule('/src/templates/pdf/shared/pdfColors.js');
    assert.deepEqual(await wordInk(cv('modern')), ['ffffff', solid('#ffffff', 0.9, '#374151').slice(1)]);
  });

  it('a colour Word cannot take prints as the template\'s own — on the page, or on the band (guard)', async () => {
    for (const [template, own] of [['classic', [INK, SLATE]], ['minimal', [INK, '555555']], ['executive', [INK, SLATE]]]) {
      for (const bad of ['notacolor', 'rgb(nope)', '#12']) {
        assert.deepEqual(await wordInk(cv(template, { nameColor: bad, jobTitleColor: bad })), own, `${template} ${bad}`);
      }
    }
    for (const template of BANDED) {
      const own = await wordInk(cv(template));
      for (const bad of ['notacolor', 'rgb(nope)', '#12']) {
        assert.deepEqual(await wordInk(cv(template, { nameColor: bad, jobTitleColor: bad })), own, `${template} ${bad}`);
      }
    }
  });

  it('saved data from older builds (no dataVersion, no Name, Title or Text colour) exports the colours its PDF prints', async () => {
    const { normalizeResume } = await loadModule('/src/utils/normalizeResume.js');
    const own = { classic: ['1a1a1a', '2563eb'], minimal: [INK, '555555'], executive: [INK, '2563eb'] };
    for (const template of [...PAGE, ...BANDED]) {
      const old = { ...cv(template, { nameColor: '#7c3aed', jobTitleColor: '#0d9488' }), updatedAt: 5 };
      delete old.dataVersion;
      const picked = normalizeResume(old);
      // As its PDF prints them — on the page, or on the band (v11, NB-1, sets back a pick its band
      // cannot show: this purple on Modern's slate banner, 1.8:1).
      const pdf = PAGE.includes(template) ? await pdfInk(picked) : await pdfInkOnBand(picked);
      assert.ok(close(await wordInk(picked), pdf), `${template}: picked`);
      if (template !== 'modern') assert.deepEqual(await wordInk(picked), ['7c3aed', '0d9488'], `${template}: picked, as stored`);
      const bare = { ...cv(template), updatedAt: 5 };
      delete bare.dataVersion;
      for (const key of ['nameColor', 'jobTitleColor', 'textColor', 'accentColor']) delete bare.settings[key];
      const r = normalizeResume(bare);
      if (PAGE.includes(template)) {
        assert.deepEqual(await wordInk(r), own[template], `${template}: the template's own`);
        assert.deepEqual(own[template], await pdfInk(r), `${template}: its PDF`);
      } else {
        assert.ok(close(await wordInk(r), await pdfInkOnBand(r)), `${template}: the template's own, on its band`);
      }
    }
  });
});
