// U9: a list item up to 1500 characters was kept whole on one page (wrap={false}). In a narrow Grids
// cell (3 or 4 columns) at a large type size, or the Sidebar's dark column between wide margins, one
// such item is taller than a page: it cannot break, so it ran off the page foot and its tail was lost.
// Now PdfRichText keeps an item whole only while a page can hold it (keepTogether.js: fitsPage, against
// the room RenderColGrid and the Sidebar column provide), and lets a taller one split across pages.
// Pinned: the tall item's lines all stay above the bottom margin and its last word prints; a short
// bullet in the same cell still never splits across a page break; fitsPage's own estimate.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, teardown, resume, section, render, read, allItems, allText, loadModule, MM,
} from './harness.mjs';

before(setup);
after(teardown);

const FILLER = 'shipped scalable services improving latency reliability across teams while mentoring engineers and owning delivery end to end'.split(' ');
/** `n` words of ordinary prose, `lead` first and `tail` last. */
const prose = (n, lead, tail) => [lead, ...Array.from({ length: n }, (_, i) => FILLER[(i * 5) % FILLER.length]), tail].join(' ');

/** The text items below the page bottom margin (marginV mm, less the 3 pt the pagination tests allow). */
const belowMargin = (pages, marginV) => allItems(pages)
  .filter((t) => t.y < marginV * MM - 3)
  .map((t) => `p${t.page}: "${t.str.slice(0, 24)}" at y=${t.y.toFixed(1)}`);

describe('a list item taller than a page splits instead of running off the page (U9)', () => {
  const TALL = prose(170, 'Headstart', 'tailendmark'); // about 1300 characters, under the 1500 a bullet was always kept whole up to
  it('the bullet is long enough to be a case', () => {
    assert.ok(TALL.length > 1200 && TALL.length < 1500, `length ${TALL.length}`);
  });

  it('Grids 4 at 12 pt between 40 mm margins: every line stays above the bottom margin and the last word prints', async () => {
    const entries = section('experience', [
      { company: 'Acme', role: 'Engineer', startDate: '2020', endDate: '2021', description: `<ul><li>${TALL}</li></ul>` },
    ], { columns: 4 });
    const pages = await read(await render(resume({
      template: 'classic', settings: { fontSizeBase: 12, marginV: 40 }, sections: [entries],
    })));
    assert.ok(pages.length >= 2, `the item runs over ${pages.length} pages`);
    assert.deepEqual(belowMargin(pages, 40), [], 'nothing below the bottom margin');
    assert.match(allText(pages), /tailendmark/, 'the last word of the bullet prints');
  });

  it('the Sidebar dark column between 40 mm margins: every line stays above the bottom margin and the last word prints', async () => {
    const education = section('education', [
      { institution: 'State University', degree: 'B.Tech', startDate: '2012', endDate: '2016', description: `<ul><li>${TALL}</li></ul>` },
    ]);
    const pages = await read(await render(resume({
      template: 'sidebar', settings: { marginV: 40, marginH: 40 }, sections: [education],
    })));
    assert.ok(pages.length >= 2, `the item runs over ${pages.length} pages`);
    assert.deepEqual(belowMargin(pages, 40), [], 'nothing below the bottom margin');
    assert.match(allText(pages), /tailendmark/, 'the last word of the bullet prints');
  });

  it('short bullets in the same narrow cell still never split across a page break', async () => {
    // Letters, not numbers: no bullet's mark is the start of another's.
    const id = (k) => String.fromCharCode(97 + k);
    const lis = Array.from({ length: 14 }, (_, k) => `<li>${prose(18, `Alpha${id(k)}`, `omega${id(k)}`)}</li>`).join('');
    const entries = section('experience', [
      { company: 'Acme', role: 'Engineer', startDate: '2020', endDate: '2021', description: `<ul>${lis}</ul>` },
    ], { columns: 4 });
    const pages = await read(await render(resume({
      template: 'classic', settings: { fontSizeBase: 12, marginV: 40 }, sections: [entries],
    })));
    assert.ok(pages.length >= 2, `the bullets run over ${pages.length} pages, so a break falls among them`);
    const items = allItems(pages);
    const pageOf = (word) => items.find((t) => t.str.includes(word))?.page;
    for (let k = 0; k < 14; k += 1) {
      assert.ok(pageOf(`Alpha${id(k)}`), `bullet ${k} prints`);
      assert.equal(pageOf(`omega${id(k)}`), pageOf(`Alpha${id(k)}`), `bullet ${k} starts and ends on one page`);
    }
  });
});

describe('fitsPage: whether a list item can be kept whole on one page (U9)', () => {
  const cell = { fontSize: 12, lineHeight: 1.5, width: 100, height: 615 };
  const fits = async (args) => (await loadModule('/src/templates/pdf/shared/keepTogether.js')).fitsPage(args);

  it('a short bullet in a narrow cell is kept whole', async () => {
    assert.equal(await fits({ ...cell, text: 'a'.repeat(150) }), true);
  });
  it('a bullet taller than a page in a narrow cell is not', async () => {
    assert.equal(await fits({ ...cell, text: 'a'.repeat(600) }), false);
    assert.equal(await fits({ ...cell, text: 'a'.repeat(1400) }), false);
  });
  it('the same 1400 characters across the full page width are kept whole', async () => {
    assert.equal(await fits({ text: 'a'.repeat(1400), fontSize: 11, lineHeight: 1.5, width: 493, height: 760 }), true);
  });
  it('a character of a wide script counts as a full em', async () => {
    assert.equal(await fits({ ...cell, text: 'a'.repeat(300) }), true);
    assert.equal(await fits({ ...cell, text: '漢'.repeat(300) }), false);
  });
  it('a column narrower than one character, or a page with no height, keeps nothing whole', async () => {
    assert.equal(await fits({ ...cell, text: 'a', width: 10 }), false);
    assert.equal(await fits({ ...cell, text: 'a', height: 0 }), false);
  });
});
