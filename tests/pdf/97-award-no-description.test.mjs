// R1-LEFT-a (R2-049, commit f6cb390): an award with no description moves to the next page only when
// its title, issuer and date do not fit on this one. It keeps no lines of a description it does not
// have: react-pdf keeps a block's minPresenceAhead room below it even when nothing follows.
// react-pdf reads that keep only while it splits the award's own cell, so the case is a 2-column
// Awards grid whose row splits at the page foot: the left award's long description continues on the
// next page, and the right award, with no description and a title that wraps over many lines, is
// stretched to the row's height. Slid down the page 1.5 pt at a time, wherever the right award prints
// on page 2 while the left one's title stays on page 1, it must not have fit above page 1's lowest line.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, read, allItems } from './harness.mjs';

before(setup);
after(teardown);

const RIGHT_TITLE = Array.from({ length: 40 }, () => 'Rightword').join(' ');
const awards = () => section('awards', [
  { title: 'Leftaward', issuer: 'Leftissuer', date: '2019', description: Array.from({ length: 24 }, (_, i) => `<p>Leftline ${i + 1}</p>`).join('') },
  { title: RIGHT_TITLE, issuer: 'Rightissuer', date: '2021' },
], { columns: 2 }, { title: 'Awards' });

const layout = async (template, n, px) => {
  const lis = Array.from({ length: n }, (_, i) => `<li>Filler bullet ${i + 1}</li>`).join('');
  const lead = experience([{ description: `<ul>${lis}</ul>` }]);
  lead.settings = { ...lead.settings, spaceAfter: px };
  return allItems(await read(await render(resume({ template, sections: [lead, awards()] }))));
};

const leftTitle = (items) => items.find((i) => i.str.trim() === 'Leftaward');
const rightLines = (items) => items.filter((i) => i.str.includes('Rightword') || i.str.includes('Rightissuer') || i.str.trim() === '2021');

/** The fewest filler bullets that print the left award's title on page 2 (the row moves whole). */
async function footOf(template) {
  const page = async (n) => leftTitle(await layout(template, n, 0))?.page ?? 0;
  let [lo, hi] = [1, 160];
  if (await page(hi) < 2) throw new Error(`${template}: the awards never reach page 2`);
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (await page(mid) > 1) hi = mid; else lo = mid;
  }
  return hi;
}

async function needlessMoves(template) {
  const to = await footOf(template);
  const layouts = [];
  for (let n = to - 12; n < to; n += 1) {
    for (let px = 0; px <= 22; px += 2) layouts.push({ n, px, items: await layout(template, n, px) });
  }
  // The lowest baseline page 1 prints anywhere: the award's last line fits there.
  const foot = Math.min(...layouts.flatMap(({ items }) => items.filter((i) => i.page === 1).map((i) => i.y)));
  const found = [];
  let crossed = false;
  for (const { n, px, items } of layouts) {
    const [l, r] = [leftTitle(items), rightLines(items)];
    if (!l || l.page !== 1 || !r.length || r.some((i) => i.page !== 2)) continue;
    crossed = true;
    // Both titles open the row: the right award, left on page 1, would end its block's height below it.
    const bottom = l.y - (Math.max(...r.map((i) => i.y)) - Math.min(...r.map((i) => i.y)));
    if (bottom > foot + 4) found.push(`n=${n} px=${px}: the right award moved to page 2, its last line would print at ${bottom.toFixed(1)} pt, above page 1's lowest line at ${foot.toFixed(1)} pt`);
  }
  if (!crossed) found.push('the sweep never printed the left award on page 1 and the right one on page 2');
  return found;
}

describe('an award with no description moves only when it does not fit (R1-LEFT-a, R2-049)', () => {
  it('classic: the right award of a 2-column row stays on the page its title, issuer and date fit on', async () => {
    assert.deepEqual(await needlessMoves('classic'), []);
  });
});
