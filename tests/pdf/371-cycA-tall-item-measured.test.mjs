// U9 (follow-up): whether a list item is kept whole on one page was decided by a deliberately cautious guess (half an em a
// character plus one line, against 80 percent of the page), so a bullet over about 575 characters in a 4-column Grids cell (800 in
// 3) was allowed to split across a page foot although it fits a page. fitsPage now counts the lines from the widths of the words in
// the page's own font (pdfMeasure's wrappedLines) and keeps an item whole up to 90 percent of the page's text (a line spare).
// Pinned: a bullet that fills 82 percent of a page (its height measured from a render of it, so the case does not depend on a
// guess of mine) in a 4-column cell starts and ends on one page, however many of them follow each other, with every line above
// the bottom margin; the bullets that are taller than a page still split (370-cyc8-tall-item-splits).
// Run: node --test tests/pdf/371-cycA-tall-item-measured.test.mjs
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  setup, teardown, resume, section, render, read, allItems, MM,
} from './harness.mjs';

before(setup);
after(teardown);

const FILLER = 'shipped scalable services improving latency reliability across teams while mentoring engineers and owning delivery end to end'.split(' ');
/** `n` words of ordinary prose, `lead` first and `tail` last. */
const prose = (n, lead, tail) => [lead, ...Array.from({ length: n }, (_, i) => FILLER[(i * 5) % FILLER.length]), tail].join(' ');
const id = (k) => String.fromCharCode(97 + k);
const SETTINGS = { fontSizeBase: 12, marginV: 40 };
const ONE_OF_THE_BULLET = new RegExp(`\\b(?:${FILLER.join('|')})\\b|Alpha|omega`);

const grid = (bullets) => resume({
  template: 'classic',
  settings: SETTINGS,
  sections: [section('experience', [
    { company: 'Acme', role: 'Engineer', startDate: '2020', endDate: '2021', description: `<ul>${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>` },
  ], { columns: 4 })],
});

/** How many pt the one bullet of `n` words takes in the cell, from the lines it prints, and the page's text height. */
async function measured(n) {
  const pages = await read(await render(grid([prose(n, 'Alpha', 'omega')])));
  const rows = new Set(allItems(pages).filter((t) => ONE_OF_THE_BULLET.test(t.str)).map((t) => `${t.page}:${Math.round(t.y)}`));
  const ys = [...rows].map((r) => r.split(':').map(Number)).sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  const steps = [];
  for (let i = 1; i < ys.length; i += 1) if (ys[i][0] === ys[i - 1][0]) steps.push(ys[i - 1][1] - ys[i][1]);
  const step = Math.min(...steps.filter((d) => d > 5));
  return { height: rows.size * step, page: pages[0].H - 2 * SETTINGS.marginV * MM };
}

describe('a list item that fits a page is kept whole in a narrow cell (U9)', () => {
  it('bullets that fill 82 percent of a page each start and end on one page', async () => {
    // The most words whose bullet takes up to 82 percent of a page's text, found by bisection on real renders.
    let lo = 40;
    let hi = 400;
    let probe = await measured(lo);
    assert.ok(probe.height < probe.page * 0.82, `${lo} words are a short bullet: ${probe.height} of ${probe.page} pt`);
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      probe = await measured(mid);
      if (probe.height <= probe.page * 0.82) lo = mid; else hi = mid;
    }
    const sized = await measured(lo);
    assert.ok(sized.height > sized.page * 0.7, `the bullet is a case: ${sized.height} of ${sized.page} pt (${lo} words)`);

    const bullets = Array.from({ length: 5 }, (_, k) => prose(lo, `Alpha${id(k)}`, `omega${id(k)}`));
    const pages = await read(await render(grid(bullets)));
    assert.ok(pages.length >= 4, `the bullets need ${pages.length} pages: only one fits each`);
    const items = allItems(pages);
    const pageOf = (word) => items.find((t) => t.str.includes(word))?.page;
    for (let k = 0; k < bullets.length; k += 1) {
      assert.ok(pageOf(`Alpha${id(k)}`), `bullet ${k} prints`);
      assert.equal(pageOf(`omega${id(k)}`), pageOf(`Alpha${id(k)}`), `bullet ${k} starts and ends on one page`);
    }
    const low = items.filter((t) => t.y < SETTINGS.marginV * MM - 3);
    assert.deepEqual(low.map((t) => `p${t.page}: "${t.str.slice(0, 24)}" at y=${t.y.toFixed(1)}`), [], 'nothing below the bottom margin');
  });
});
