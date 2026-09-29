// R5-HUNT3-AWARDS-TITLE-KEEP-UNMEASURED: the Awards section title kept its first award's block counted
// as one line a field (title, issuer, date) and the spare line headPresence adds, never measured as
// Projects' header is (R4-DOUT-04). An award title that wraps onto three lines, or a two-line title
// over a wrapping issuer, made the unbreakable block taller than that: the title stayed alone at the
// foot of a page while the award moved to the next. The title and issuer are now each wrapped at the
// entry's width (entryTextWidth, a Grids cell's). The sweep slides the section down the page as
// 104-r5-out-dout-04-projects-keep.test.mjs does (its helpers, copied). Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, read, allItems } from './harness.mjs';

before(setup);
after(teardown);

/** The Sidebar's dark column: its share of the paper (PdfPage.jsx SIDE_COL); its main column starts past it. */
const SIDE_SHARE = 0.38;

const layout = async (template, t, n, px) => {
  const lis = Array.from({ length: n }, (_, i) => `<li>Filler bullet ${i + 1}</li>`).join('');
  const lead = experience([{ description: `<ul>${lis}</ul>` }]);
  lead.settings = { ...lead.settings, spaceAfter: px };
  return read(await render(resume({ template, sections: [lead, t] })));
};

const titleOf = (items, t) => items.find((i) => i.str.trim().toUpperCase() === t.title.toUpperCase());

/** The fewest filler bullets that print `target()`'s title on page 2. */
async function footOf(template, target) {
  const page = async (n) => {
    const t = target();
    return titleOf(allItems(await layout(template, t, n, 0)), t)?.page ?? 0;
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
async function sweep(template, target) {
  const to = await footOf(template, target);
  const found = [];
  const pagesOf = new Set();
  for (let n = to - 5; n <= to; n += 1) {
    for (let px = 0; px <= 22; px += 2) {
      const t = target();
      const pages = await layout(template, t, n, px);
      const items = allItems(pages);
      pagesOf.add(titleOf(items, t)?.page);
      for (const p of titleNotAlone(template, items, pages, t)) found.push(`n=${n} px=${px}: ${p}`);
    }
  }
  if (!pagesOf.has(1) || !pagesOf.has(2)) found.push(`the sweep never crossed the page foot (pages ${[...pagesOf]})`);
  return found;
}

/** The section title never the last line of its column on a page that is not the last. */
function titleNotAlone(template, items, pages, t) {
  const title = titleOf(items, t);
  if (!title) return [`"${t.title}" not printed`];
  const left = template === 'sidebar' ? pages[title.page - 1].W * SIDE_SHARE : -1;
  const below = items.filter((i) => i.page === title.page && i.x > left && i.y < title.y - 1);
  return !below.length && title.page < pages.length ? [`"${t.title}" ends page ${title.page}`] : [];
}

/** The lines (distinct baselines) `words` print on: a check that the header wraps as the case needs. */
async function linesOf(template, t, words) {
  const items = allItems(await read(await render(resume({ template, sections: [t] }))));
  return new Set(items.filter((i) => words.some((w) => i.str.includes(w))).map((i) => Math.round(i.y))).size;
}

// About 230 bold characters: three lines of the page's text or more, on A4 or US Letter.
const TITLE = 'Outstanding Contribution to Distributed Systems Reliability, Platform Engineering Excellence, Open Source Community Stewardship and Mentoring of the Regional Volunteer Coastal Weather Observers Network Award';
const ISSUER = 'Tidepool Collective Coastal Weather Observers Association, Regional Chapter for Community Science and Open Environmental Data';
const DESC = '<p>Recognised for keeping the volunteer station network online through two storm seasons and mentoring new observers.</p>';

const awards = (settings = {}) => () => section('awards', [
  { title: TITLE, issuer: ISSUER, date: '2023', description: DESC },
  { title: 'Second Award', issuer: 'Somewhere', date: '2022' },
], settings, { title: 'Target Zone' });

describe('An Awards title moves with a first award whose title and issuer wrap (R5-HUNT3-AWARDS-TITLE-KEEP-UNMEASURED)', () => {
  it('the case wraps as it says', async () => {
    const t = awards()();
    assert.ok(await linesOf('classic', t, ['Outstanding', 'Stewardship', 'Mentoring', 'Observers Network', 'Award']) >= 3, 'the title on three lines');
    assert.ok(await linesOf('classic', t, ['Association', 'Chapter', 'Environmental']) >= 2, 'the issuer on two lines');
  });
  it('Classic, Left: the title never ends a page alone', async () => {
    assert.deepEqual(await sweep('classic', awards()), []);
  });
  it('Classic, Center: the title never ends a page alone', async () => {
    assert.deepEqual(await sweep('classic', awards({ alignment: 'center' })), []);
  });
  it('Minimal, Grids 2: the title never ends a page alone', async () => {
    assert.deepEqual(await sweep('minimal', awards({ columns: 2 })), []);
  });
});
