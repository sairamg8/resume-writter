// R2-147 (part 1) — Design → Lists → Bullet (settings.bulletStyle): Bullet •, Dash –, Circle ◦ or None in
// front of every bulleted list item — a description's, its legacy bullets[], the summary's and the cover
// letter's — in the PDF (= the preview) on every template and in the Word export, the item's text where
// Bullet puts it. Unset, a résumé prints the '•' and Word's own bullets it always has. Every résumé
// printed '•' whatever it wanted.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, experience, render, renderCover, read, allItems, loadModule, unzipEntry, TEMPLATES } from './harness.mjs';

before(setup);
after(teardown);

const ITEMS = ['Designed the event ledger', 'Mentored six engineers'];
const LIST = `<ul>${ITEMS.map((t) => `<li>${t}</li>`).join('')}</ul>`;
const GLYPH = { bullet: '•', dash: '–', circle: '◦', none: '' };

const cv = (template, bulletStyle, entry = { description: LIST }) => resume({
  template,
  settings: bulletStyle === undefined ? {} : { bulletStyle },
  sections: [experience([entry])],
});

/** What prints in front of `text` on its line, within a marker's reach ('' for nothing), and where `text` ends. */
function lead(pages, text) {
  const all = allItems(pages);
  const at = all.find((t) => t.str.includes(text));
  assert.ok(at, `"${text}" prints`);
  const own = at.str.slice(0, at.str.indexOf(text)).trim();
  const glyph = own || all.filter((t) => t !== at && t.page === at.page && Math.abs(t.y - at.y) < 1 && t.x < at.x && t.x > at.x - 20)
    .map((t) => t.str.trim()).join('');
  return { glyph, end: at.x + at.w, y: at.y };
}

async function docxParts(r) {
  const { renderResumeDocx } = await loadModule('/src/utils/wordExport.js');
  const buffer = Buffer.from(await (await renderResumeDocx(r)).arrayBuffer());
  return { xml: unzipEntry(buffer, 'word/document.xml') || '', numbering: unzipEntry(buffer, 'word/numbering.xml') || '' };
}

describe('Design → Lists → Bullet prints the chosen glyph in front of every bulleted item (R2-147)', () => {
  it('every template: each style\'s glyph in front of the description\'s items, the text where Bullet puts it; unset prints •', async () => {
    const wrong = [];
    for (const template of TEMPLATES) {
      const base = await read(await render(cv(template, undefined)));
      for (const text of ITEMS) if (lead(base, text).glyph !== '•') wrong.push(`${template} unset: "${lead(base, text).glyph}" before "${text}"`);
      for (const style of ['dash', 'circle', 'none', 'bullet']) {
        const pages = await read(await render(cv(template, style)));
        for (const text of ITEMS) {
          const [got, was] = [lead(pages, text), lead(base, text)];
          if (got.glyph !== GLYPH[style]) wrong.push(`${template} ${style}: "${got.glyph}" before "${text}"`);
          if (Math.abs(got.end - was.end) > 0.5 || Math.abs(got.y - was.y) > 0.5) wrong.push(`${template} ${style}: "${text}" moved`);
        }
      }
    }
    assert.deepEqual(wrong, []);
  });

  it('an entry\'s legacy bullets[] and the summary\'s list take the style too', async () => {
    const r = resume({
      settings: { bulletStyle: 'dash' },
      personal: { summary: '<ul><li>Builds calm payment systems</li></ul>' },
      sections: [experience([{ description: '', bullets: ['Shipped the billing rewrite'] }])],
    });
    const pages = await read(await render(r));
    assert.equal(lead(pages, 'Shipped the billing rewrite').glyph, '–');
    assert.equal(lead(pages, 'Builds calm payment systems').glyph, '–');
  });

  it('numbered lists keep their numbers under every style', async () => {
    const pages = await read(await render(cv('classic', 'none', { description: '<ol><li>Designed the event ledger</li></ol>' })));
    assert.equal(lead(pages, 'Designed the event ledger').glyph, '1.');
  });

  it('the cover letter\'s body lists take the style', async () => {
    const r = resume({ settings: { bulletStyle: 'dash' }, coverLetter: { body: '<p>Dear team,</p><ul><li>Led the ledger migration</li></ul>' } });
    assert.equal(lead(await read(await renderCover(r)), 'Led the ledger migration').glyph, '–');
  });

  it('Word: Dash, Circle and None number the items with their own glyph (none for None); unset keeps Word\'s own bullets', async () => {
    const plain = await docxParts(cv('classic', undefined));
    assert.doesNotMatch(plain.numbering, /w:lvlText w:val="[–◦]"/, 'unset: no Design → Lists numbering');
    for (const style of ['dash', 'circle']) {
      const { xml, numbering } = await docxParts(cv('classic', style));
      assert.match(numbering, new RegExp(`w:lvlText w:val="${GLYPH[style]}"`), style);
      const para = xml.split('</w:p>').find((p) => p.includes(ITEMS[0]));
      assert.match(para, /<w:numPr>/, `${style}: the item is a list item`);
    }
    const none = await docxParts(cv('classic', 'none'));
    assert.match(none.numbering, /<w:numFmt w:val="none"\/>/);
  });
});
