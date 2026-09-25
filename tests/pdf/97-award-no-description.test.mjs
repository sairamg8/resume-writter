// R1-LEFT-a (R2-049, commit f6cb390): an award with no description moves to the next page only when
// its title, issuer and date do not fit on this one. It keeps no lines of a description it does not
// have: react-pdf keeps a block's minPresenceAhead room below it even when nothing follows, and such an
// award moved on wherever its block fit but two more lines did not.
// Two awards without descriptions follow a run of filler bullets, slid down the page 1.5 pt at a time.
// Wherever the second award prints on page 2 and the first on page 1, the second's block, placed under
// the first at the gap they have on one page, must reach below the lowest line page 1 ever prints.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, read, allItems } from './harness.mjs';

before(setup);
after(teardown);

const awards = () => section('awards', [
  { title: 'Opening Prize', issuer: 'Northwind Guild', date: '2019' },
  { title: 'Closing Prize', issuer: 'Southwind Society', date: '2021' },
], {}, { title: 'Awards' });

const layout = async (template, n, px) => {
  const lis = Array.from({ length: n }, (_, i) => `<li>Filler bullet ${i + 1}</li>`).join('');
  const lead = experience([{ description: `<ul>${lis}</ul>` }]);
  lead.settings = { ...lead.settings, spaceAfter: px };
  return allItems(await read(await render(resume({ template, sections: [lead, awards()] }))));
};

/** An award's printed lines: its title, issuer and date. */
const linesOf = (items, title, issuer, date) => items.filter((i) => i.str.includes(title) || i.str.includes(issuer) || i.str.trim() === date);
const opening = (items) => linesOf(items, 'Opening Prize', 'Northwind Guild', '2019');
const closing = (items) => linesOf(items, 'Closing Prize', 'Southwind Society', '2021');
const titleOf = (items, t) => items.find((i) => i.str.includes(t));
const lowest = (lines) => Math.min(...lines.map((i) => i.y));

/** The fewest filler bullets that print the second award's title on page 2. */
async function footOf(template) {
  const page = async (n) => titleOf(await layout(template, n, 0), 'Closing Prize')?.page ?? 0;
  let [lo, hi] = [1, 160];
  if (await page(hi) < 2) throw new Error(`${template}: the second award never reaches page 2`);
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (await page(mid) > 1) hi = mid; else lo = mid;
  }
  return hi;
}

async function needlessMoves(template) {
  const to = await footOf(template);
  const layouts = [];
  for (let n = to - 5; n <= to; n += 1) {
    for (let px = 0; px <= 22; px += 2) layouts.push({ n, px, items: await layout(template, n, px) });
  }
  // The lowest baseline page 1 prints anywhere: a line of the same size fits there.
  const foot = Math.min(...layouts.flatMap(({ items }) => items.filter((i) => i.page === 1).map((i) => i.y)));
  // From the first award's last line to the second's title, both on one page.
  const gaps = layouts.flatMap(({ items }) => {
    const [a, b] = [opening(items), closing(items)];
    return a.length && b.length && [...a, ...b].every((i) => i.page === 1) ? [lowest(a) - titleOf(items, 'Closing Prize').y] : [];
  });
  const found = [];
  let crossed = false;
  if (!gaps.length) found.push('the two awards never print together on page 1');
  const gap = Math.max(...gaps);
  for (const { n, px, items } of layouts) {
    const [a, b] = [opening(items), closing(items)];
    if (!a.length || a.some((i) => i.page !== 1) || !b.length || b.some((i) => i.page !== 2)) continue;
    crossed = true;
    const height = titleOf(items, 'Closing Prize').y - lowest(b);
    const bottom = lowest(a) - gap - height;
    if (bottom > foot + 0.5) found.push(`n=${n} px=${px}: the second award moved to page 2, its last line would print at ${bottom.toFixed(1)} pt, above page 1's lowest line at ${foot.toFixed(1)} pt`);
  }
  if (!crossed) found.push('the sweep never printed the first award on page 1 and the second on page 2');
  return found;
}

describe('an award with no description moves only when it does not fit (R1-LEFT-a, R2-049)', () => {
  for (const template of ['classic', 'executive']) {
    it(`${template}: the award stays on the page its title, issuer and date fit on`, async () => {
      assert.deepEqual(await needlessMoves(template), []);
    });
  }
});
