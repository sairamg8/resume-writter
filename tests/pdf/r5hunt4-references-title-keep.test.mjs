// R5-HUNT4-PDF-REFERENCES-TITLE-PRESENCE-UNMEASURED: the References title kept the first row's tallest
// card counted as one line a field (and one spare). A card is unbreakable and, in the default Grids 2,
// 48% of the text wide, so a long job title, company and relationship each wrap: the card was taller
// than that, and the title stayed alone at the foot of a page while the cards moved to the next. The
// title now keeps each field's lines wrapped at the card's text width (entryTextWidth, less its padding
// and border), as the Sidebar column's SideReferences measures them. The sweep slides the section down
// the page as r5hunt3-certifications-title-keep.test.mjs does (its helpers, copied). Fictional data only.
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

const JOB = 'Vice President of Engineering, Payments Platform and Coastal Sensor Operations';
const COMPANY = 'International Consolidated Tidepool Research Collective of the Northern Shores';
const RELATION = 'Former direct manager at two companies over nine years';

const references = (settings = {}) => () => section('references', [
  { name: 'Morgan Tideweather', jobTitle: JOB, company: COMPANY, relationship: RELATION, email: 'morgan@example.com', phone: '+1 555 0100' },
  { name: 'Sam Example', jobTitle: 'Engineer', company: 'Somewhere', email: 'sam@example.com', phone: '+1 555 0101' },
], { columns: 2, ...settings }, { title: 'Target Zone' });

describe('A References title moves with a first card whose fields wrap (R5-HUNT4-PDF-REFERENCES-TITLE-PRESENCE-UNMEASURED)', () => {
  it('the case wraps as it says', async () => {
    const t = references()();
    assert.ok(await linesOf('classic', t, [...JOB.split(' '), ...COMPANY.split(' '), ...RELATION.split(' ')].filter((w) => w.length > 4)) >= 6,
      'the job title, company and relationship on two lines each');
  });
  it('Classic, Grids 2: the title never ends a page alone', async () => {
    assert.deepEqual(await sweep('classic', references()), []);
  });
  it('Classic, Grids 2, Center: the title never ends a page alone', async () => {
    assert.deepEqual(await sweep('classic', references({ alignment: 'center' })), []);
  });
  it('Minimal, Grids 3: the title never ends a page alone', async () => {
    assert.deepEqual(await sweep('minimal', references({ columns: 3 })), []);
  });
});
