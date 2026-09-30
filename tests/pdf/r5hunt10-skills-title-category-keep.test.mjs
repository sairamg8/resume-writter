// R5-HUNT10-SKILLS-TITLE-ORPHANED-BY-CATEGORY-KEEP: since the R5-HUNT8 category fix, a Bars, Stacked or
// Tags group's category keeps the first lines of its skills on its page, moving to the next page with
// them; the Skills title kept only its own three lines, not that category and its keep. With the title
// just a little lower than that on a page, the category went to the next page and the title ended the
// page alone, in the main column and in the Sidebar's side column. The title now keeps the first
// category and what the category keeps. The sweep slides the section down the page (filler above it,
// then a gap of a few points) until the title is pushed to page 2, and fails where a page that is not
// the last ends its column with the title. Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, read, allItems } from './harness.mjs';

before(setup);
after(teardown);

/** The Sidebar's dark column: its share of the paper (PdfPage.jsx SIDE_COL); its main column starts past it. */
const SIDE_SHARE = 0.38;
const TITLE = 'Toolbox';

// A first group long enough that its category keeps the whole keep: many bars, a Stacked text of
// three lines or more, several rows of Tags.
const FIRST = [
  'React', 'TypeScript', 'CSS', 'Testing', 'Svelte', 'Solid', 'Lit', 'Vite', 'Webpack', 'Rollup', 'Storybook',
  'Playwright', 'Cypress', 'Vitest', 'Redux', 'Zustand', 'GraphQL', 'Apollo', 'Tailwind', 'Sass', 'Figma', 'Astro',
].join(', ');

const skills = (skillsStyle) => section('skills', [
  { category: 'Frontend', skills: FIRST },
  { category: 'Backend', skills: 'Elixir, Kotlin, Zig' },
], { skillsStyle }, { title: TITLE });

/** The résumé with `n` filler lines and a gap of `px` above Skills, in the column Skills prints in. */
function cv(template, style, n, px) {
  if (template === 'sidebar') {
    const lead = section('languages', Array.from({ length: n }, (_, i) => ({ language: `Filler ${i + 1}`, proficiency: '' })), { spaceAfter: px });
    return resume({ template, sections: [lead, skills(style)] });
  }
  const lis = Array.from({ length: n }, (_, i) => `<li>Filler bullet ${i + 1}</li>`).join('');
  const lead = experience([{ description: `<ul>${lis}</ul>` }]);
  lead.settings = { ...lead.settings, spaceAfter: px };
  return resume({ template, sections: [lead, skills(style)] });
}

const layout = async (template, style, n, px) => read(await render(cv(template, style, n, px)));

/** The text items of the Skills column (the side column's in the Sidebar, the page's elsewhere). */
const columnOf = (template, pages) => allItems(pages).filter((i) => (template === 'sidebar'
  ? i.x < pages[i.page - 1].W * SIDE_SHARE
  : true));

/** The column's lines ({ page, y, text }), a line's runs joined, spaces out (a letter-spaced title may come as several runs). */
function linesOf(template, pages) {
  const lines = new Map();
  for (const i of columnOf(template, pages)) {
    const k = `${i.page}:${Math.round(i.y)}`;
    lines.set(k, [...(lines.get(k) || []), i]);
  }
  return [...lines.values()].map((runs) => ({
    page: runs[0].page,
    y: Math.min(...runs.map((r) => r.y)),
    text: runs.sort((a, b) => a.x - b.x).map((r) => r.str).join('').replace(/\s+/g, '').toUpperCase(),
  }));
}

const titleLine = (lines) => lines.find((l) => l.text === TITLE.toUpperCase());

/** The fewest filler lines that print the title on page 2. */
async function footOf(template, style) {
  const page = async (n) => titleLine(linesOf(template, await layout(template, style, n, 0)))?.page ?? 0;
  let [lo, hi] = [1, 200];
  if (await page(hi) < 2) throw new Error(`${template} ${style}: "${TITLE}" never reaches page 2`);
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (await page(mid) > 1) hi = mid; else lo = mid;
  }
  return hi;
}

/** Each layout over the filler counts that end where the title is first pushed to page 2. */
async function sweep(template, style, span = 5) {
  const to = await footOf(template, style);
  const found = [];
  const titlePages = new Set();
  for (let n = Math.max(1, to - span); n <= to; n += 1) {
    for (let px = 0; px <= 20; px += 2) {
      const pages = await layout(template, style, n, px);
      const lines = linesOf(template, pages);
      const title = titleLine(lines);
      if (!title) { found.push(`n=${n} px=${px}: "${TITLE}" not printed`); continue; }
      titlePages.add(title.page);
      const below = lines.filter((l) => l.page === title.page && l.y < title.y - 1);
      if (!below.length && title.page < pages.length) found.push(`n=${n} px=${px}: "${TITLE}" ends page ${title.page}`);
    }
  }
  if (!titlePages.has(1) || !titlePages.has(2)) found.push(`the sweep never crossed the page foot (pages ${[...titlePages]})`);
  return found;
}

describe('A Skills title keeps its first group\'s category with it (R5-HUNT10-SKILLS-TITLE-ORPHANED-BY-CATEGORY-KEEP)', () => {
  it('Classic, Bars', async () => {
    assert.deepEqual(await sweep('classic', 'bars'), []);
  });
  it('Classic, Stacked', async () => {
    assert.deepEqual(await sweep('classic', 'stacked'), []);
  });
  it('Classic, Tags', async () => {
    assert.deepEqual(await sweep('classic', 'tags'), []);
  });
  it('Sidebar\'s side column, Bars', async () => {
    assert.deepEqual(await sweep('sidebar', 'bars'), []);
  });
  it('Sidebar\'s side column, Stacked', async () => {
    assert.deepEqual(await sweep('sidebar', 'stacked'), []);
  });
  it('Sidebar\'s side column, Tags', async () => {
    assert.deepEqual(await sweep('sidebar', 'tags'), []);
  });
});
