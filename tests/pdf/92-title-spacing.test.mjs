// R2-146: Design → Typography → Title Spacing, the section titles' letter-spacing in % of their size.
// Unset (a fresh résumé's null, or an older one's missing key) prints the 0.7 pt titles always had;
// set, the PDF's titles widen and narrow with it on the main column (and the Sidebar's About Me),
// capped at 6 % so ATS parsers still read words; Word's heading run carries the same spacing
// (w:spacing in its rPr, twips) — and none while unset, as before. The panel offers it with the
// value the PDF prints; the design numbers keep a stored one in range.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, loadModule, resume, experience, render, read, allItems, renderDocx } from './harness.mjs';

before(setup);
after(teardown);

const TITLE = /^PROFESSIONAL EXPERIENCE$/;
const job = () => experience([{ company: 'Northwind Labs', role: 'Staff Engineer' }]);
const titleOf = async (r) => allItems(await read(await render(r))).find((t) => TITLE.test(t.str.trim()));
const runSpacing = (docx) => {
  const p = docx.paragraphs.find((x) => TITLE.test(x.text.trim()));
  const m = p?.xml.match(/<w:rPr>(?:(?!<\/w:rPr>)[\s\S])*?<w:spacing w:val="(-?\d+)"\/>/);
  return m ? Number(m[1]) : null;
};

describe('the PDF prints Title Spacing (R2-146)', () => {
  it('unset prints the titles\' own 0.7 pt; each % widens or narrows the title by its letters', async () => {
    const plain = await titleOf(resume({ sections: [job()] }));
    const missing = resume({ sections: [job()] });
    delete missing.settings.sectionLetterSpacing;
    assert.ok(plain, 'the title prints');
    assert.equal((await titleOf(missing)).w.toFixed(3), plain.w.toFixed(3), 'an older résumé with no key prints as a fresh one');
    const size = 12; // base 11 + Section Title's 1
    const gaps = 'PROFESSIONAL EXPERIENCE'.length - 1;
    for (const pct of [-4, 0, 3, 6]) {
      const t = await titleOf(resume({ settings: { sectionLetterSpacing: pct }, sections: [job()] }));
      const want = plain.w + gaps * ((size * pct) / 100 - 0.7);
      assert.ok(Math.abs(t.w - want) < 1.5, `${pct} %: ${t.w.toFixed(2)} pt wide, ${want.toFixed(2)} expected`);
    }
  });

  it('capped at 6 % of the title\'s size, whatever is stored', async () => {
    const six = await titleOf(resume({ settings: { sectionLetterSpacing: 6 }, sections: [job()] }));
    const r = resume({ sections: [job()] });
    r.settings.sectionLetterSpacing = 20; // a hand-edited store: the PDF still caps it
    assert.equal((await titleOf(r)).w.toFixed(2), six.w.toFixed(2));
  });

  it('the Sidebar\'s About Me title follows it too', async () => {
    const about = async (settings) => allItems(await read(await render(resume({ template: 'sidebar', settings, personal: { summary: '<p>Builds tools.</p>' }, sections: [job()] }))))
      .find((t) => /^ABOUT ME$/.test(t.str.trim()));
    const [a, b] = [await about({}), await about({ sectionLetterSpacing: -4 })];
    assert.ok(a && b && b.w < a.w - 5, `About Me: ${a?.w} → ${b?.w}`);
  });
});

describe('Word prints Title Spacing on the heading run (R2-146)', () => {
  it('none while unset; set, the PDF\'s spacing in twips', async () => {
    assert.equal(runSpacing(await renderDocx(resume({ sections: [job()] }))), null, 'unset: as before');
    assert.equal(runSpacing(await renderDocx(resume({ settings: { sectionLetterSpacing: 6 }, sections: [job()] }))), Math.round(0.72 * 20));
    assert.equal(runSpacing(await renderDocx(resume({ settings: { sectionLetterSpacing: -4 }, sections: [job()] }))), Math.round(-0.48 * 20));
  });
});

describe('the panel and the stored number (R2-146)', () => {
  it('Title Spacing shows what prints: 6 % at the default 12 pt title, the stored value when set', async () => {
    const { titleTrackingPct } = await loadModule('/src/templates/pdf/shared/sectionHeadingLook.js');
    assert.equal(titleTrackingPct(12, null), 6);
    assert.equal(titleTrackingPct(16, undefined), 4);
    assert.equal(titleTrackingPct(12, -2), -2);
  });

  it('a stored value outside -4..6 is brought into range; a fresh résumé stores none', async () => {
    const { withDesignNumbers } = await loadModule('/src/constants/designNumbers.js');
    const { createBlankResume } = await loadModule('/src/utils/defaultData.js');
    assert.equal(withDesignNumbers({ settings: { sectionLetterSpacing: 40 } }).settings.sectionLetterSpacing, 6);
    assert.equal(withDesignNumbers({ settings: { sectionLetterSpacing: -40 } }).settings.sectionLetterSpacing, -4);
    assert.equal(createBlankResume({ id: 'r' }).settings.sectionLetterSpacing, null);
  });
});
