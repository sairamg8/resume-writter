// R4-DOUT-07 (remainder): on the Timeline a section title keeps its first entry's head under it
// (timelineHeadPresence), but it counted that head's lines by field — one for the title, one for the
// sub and location — with one spare line for a field that wraps. A company name that wraps onto a
// third line, a two-line name over a role that wraps beside its location, or a grouped employer's
// name on three lines took more than that: with the room between the two left at the page foot, the
// title stayed there alone and the head moved to the next page. Each field is now wrapped at the
// rail's text width (wrappedLines, endRowLines), the spare line kept as a margin. The sweep slides the
// section down the page as 102-r4-dout-07-timeline-title-keep.test.mjs does (its helpers, copied).
// Fictional data only.
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

/** The lines (distinct baselines) `words` print on: a check that the head wraps as the case needs. */
async function linesOf(t, words) {
  const items = allItems(await read(await render(resume({ template: 'timeline', sections: [t] }))));
  return new Set(items.filter((i) => words.some((w) => i.str.includes(w))).map((i) => Math.round(i.y))).size;
}

const bullets = '<ul><li>Built the platform</li><li>Ran it</li><li>Grew it</li></ul>';
// About 165 bold characters: three lines at the rail's width, whatever the default page size.
const LONG = 'Northfield Consolidated Aerospace and Renewable Energy Engineering Holdings International Ltd, Southgate Maritime Logistics and Advanced Materials Research Division';
const TWO = 'Northfield Consolidated Aerospace and Renewable Energy Engineering Holdings International Ltd';
const LONG_ROLE = 'Principal Platform Engineer for Payments Reliability, Settlement Ledgers and Observability';

const threeLines = () => section('experience', [
  { company: LONG, role: 'Platform Engineer', startDate: '2019', endDate: '2021', description: bullets },
], { alignment: 'left', titleStyle: 'stacked', titleOrder: 'company' }, { title: 'Target Zone' });

const bothWrap = () => section('experience', [
  { company: TWO, role: LONG_ROLE, location: 'Pune, Maharashtra', startDate: '2019', endDate: '2021', description: bullets },
], { alignment: 'left', titleStyle: 'stacked', titleOrder: 'company' }, { title: 'Target Zone' });

const grouped = () => section('experience', [
  { company: LONG, role: 'Platform Engineer', startDate: '2021', endDate: '2023', description: bullets },
  { company: LONG, role: 'Software Engineer', startDate: '2019', endDate: '2021', description: bullets },
], { alignment: 'left', titleStyle: 'stacked', groupRoles: true }, { title: 'Target Zone' });

describe('Timeline: a section title moves with a first head whose fields wrap (R4-DOUT-07)', () => {
  it('the cases wrap as they say', async () => {
    assert.ok(await linesOf(threeLines(), ['Northfield', 'Southgate', 'Maritime', 'Division', 'Research']) >= 3, 'the company on three lines');
    assert.ok(await linesOf(bothWrap(), ['Principal', 'Payments', 'Reliability', 'Settlement', 'Observability']) >= 2, 'the role on two lines');
  });
  it('Stacked, a company name on three lines', async () => {
    assert.deepEqual(await sweep('timeline', threeLines, titleNotAlone), []);
  });
  it('Stacked, a two-line company name over a role that wraps beside its location', async () => {
    assert.deepEqual(await sweep('timeline', bothWrap, titleNotAlone), []);
  });
  it('grouped roles, an employer name on three lines', async () => {
    assert.deepEqual(await sweep('timeline', grouped, titleNotAlone), []);
  });
});
