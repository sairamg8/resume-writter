// R4-DOUT-07: on the Timeline, a section title moves to the next page with its first entry's head. The
// title kept a fixed five lines under it (~83 pt at 11 pt), but a head with its date line, a centred
// Stacked title, sub and location, or a title that wraps, plus the two lines it keeps, needs ~95 pt:
// with 83-95 pt left the title stayed alone at the page foot and the head moved on. Now the title keeps
// what the first head's own layout takes (timelineHeadPresence), as Classic keeps its first ItemHeader
// (R2-047). The section is slid down the page 1.5 pt at a time past a run of filler bullets, as in
// 84-keep-together.test.mjs (its sweep and footOf, copied here).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, read, allItems } from './harness.mjs';

before(setup);
after(teardown);

const layout = async (template, settings, t, n, px) => {
  const lis = Array.from({ length: n }, (_, i) => `<li>Filler bullet ${i + 1}</li>`).join('');
  const lead = experience([{ description: `<ul>${lis}</ul>` }]);
  lead.settings = { ...lead.settings, spaceAfter: px };
  return read(await render(resume({ template, settings, sections: [lead, t] })));
};

const titleOf = (items, t) => items.find((i) => i.str.trim().toUpperCase() === t.title.toUpperCase());

/** The fewest filler bullets that print `target()`'s title on page 2. */
async function footOf(template, target, settings) {
  const page = async (n) => {
    const t = target();
    return titleOf(allItems(await layout(template, settings, t, n, 0)), t)?.page ?? 0;
  };
  let [lo, hi] = [1, 160];
  if (await page(hi) < 2) throw new Error(`${template}: "${target().title}" never reaches page 2`);
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (await page(mid) > 1) hi = mid; else lo = mid;
  }
  return hi;
}

/** Each layout of `target()` over the six filler counts that end where its title is first pushed to page 2. */
async function sweep(template, target, check, { settings = {} } = {}) {
  const to = await footOf(template, target, settings);
  const found = [];
  const pagesOf = new Set();
  for (let n = to - 5; n <= to; n += 1) {
    for (let px = 0; px <= 22; px += 2) {
      const t = target();
      const pages = await layout(template, settings, t, n, px);
      const items = allItems(pages);
      pagesOf.add(titleOf(items, t)?.page);
      for (const p of check(items, pages.length, t)) found.push(`n=${n} px=${px}: ${p}`);
    }
  }
  if (!pagesOf.has(1) || !pagesOf.has(2)) found.push(`the sweep never crossed the page foot (pages ${[...pagesOf]})`);
  return found;
}

/** The section title never the last line of a page that is not the last. */
function titleNotAlone(items, pageCount, t) {
  const title = titleOf(items, t);
  if (!title) return [`"${t.title}" not printed`];
  const below = items.filter((i) => i.page === title.page && i.y < title.y - 1);
  return !below.length && title.page < pageCount ? [`"${t.title}" ends page ${title.page}`] : [];
}

const bullets = '<ul><li>Built the platform</li><li>Ran it</li><li>Grew it</li></ul>';

// Centred, Stacked: the date, the company, the role and the location each on a line of their own.
const centred = () => section('experience', [
  { company: 'Railway Corp', role: 'Platform Engineer', location: 'Pune', startDate: '2019', endDate: '2021', description: bullets },
], { alignment: 'center', titleStyle: 'stacked' }, { title: 'Target Zone' });

// Left, Stacked, company first (the Timeline's default Order is role first): a bold company name long
// enough to wrap onto a second line, but not a third.
const wrapping = () => section('experience', [
  { company: 'Northfield Consolidated Aerospace and Renewable Energy Engineering Holdings International Ltd', role: 'Platform Engineer', startDate: '2019', endDate: '2021', description: bullets },
], { alignment: 'left', titleStyle: 'stacked', titleOrder: 'company' }, { title: 'Target Zone' });

describe('Timeline: a section title moves with its first entry\'s head (R4-DOUT-07)', () => {
  it('centred, Stacked, with a role, company, location and dates', async () => {
    assert.deepEqual(await sweep('timeline', centred, titleNotAlone), []);
  });
  it('Stacked, a company name that wraps', async () => {
    assert.deepEqual(await sweep('timeline', wrapping, titleNotAlone), []);
  });
});
