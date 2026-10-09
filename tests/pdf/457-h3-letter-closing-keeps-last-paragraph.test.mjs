// H3-457: a cover letter's closing and signature are kept on one page (wrap={false}), but nothing kept
// them with the paragraph before them. A letter whose body filled page 1 exactly (11 paragraphs of three
// lines in 17 of 19 templates, 10 to 12 in the others) pushed the closing alone to page 2: "Sincerely,"
// and the name under it, and no word of the letter. The body's last block (a paragraph that cannot split,
// under four lines) now goes with the closing (PdfRichText's `tail`), so a page that opens with the
// closing opens with the paragraph it closes.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, renderCover, read, resume, TEMPLATES, bodyItems } from './harness.mjs';

before(setup);
after(teardown);

const para = (i) => `<p>Paragraph ${i}: I would welcome the chance to discuss how my background in platform engineering, mentoring and delivery could help your team reach its goals this year, and I have attached details of recent projects for your review.</p>`;

const letter = (template, n) => resume({
  template,
  personal: { name: 'Jordan Rivera', title: 'Engineer', email: 'a@b.co', phone: '+1 555 0100', location: 'Austin' },
  coverLetter: { body: Array.from({ length: n }, (_, i) => para(i)).join(''), recipientName: 'Sam Lee', company: 'Acme', subject: 'Application', closing: 'Sincerely', date: '2026-10-01' },
});

describe('H3-457 a letter\'s closing is never alone on a page', () => {
  it('no template opens its last page with the closing, at any length around the page break', async () => {
    const alone = [];
    let breaks = 0;
    for (const template of TEMPLATES) {
      for (let n = 9; n <= 13; n += 1) {
        const pages = await read(await renderCover(letter(template, n)));
        if (pages.length < 2) continue;
        breaks += 1;
        const items = bodyItems(pages[pages.length - 1], pages.length - 1);
        const top = items.slice().sort((a, b) => b.y - a.y)[0]?.str || '';
        if (/^Sincerely/.test(top)) alone.push(`${template}/n${n}`);
        const all = pages.map((p, i) => bodyItems(p, i).map((t) => t.str).join(' ')).join(' ');
        assert.equal((all.match(/Sincerely/g) || []).length, 1, `${template}/n${n}: the closing prints once`);
        assert.ok(all.includes(`Paragraph ${n - 1}:`), `${template}/n${n}: the last paragraph prints`);
      }
    }
    assert.ok(breaks > 40, `the sweep reached a page break in ${breaks} letters`);
    assert.deepEqual(alone, [], 'the closing opens the last page of');
  });

  it('a letter that fits one page is unchanged: the closing follows the last paragraph on it', async () => {
    const pages = await read(await renderCover(letter('classic', 3)));
    assert.equal(pages.length, 1);
    const text = bodyItems(pages[0], 0).map((t) => t.str).join(' ');
    assert.ok(text.indexOf('Paragraph 2:') < text.indexOf('Sincerely'), 'last paragraph before the closing');
  });
});
