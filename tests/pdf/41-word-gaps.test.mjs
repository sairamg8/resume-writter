// ATS-4: a closed-up line keeps its word gaps wide enough for `pdftotext -raw`. react-pdf fits a line
// a little too wide for its box by narrowing its word gaps — for left, centred and justified text alike —
// and a negative letterSpacing narrows them too (Minimal's name, its letterhead). Poppler's -raw mode
// drops the U+0020 glyphs and re-derives words from the gap alone, joining two words across a gap
// under ~0.2 em: "Leddesign-systemandperformanceworkforpro". The textkit patch
// (.yarn/patches/@react-pdf-textkit-*.patch, KEEP_SPACE_EM) floors every word gap of a laid-out line at
// 0.22 em — pdfFontLoader.js's MIN_SPACE_EM — and takes what it adds back from the letters, so line
// breaks, widths and pages do not move. These read the gaps from pdf.js's operator list, so they run
// without Poppler; 40-ats-parse runs the same résumés through -raw itself.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, renderCover, loadModule, TEMPLATES } from './harness.mjs';
import { wordGaps } from './extractors.mjs';

before(setup);
after(teardown);

/** Poppler -raw joins words across a gap under ~0.201 em (measured, Poppler 26.01); the floor is 0.22. */
const FLOOR = 0.21;

/** Word gaps under FLOOR, printed with the text around them; and how many gaps were read at all. */
async function narrow(bytes) {
  const gaps = await wordGaps(bytes);
  return { count: gaps.length, narrow: gaps.filter((g) => g.em < FLOOR).map((g) => `${g.em.toFixed(3)} em ${g.at}`) };
}

const demo = async (template) => (await loadModule('/tests/fixtures/sampleResumes.js')).DEMO_RESUMES.find((x) => x.template === template);
const inFont = (r, font) => ({ ...r, settings: { ...r.settings, font } });

describe('the gap reader measures what -raw measures', () => {
  it('a line with room reads each gap at the font\'s own space (Noto Sans 0.26 em)', async () => {
    const r = resume({ template: 'classic', personal: { name: 'Pat Lee', summary: '<p>Built the checkout flow.</p>' } });
    const gaps = (await wordGaps(await render(r))).filter((g) => g.at.includes('checkout'));
    assert.equal(gaps.length, 3, 'three gaps in "Built the checkout flow."');
    for (const g of gaps) assert.ok(Math.abs(g.em - 0.26) < 0.01, `${g.em} em ${g.at}`);
  });
});

describe('every word gap of the demo résumés clears -raw\'s word break', () => {
  for (const template of TEMPLATES) {
    for (const font of [undefined, 'lato', 'roboto']) {
      it(`${template}, ${font || 'its own font'}: no word gap under ${FLOOR} em`, async () => {
        const r = await demo(template);
        const { count, narrow: found } = await narrow(await render(font ? inFont(r, font) : r));
        assert.ok(count > 100, `read ${count} word gaps: the reader found the text`);
        assert.deepEqual(found, []);
      });
    }
  }
});

describe('the other ways a word gap narrows', () => {
  it('justified text: a justified summary\'s closed-up lines keep their gaps', async () => {
    const text = 'Led design-system and performance work for a product used by two million customers across Europe, '
      + 'cut the checkout bundle by a third, and built the component library, its documentation site and the '
      + 'release process that six product teams ship through every week without a dedicated platform team.';
    const r = resume({ template: 'classic', settings: { font: 'lato' }, personal: { name: 'Pat Lee', summary: `<p style="text-align: justify">${text}</p>` } });
    assert.deepEqual((await narrow(await render(r))).narrow, []);
  });

  it('negative tracking: the Minimal letterhead\'s name (letterSpacing −0.3) in Lato', async () => {
    const r = inFont(await demo('minimal'), 'lato');
    const gaps = await wordGaps(await renderCover(r));
    const name = gaps.filter((g) => g.at.includes('Jordan') && g.at.includes('Rivera'));
    assert.ok(name.length > 0, 'the letterhead name was read');
    assert.deepEqual(gaps.filter((g) => g.em < FLOOR).map((g) => `${g.em.toFixed(3)} em ${g.at}`), []);
  });
});
