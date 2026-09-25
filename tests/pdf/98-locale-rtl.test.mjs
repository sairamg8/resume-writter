// Right-to-left résumés (R2-148): Design → Language Arabic, Hebrew, Persian or Urdu turns the page
// right to left — every template's PDF (the preview) is the mirror image of its left-to-right page,
// and each line reads right to left — and every paragraph of the Word export is bidirectional, its
// grids and photo row running from the right. react-pdf had no page direction (its layout is patched:
// .yarn/patches/@react-pdf-layout-*), so an Arabic résumé printed left-aligned, its lines in
// left-to-right order. Left-to-right languages, and every résumé storing none, print as before.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, render, renderCover, renderDocx, read, allItems, overlaps, TEMPLATES } from './harness.mjs';
import { drawing } from './extractors.mjs';

before(setup);
after(teardown);

/** Latin content, so the same runs print in both directions; the summary mixes in an Arabic word. */
const make = (template, language) => resume({
  template,
  settings: language ? { language } : {},
  personal: { name: 'Pat Sample', email: 'pat@example.com', summary: '<p>Senior مهندس</p>' },
  sections: [
    section('experience', [{ company: 'Initech', role: 'Lead', startDate: 'Jan 2021', current: true, description: '<ul><li>Built the billing system</li></ul>' }]),
    section('languages', [{ language: 'Portuguese', proficiency: 'Native' }, { language: 'Spanish', proficiency: 'Fluent' }]),
  ],
});

const first = (pages, str) => allItems(pages).find((t) => t.str.trim() === str);
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;

describe('the PDF of a right-to-left résumé is its left-to-right page mirrored', () => {
  for (const template of TEMPLATES) {
    it(`${template}: the name mirrored, the bullet right of its item, the summary read right to left, nothing overlapping`, async () => {
      const [ltr, rtl] = [await read(await render(make(template))), await read(await render(make(template, 'ar')))];
      const [a, b] = [first(ltr, 'Pat Sample'), first(rtl, 'Pat Sample')];
      assert.ok(a && b, 'the name prints');
      const W = rtl[0].W;
      assert.ok(near(W - (b.x + b.w), a.x), `the name's right edge is ${(W - (b.x + b.w)).toFixed(1)} pt from the right, as it was ${a.x.toFixed(1)} pt from the left`);

      // pdf.js reads a left-to-right bullet and its text as one run ("• Built…"), a right-to-left one as two.
      const item = (pages) => [allItems(pages).find((t) => t.str.trim().startsWith('•')), allItems(pages).find((t) => t.str.includes('Built the billing'))];
      const [lb, lt] = item(ltr);
      const [rb, rt] = item(rtl);
      assert.ok(lb && lt && rb && rt, 'the bullet and its item print');
      assert.ok(lb.x <= lt.x, 'left to right: the bullet leads on the left');
      assert.equal(rb.str.trim(), '•', 'right to left: the bullet is a run of its own');
      assert.ok(rb.x > rt.x + rt.w - 0.5, `right to left: the bullet (${rb.x.toFixed(1)}) is right of its item (ends ${(rt.x + rt.w).toFixed(1)})`);

      const word = (pages) => [allItems(pages).find((t) => t.str.includes('Senior')), allItems(pages).find((t) => t.str.includes('مهندس'))];
      const [ls, la] = word(ltr);
      const [rs, ra] = word(rtl);
      assert.ok(ls && la && rs && ra, 'the summary\'s words print');
      assert.ok(ls.x < la.x, 'left to right: "Senior" then the Arabic word');
      assert.ok(rs.x > ra.x, 'right to left: "Senior" first, on the right');

      const count = (pages) => pages.reduce((n, p) => n + overlaps(p).length, 0);
      assert.ok(count(rtl) <= count(ltr), `overlapping runs: ${JSON.stringify(rtl.flatMap(overlaps))}`);
    });
  }

  it('Hebrew, Persian and Urdu turn the page too', async () => {
    const a = first(await read(await render(make('classic'))), 'Pat Sample');
    for (const language of ['he', 'fa', 'ur']) {
      const pages = await read(await render(make('classic', language)));
      const b = first(pages, 'Pat Sample');
      assert.ok(near(pages[0].W - (b.x + b.w), a.x), language);
    }
  });

  it('a left-to-right language keeps the page: the name where English prints it', async () => {
    const a = first(await read(await render(make('modern'))), 'Pat Sample');
    for (const language of ['fr', 'de', 'nl']) {
      const b = first(await read(await render(make('modern', language))), 'Pat Sample');
      assert.ok(near(a.x, b.x, 0.01), language);
    }
  });

  it('a résumé storing no language draws exactly what English draws', async () => {
    for (const template of TEMPLATES) assert.equal(await drawing(await render(make(template))), await drawing(await render(make(template, 'en'))), template);
  });

  it('the cover letter: its body on the right', async () => {
    const letter = (language) => { const r = make('classic', language); r.coverLetter = { ...r.coverLetter, body: '<p>Thank you for reading.</p>' }; return r; };
    const rtl = await read(await renderCover(letter('he')));
    const [a, b] = [first(await read(await renderCover(letter())), 'Thank you for reading.'), first(rtl, 'Thank you for reading.')];
    assert.ok(a && b, 'the body prints');
    const { W } = rtl[0];
    assert.ok(near(W - (b.x + b.w), a.x), `the body's right edge is ${(W - (b.x + b.w)).toFixed(1)} pt from the right; left to right it starts ${a.x.toFixed(1)} pt from the left`);
  });
});

describe('Word: a right-to-left résumé is bidirectional', () => {
  const pPrDefault = (stylesXml) => (/<w:pPrDefault>(.*?)<\/w:pPrDefault>/s.exec(stylesXml) || [])[1] || '';

  it('every paragraph reads right to left (the document default), and the grid runs from the right', async () => {
    const { stylesXml, xml, texts } = await renderDocx(make('classic', 'ar'));
    assert.ok(pPrDefault(stylesXml).includes('<w:bidi/>'), pPrDefault(stylesXml));
    assert.ok(xml.includes('<w:bidiVisual/>'), 'the Languages grid table runs right to left');
    assert.ok(texts.some((t) => t.includes('الخبرة المهنية')), texts.join('\n'));
  });

  it('a left-to-right résumé, or one storing no language, has neither', async () => {
    for (const language of [undefined, 'en', 'fr']) {
      const { stylesXml, xml } = await renderDocx(make('classic', language));
      assert.ok(!pPrDefault(stylesXml).includes('<w:bidi'), String(language));
      assert.ok(!xml.includes('bidiVisual'), String(language));
    }
  });
});
