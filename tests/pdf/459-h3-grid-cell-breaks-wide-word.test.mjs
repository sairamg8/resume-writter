// H3-459: a word wider than a Grids cell ran out of it. Text never breaks inside a word (hyphenationPenalty at
// infinity) and the only break react-pdf would take, breakLongWords, applies from 48 characters, so a
// 29-letter German job title in a 3-column grid (161 pt in a cell of 150), a 35-character compound or a link in a
// 2-column one printed past its cell: over the next column's text, or past the page's right margin. The
// Sidebar's column and the contacts already broke such a word to fit (breakToFit); the cells of a grid, of the
// Timeline's rail and the text of any ColumnRoom now do, in the headers (PdfText) and the lists (PdfRichText).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, render, read, resume, section, experience, allItems, allText, overlaps, MM } from './harness.mjs';

before(setup);
after(teardown);

const WORDS = {
  german: 'Softwareentwicklungsingenieur',
  compound: 'Internationalization-Infrastructure',
  link: 'https://example.com/a/very/long/path/segment',
};
const MARGIN_MM = 15;

const letters = (s) => { const m = new Map(); for (const c of s) if (/\S/.test(c)) m.set(c, (m.get(c) || 0) + 1); return m; };

function build(word, cols) {
  return resume({
    template: 'classic',
    settings: { pageSize: 'A4', marginH: MARGIN_MM },
    personal: { name: 'Jordan Rivera', title: 'Engineer', email: 'a@b.co', phone: '+1 555 0100', location: 'Austin', summary: '<p>Short.</p>' },
    sections: [
      experience(Array.from({ length: 4 }, (_, i) => ({ company: `Co${i}`, role: word, location: 'X', startDate: '2020', endDate: '2021', description: `<ul><li>Did ${word} things with ${word}.</li></ul>` })), { columns: cols }),
      section('projects', Array.from({ length: 4 }, () => ({ name: word, technologies: word, description: `<p>${word} ${word}</p>` })), { columns: cols }),
    ],
  });
}

describe('H3-459 a word wider than its cell breaks inside it', () => {
  for (const [kind, word] of Object.entries(WORDS)) {
    for (const cols of [2, 3, 4]) {
      it(`${kind} in ${cols} columns stays inside the margins and its cell, and every letter prints`, async () => {
        const pages = await read(await render(build(word, cols)));
        const right = (p) => p.W - MARGIN_MM * MM + 1.5;
        const past = allItems(pages).filter((t) => t.x + t.w > right(pages[t.page - 1]));
        assert.deepEqual(past.map((t) => `${t.str.slice(0, 20)}@${Math.round(t.x)}+${Math.round(t.w)}`), [], 'text past the right margin');
        const over = pages.flatMap((p, i) => overlaps(p).map((o) => `p${i + 1}:${o[0].slice(0, 20)}|${o[1].slice(0, 20)}`));
        assert.deepEqual(over, [], 'text over text');
        // 4 entries x (role + 2 in the bullet) + 4 x (name + technologies + 2 in the paragraph)
        const want = letters(word.repeat(4 * 3 + 4 * 4));
        const got = letters(allText(pages));
        const lost = [...want].filter(([c, n]) => (got.get(c) || 0) < n).map(([c]) => c);
        assert.deepEqual(lost, [], 'a letter lost');
      });
    }
  }

  it('a word that fits its cell is not broken: Classic in three columns', async () => {
    const pages = await read(await render(build('Engineering', 3)));
    const text = allText(pages);
    assert.ok(text.includes('Engineering'), 'the word prints whole');
  });
});
