// U9 (follow-up): whether a list item is kept whole on one page was decided by a guess (half an em a character, 0.55, one line to
// spare, against 80 percent of the page) that does not know the text it is asked about: a bullet of narrow letters (i, l, t) takes
// little more than half what the guess says, so it was allowed to split across a page foot although a page holds it, and a bullet of
// wide ones (m, w) takes more than the guess says, so a bullet taller than a page was kept whole and cut off at the foot, its tail lost.
// fitsPage now counts the lines from the widths of the words in the page's own font (pdfMeasure's wrappedLines) and keeps an item
// whole up to 90 percent of the page's text (a line spare). Each case below is sized from real renders of the bullet, so it does
// not depend on a guess of mine: a bullet of narrow letters that fills 65 percent of a page, in a 4-column cell, starts and ends on
// one page however many follow each other; a bullet of wide ones that is taller than a page splits, every line above the bottom
// margin and its last word printed (370-cyc8-tall-item-splits pins the same for ordinary prose).
// Run: node --test tests/pdf/371-cycA-tall-item-measured.test.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, teardown, resume, section, render, read, allItems, MM,
} from './harness.mjs';

before(setup);
after(teardown);

const NARROW = 'little illicit still lilt tilt fill till flit fit lift mill'.split(' ');
const WIDE = 'mwmw wmwm mmww wwmm mwwm wmmw'.split(' ');
/** `n` words of `words`, `lead` first and `tail` last. */
const prose = (words, n, lead, tail) => [lead, ...Array.from({ length: n }, (_, i) => words[(i * 5) % words.length]), tail].join(' ');
const id = (k) => String.fromCharCode(97 + k);
const MARGIN_V = 40;

const grid = (bullets, marginV = MARGIN_V) => resume({
  template: 'classic',
  settings: { fontSizeBase: 12, marginV },
  sections: [section('experience', [
    { company: 'Acme', role: 'Engineer', startDate: '2020', endDate: '2021', description: `<ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>` },
  ], { columns: 4 })],
});

/**
 * How many pt the one bullet of `n` words takes in the cell, from the lines it prints on a page with no top or bottom margin (so a
 * bullet that is taller than the real page is not cut off, whatever the code under test does), and the page's text height at MARGIN_V.
 */
async function measured(words, n) {
  const pages = await read(await render(grid([prose(words, n, 'Alpha', 'omega')], 0)));
  const mine = new RegExp(`\\b(?:${words.join('|')})\\b|Alpha|omega`);
  const rows = new Set(allItems(pages).filter((t) => mine.test(t.str)).map((t) => `${t.page}:${Math.round(t.y)}`));
  const ys = [...rows].map((r) => r.split(':').map(Number)).sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const steps = [];
  for (let i = 1; i < ys.length; i += 1) if (ys[i][0] === ys[i - 1][0]) steps.push(ys[i - 1][1] - ys[i][1]);
  const step = Math.min(...steps.filter((d) => d > 5));
  return { height: rows.size * step, page: pages[0].H - 2 * MARGIN_V * MM };
}

/** The most words whose bullet takes up to `share` of a page's text, found by bisection on real renders. */
async function wordsFor(words, share) {
  let lo = 20;
  let hi = 600;
  const first = await measured(words, lo);
  assert.ok(first.height < first.page * share, `${lo} words are a short bullet: ${first.height} of ${first.page} pt`);
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    const probe = await measured(words, mid);
    if (probe.height <= probe.page * share) lo = mid; else hi = mid;
  }
  return { n: lo, ...(await measured(words, lo)) };
}

const belowMargin = (pages) => allItems(pages)
  .filter((t) => t.y < MARGIN_V * MM - 3)
  .map((t) => `p${t.page}: "${t.str.slice(0, 24)}" at y=${t.y.toFixed(1)}`);

describe('a list item is kept whole or split by its measured height (U9)', () => {
  it('bullets of narrow letters that fill 65 percent of a page each start and end on one page', async () => {
    const { n, height, page } = await wordsFor(NARROW, 0.65);
    assert.ok(height > page * 0.5, `the bullet is a case: ${height} of ${page} pt (${n} words)`);
    const bullets = Array.from({ length: 5 }, (_, k) => prose(NARROW, n, `Alpha${id(k)}`, `omega${id(k)}`));
    const pages = await read(await render(grid(bullets)));
    assert.ok(pages.length >= 3, `the bullets need ${pages.length} pages: only one fits each`);
    const items = allItems(pages);
    const pageOf = (word) => items.find((t) => t.str.includes(word))?.page;
    for (let k = 0; k < bullets.length; k += 1) {
      assert.ok(pageOf(`Alpha${id(k)}`), `bullet ${k} prints`);
      assert.equal(pageOf(`omega${id(k)}`), pageOf(`Alpha${id(k)}`), `bullet ${k} starts and ends on one page`);
    }
    assert.deepEqual(belowMargin(pages), [], 'nothing below the bottom margin');
  });

  it('a bullet of wide letters that is taller than a page splits, and none of it is cut off', async () => {
    // Just over one page: more than the page holds, less than the old guess (0.55 em a character) counted.
    const { n, height, page } = await wordsFor(WIDE, 1.05);
    assert.ok(height > page * 1.0, `the bullet is taller than a page: ${height} of ${page} pt (${n} words)`);
    const pages = await read(await render(grid([prose(WIDE, n, 'Alpha', 'omega')])));
    assert.ok(pages.length >= 2, `the bullet runs over ${pages.length} pages`);
    assert.deepEqual(belowMargin(pages), [], 'nothing below the bottom margin');
    assert.ok(allItems(pages).some((t) => t.str.includes('omega')), 'the last word of the bullet prints');
  });
});
