// R5-HUNT8-SKILLS-STACKED-TAGS-CATEGORY-ORPHAN: in Skills styles Stacked, Tags (and Bars) a group prints
// its category over its skills, and nothing held the two together: where the category fitted at the
// foot of a page and the skills did not, the category ended the page alone and its skills started the
// next one — in the main column and in the Sidebar's side column. The category now keeps the first lines
// of its skills on its page. The sweep slides the section down the page (filler above it, then a gap of
// a few points) until every group has crossed the page foot, and fails where a page that is not the last
// ends its column with a category line. Word's Stacked category keeps with its skills (keepNext).
// Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, read, allItems, renderDocx } from './harness.mjs';

before(setup);
after(teardown);

/** The Sidebar's dark column: its share of the paper (PdfPage.jsx SIDE_COL); its main column starts past it. */
const SIDE_SHARE = 0.38;

const GROUPS = [
  { category: 'Frontend', skills: 'Svelte, Solid, Lit' },
  { category: 'Backend', skills: 'Elixir, Kotlin, Zig' },
  { category: 'Cloudops', skills: 'Nomad, Consul, Vault' },
  { category: 'Datastores', skills: 'Cassandra, Redis, Neo4j' },
  { category: 'Tooling', skills: 'Bazel, Nix, Earthly' },
];
const CATEGORIES = new Set(GROUPS.map((g) => g.category.toUpperCase()));
const LAST = GROUPS[GROUPS.length - 1].category;
/** A line of categories only: one, or a Grids row's side by side. */
const ONLY_CATEGORIES = new RegExp(`^(${[...CATEGORIES].join('|')})+$`);

const skills = (skillsStyle, columns = 1) => section('skills', GROUPS, { skillsStyle, columns }, { title: 'Toolbox' });

/**
 * The résumé with `n` filler lines and a gap of `px` above the Skills section: bullets of an Experience
 * entry in the main column, languages in the Sidebar's side column (the column Skills prints in there).
 */
function cv(template, skillsStyle, n, px, cols = 1) {
  if (template === 'sidebar') {
    const lead = section('languages', Array.from({ length: n }, (_, i) => ({ language: `Filler ${i + 1}`, proficiency: '' })), { spaceAfter: px });
    return resume({ template, sections: [lead, skills(skillsStyle, cols)] });
  }
  const lis = Array.from({ length: n }, (_, i) => `<li>Filler bullet ${i + 1}</li>`).join('');
  const lead = experience([{ description: `<ul>${lis}</ul>` }]);
  lead.settings = { ...lead.settings, spaceAfter: px };
  return resume({ template, sections: [lead, skills(skillsStyle, cols)] });
}

const layout = async (template, style, n, px, cols = 1) => read(await render(cv(template, style, n, px, cols)));

/** The items of the Skills column on each page (the side column's in the Sidebar, the page's elsewhere). */
const columnOf = (template, items, pages) => items.filter((i) => (template === 'sidebar'
  ? i.x < pages[i.page - 1].W * SIDE_SHARE
  : true));

/** A line's text, its runs in order, spaces out (a letter-spaced category may come as several runs). */
const lineText = (runs) => runs.sort((a, b) => a.x - b.x).map((r) => r.str).join('').replace(/\s+/g, '').toUpperCase();

/** The page of the line that reads `word` (letter-spacing aside), 0 when none does. */
function pageOf(template, pages, word) {
  const want = word.replace(/\s+/g, '').toUpperCase();
  const items = columnOf(template, allItems(pages), pages);
  const lines = new Map();
  for (const i of items) {
    const k = `${i.page}:${Math.round(i.y)}`;
    lines.set(k, [...(lines.get(k) || []), i]);
  }
  // In Grids a row's categories share a line: the word is one of them.
  const reads = (text) => text === want || (ONLY_CATEGORIES.test(text) && text.includes(want));
  for (const [k, runs] of lines) if (reads(lineText(runs))) return Number(k.split(':')[0]);
  return 0;
}

/** A page, not the last, whose column ends with a category line. */
function categoryAlone(template, pages) {
  const items = columnOf(template, allItems(pages), pages);
  const found = [];
  for (let p = 1; p < pages.length; p += 1) {
    const on = items.filter((i) => i.page === p);
    if (!on.length) continue;
    const lowest = Math.min(...on.map((i) => i.y));
    const text = lineText(on.filter((i) => Math.abs(i.y - lowest) < 1));
    if (ONLY_CATEGORIES.test(text)) found.push(`page ${p} ends with "${text}"`);
  }
  return found;
}

/** The fewest filler lines that print the last group's category on page 2. */
async function footOf(template, style, cols = 1) {
  const page = async (n) => pageOf(template, await layout(template, style, n, 0, cols), LAST);
  let [lo, hi] = [1, 200];
  if (await page(hi) < 2) throw new Error(`${template} ${style}: "${LAST}" never reaches page 2`);
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (await page(mid) > 1) hi = mid; else lo = mid;
  }
  return hi;
}

/** Every layout from the section's first line on page 1 to its last group's category on page 2. */
async function sweep(template, style, span, cols = 1) {
  const to = await footOf(template, style, cols);
  const found = [];
  const firstPages = new Set();
  for (let n = Math.max(1, to - span); n <= to; n += 1) {
    for (let px = 0; px <= 15; px += 3) {
      const pages = await layout(template, style, n, px, cols);
      firstPages.add(pageOf(template, pages, GROUPS[0].category));
      for (const p of categoryAlone(template, pages)) found.push(`n=${n} px=${px}: ${p}`);
    }
  }
  if (!firstPages.has(1)) found.push(`the sweep never started with the first group on page 1 (pages ${[...firstPages]})`);
  return found;
}

describe('A skill group\'s category never ends a page without its skills (R5-HUNT8-SKILLS-STACKED-TAGS-CATEGORY-ORPHAN)', () => {
  it('Classic, Stacked', async () => {
    assert.deepEqual(await sweep('classic', 'stacked', 18), []);
  });
  it('Classic, Tags', async () => {
    assert.deepEqual(await sweep('classic', 'tags', 18), []);
  });
  it('Classic, Bars', async () => {
    assert.deepEqual(await sweep('classic', 'bars', 26), []);
  });
  it('Sidebar\'s side column, Stacked', async () => {
    assert.deepEqual(await sweep('sidebar', 'stacked', 26), []);
  });
  it('Sidebar\'s side column, Tags', async () => {
    assert.deepEqual(await sweep('sidebar', 'tags', 16), []);
  });
  it('Sidebar\'s side column, Bars', async () => {
    assert.deepEqual(await sweep('sidebar', 'bars', 30), []);
  });
  it('Classic, Stacked in two Grids', async () => {
    assert.deepEqual(await sweep('classic', 'stacked', 26, 2), []);
  });

  it('Word, Stacked: the category paragraph keeps with its skills', async () => {
    const { xml } = await renderDocx(resume({ template: 'classic', sections: [skills('stacked')] }));
    const para = [...xml.matchAll(/<w:p>(.*?)<\/w:p>/gs)].map((m) => m[1]).find((p) => p.includes('>Frontend<'));
    assert.ok(para, 'the category paragraph');
    assert.match(para, /<w:keepNext\/>/);
  });
});
