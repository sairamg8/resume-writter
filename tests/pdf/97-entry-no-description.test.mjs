// R1-LEFT-c (R2-049's award fix, f6cb390, applied to every entry header): an entry with no description
// moves to the next page only when its header does not fit on this one. An unbreakable header keeps two
// lines of what follows it, and react-pdf keeps that room below it even when nothing follows: an
// education, a project, a Sidebar card or a Timeline entry with no description moved on wherever its
// header fit but two more lines did not.
// Two such entries follow a run of filler bullets, slid down the page 1.5 pt at a time. Wherever the
// second prints on page 2 and the first on page 1, the second, placed under the first at the gap they
// have on one page, must reach below the lowest line page 1 ever prints.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, read, allItems } from './harness.mjs';

before(setup);
after(teardown);

const education = () => section('education', [
  { institution: 'Opening Institute', degree: 'Openfield Degree', startDate: '2011', endDate: '2013' },
  { institution: 'Closing Institute', degree: 'Closefield Degree', startDate: '2015', endDate: '2017' },
], {}, { title: 'Education' });

const projects = () => section('projects', [
  { name: 'Opening Project', technologies: 'Openstack Tools', startDate: '2011' },
  { name: 'Closing Project', technologies: 'Closestack Tools', startDate: '2015' },
], {}, { title: 'Projects' });

const jobs = () => section('experience', [
  { company: 'Opening Works', role: 'Opening Role', startDate: '2011', endDate: '2013' },
  { company: 'Closing Works', role: 'Closing Role', startDate: '2015', endDate: '2017' },
], {}, { title: 'Jobs Zone' });

const OPENING = ['Opening', 'Openfield', 'Openstack', '2011'];
const CLOSING = ['Closing', 'Closefield', 'Closestack', '2015'];

const layout = async (template, target, n, px) => {
  const lis = Array.from({ length: n }, (_, i) => `<li>Filler bullet ${i + 1}</li>`).join('');
  const lead = experience([{ description: `<ul>${lis}</ul>` }]);
  lead.settings = { ...lead.settings, spaceAfter: px };
  return allItems(await read(await render(resume({ template, sections: [lead, target()] }))));
};

const linesOf = (items, needles) => items.filter((i) => needles.some((w) => i.str.includes(w)));
const top = (lines) => Math.max(...lines.map((i) => i.y));
const lowest = (lines) => Math.min(...lines.map((i) => i.y));
const onPage = (lines, page) => lines.length && lines.every((i) => i.page === page);

/** The fewest filler bullets that print the second entry on page 2. */
async function footOf(template, target) {
  const page = async (n) => Math.max(0, ...linesOf(await layout(template, target, n, 0), CLOSING).map((i) => i.page));
  let [lo, hi] = [1, 160];
  if (await page(hi) < 2) throw new Error(`${template}: the second entry never reaches page 2`);
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (await page(mid) > 1) hi = mid; else lo = mid;
  }
  return hi;
}

async function needlessMoves(template, target) {
  const to = await footOf(template, target);
  const layouts = [];
  for (let n = to - 5; n <= to; n += 1) {
    for (let px = 0; px <= 22; px += 2) layouts.push({ n, px, items: await layout(template, target, n, px) });
  }
  // The lowest baseline page 1 prints anywhere: a line of the same size fits there.
  const foot = Math.min(...layouts.flatMap(({ items }) => items.filter((i) => i.page === 1).map((i) => i.y)));
  // From the first entry's last line to the second's first, both on one page.
  const gaps = layouts.flatMap(({ items }) => {
    const [a, b] = [linesOf(items, OPENING), linesOf(items, CLOSING)];
    return onPage(a, 1) && onPage(b, 1) ? [lowest(a) - top(b)] : [];
  });
  const found = [];
  if (!gaps.length) found.push('the two entries never print together on page 1');
  const gap = Math.max(...gaps);
  let crossed = false;
  for (const { n, px, items } of layouts) {
    const [a, b] = [linesOf(items, OPENING), linesOf(items, CLOSING)];
    if (!onPage(a, 1) || !onPage(b, 2)) continue;
    crossed = true;
    const bottom = lowest(a) - gap - (top(b) - lowest(b));
    if (bottom > foot + 0.5) found.push(`n=${n} px=${px}: the second entry moved to page 2, its last line would print at ${bottom.toFixed(1)} pt, above page 1's lowest line at ${foot.toFixed(1)} pt`);
  }
  if (!crossed) found.push('the sweep never printed the first entry on page 1 and the second on page 2');
  return found;
}

describe('an entry with no description moves only when its header does not fit (R1-LEFT-c)', () => {
  it('classic: an education', async () => {
    assert.deepEqual(await needlessMoves('classic', education), []);
  });
  it('classic: a project', async () => {
    assert.deepEqual(await needlessMoves('classic', projects), []);
  });
  it('sidebar: an Experience card', async () => {
    assert.deepEqual(await needlessMoves('sidebar', jobs), []);
  });
  it('timeline: an education', async () => {
    assert.deepEqual(await needlessMoves('timeline', education), []);
  });
});
