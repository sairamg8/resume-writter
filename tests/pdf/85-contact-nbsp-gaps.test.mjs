// R3-003: Contact style Bar or Bullet joins a contact value's words with no-break spaces, so a value
// never wraps (PdfContact.jsx keepTogether). widenNarrowSpace widened only the U+0020 glyph, and
// Lato's and Literata's own U+00A0 glyph is as narrow as their space (0.193 and 0.200 em): Poppler
// 26.01's `pdftotext -raw`, which re-derives words from the gap and joins them under ~0.201 em, read
// "+15550142" and "Austin,TX". Now the no-break space advances at least MIN_SPACE_EM (0.22 em) too, and
// the textkit patch floors it as a word gap on a closed-up line. The gaps are read from pdf.js's
// operator list (wordGaps counts no-break spaces), so this runs whatever Poppler is installed.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, render, loadModule, TEMPLATES } from './harness.mjs';
import { pdftotext, wordGaps } from './extractors.mjs';

before(setup);
after(teardown);

/** pdftotext -raw joins words across a gap under ~0.201 em (Poppler 26.01); the floor is 0.22. */
const FLOOR = 0.21;

const demo = async (template) => (await loadModule('/tests/fixtures/sampleResumes.js')).DEMO_RESUMES.find((x) => x.template === template);

/** The contact line's no-break-space gaps under FLOOR, and how many of them were read. */
async function contactGaps(bytes, words) {
  const gaps = (await wordGaps(bytes)).filter((g) => words.some((w) => g.at.includes(w)));
  return { count: gaps.length, narrow: gaps.filter((g) => g.em < FLOOR).map((g) => `${g.em.toFixed(3)} em ${g.at}`) };
}

describe('a Bar or Bullet contact value\'s words stay apart under -raw (R3-003)', () => {
  for (const font of ['lato', 'literata']) {
    for (const contactStyle of ['bar', 'bullet']) {
      it(`${font}, ${contactStyle}: every template's contact gaps clear ${FLOOR} em`, async () => {
        const found = [];
        for (const template of TEMPLATES) {
          const r = await demo(template);
          const bytes = await render({ ...r, settings: { ...r.settings, font, contactStyle } });
          const { count, narrow } = await contactGaps(bytes, ['555', 'Austin']);
          assert.ok(count >= 3, `${template}: read ${count} contact gaps`);
          found.push(...narrow.map((n) => `${template}: ${n}`));
          const raw = pdftotext(bytes).find(([n]) => n.includes('-raw'));
          if (raw && /\+15550142|Austin,TX/.test(raw[1])) found.push(`${template}: ${raw[0]} glues a contact`);
        }
        assert.deepEqual(found, []);
      });
    }
  }

  it('a closed-up contact line keeps its no-break spaces at the floor (the textkit patch)', async () => {
    // A contact line a little too wide for its box is closed up, and the textkit patch widens its
    // narrowed spaces by taking from the letters — the no-break spaces with them, to 0.215 em in Lato.
    const found = [];
    let read = 0;
    for (const contactStyle of ['bar', 'bullet']) {
      for (let n = 0; n < 32; n += 1) {
        const r = resume({
          settings: { font: 'lato', contactStyle },
          personal: { email: `pat.lee${'x'.repeat(n)}@example.com`, phone: '+1 555 0142', location: 'Austin, TX', website: 'patlee.example.com', linkedin: 'linkedin.com/in/pat-lee-sample' },
        });
        const gaps = (await wordGaps(await render(r))).filter((g) => g.nbsp);
        read += gaps.length;
        found.push(...gaps.filter((g) => g.em < 0.2195).map((g) => `${contactStyle} ${n}: ${g.em.toFixed(3)} em ${g.at}`));
      }
    }
    assert.ok(read > 100, `read ${read} no-break-space gaps`);
    assert.deepEqual(found, []);
  });
});
