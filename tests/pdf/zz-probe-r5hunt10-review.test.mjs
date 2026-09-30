// Review probe (not for merge): the R5-HUNT10 title keep beyond the committed sweep's cases.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, read, allItems } from './harness.mjs';

before(setup);
after(teardown);

const SIDE_SHARE = 0.38;
const TITLE = 'Toolbox';
const LONG = ['React', 'TypeScript', 'CSS', 'Testing', 'Svelte', 'Solid', 'Lit', 'Vite', 'Webpack', 'Rollup', 'Storybook',
  'Playwright', 'Cypress', 'Vitest', 'Redux', 'Zustand', 'GraphQL', 'Apollo', 'Tailwind', 'Sass', 'Figma', 'Astro'].join(', ');

function skills(style, first, opts = {}) {
  return section('skills', [
    first,
    { category: 'Backend', skills: LONG },
    { category: 'Data', skills: LONG },
  ], { skillsStyle: style, ...(opts.sectionSettings || {}) }, { title: TITLE });
}

function cv(c, n, px) {
  const sk = skills(c.style, c.first, c);
  if (c.template === 'sidebar') {
    const lead = section('languages', Array.from({ length: n }, (_, i) => ({ language: `Filler ${i + 1}`, proficiency: '' })), { spaceAfter: px });
    return resume({ template: 'sidebar', settings: c.settings || {}, sections: [lead, sk] });
  }
  const lis = Array.from({ length: n }, (_, i) => `<li>Filler bullet ${i + 1}</li>`).join('');
  const lead = experience([{ description: `<ul>${lis}</ul>` }]);
  lead.settings = { ...lead.settings, spaceAfter: px };
  return resume({ template: c.template, settings: c.settings || {}, sections: [lead, sk] });
}

const layout = async (c, n, px) => read(await render(cv(c, n, px)));
const columnOf = (c, pages) => allItems(pages).filter((i) => (c.template === 'sidebar' ? i.x < pages[i.page - 1].W * SIDE_SHARE : true));
function linesOf(c, pages) {
  const lines = new Map();
  for (const i of columnOf(c, pages)) {
    const k = `${i.page}:${Math.round(i.y)}`;
    lines.set(k, [...(lines.get(k) || []), i]);
  }
  return [...lines.values()].map((runs) => ({
    page: runs[0].page,
    y: Math.min(...runs.map((r) => r.y)),
    text: runs.sort((a, b) => a.x - b.x).map((r) => r.str).join('').replace(/\s+/g, '').toUpperCase(),
  }));
}
const titleLine = (lines) => lines.find((l) => l.text.endsWith(TITLE.toUpperCase()) && l.text.length <= TITLE.length + 2);

async function footOf(c) {
  const page = async (n) => titleLine(linesOf(c, await layout(c, n, 0)))?.page ?? 0;
  let [lo, hi] = [1, 200];
  if (await page(hi) < 2) throw new Error('never reaches page 2');
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (await page(mid) > 1) hi = mid; else lo = mid;
  }
  return hi;
}

async function sweep(c, span = 4) {
  const to = await footOf(c);
  const found = [];
  const titlePages = new Set();
  for (let n = Math.max(1, to - span); n <= to; n += 1) {
    for (let px = 0; px <= 20; px += 2) {
      const pages = await layout(c, n, px);
      const lines = linesOf(c, pages);
      const title = titleLine(lines);
      if (!title) { found.push(`n=${n} px=${px}: not printed`); continue; }
      titlePages.add(title.page);
      const below = lines.filter((l) => l.page === title.page && l.y < title.y - 1);
      if (!below.length && title.page < pages.length) found.push(`n=${n} px=${px}: ends page ${title.page}`);
    }
  }
  if (!titlePages.has(1) || !titlePages.has(2)) found.push(`never crossed (${[...titlePages]})`);
  return found;
}

const SHORT = {
  bars: { category: 'Frontend', skills: 'React' },
  stacked: { category: 'Frontend', skills: 'React, CSS' },
  tags: { category: 'Frontend', skills: 'React, CSS' },
};
const LONGCAT = { category: 'Frontend engineering and design systems and accessibility tooling', skills: LONG };
const cases = [];
for (const style of ['bars', 'stacked', 'tags']) {
  cases.push({ name: `classic short ${style}`, template: 'classic', style, first: SHORT[style] });
  cases.push({ name: `sidebar short ${style}`, template: 'sidebar', style, first: SHORT[style] });
  cases.push({ name: `classic long category ${style}`, template: 'classic', style, first: LONGCAT });
  cases.push({ name: `sidebar long category ${style}`, template: 'sidebar', style, first: LONGCAT });
  cases.push({ name: `classic grid ${style}`, template: 'classic', style, first: { category: 'Frontend', skills: LONG }, sectionSettings: { columns: 2 } });
  cases.push({ name: `classic compact ${style}`, template: 'classic', style, first: { category: 'Frontend', skills: LONG }, settings: { fontSizeBase: 9, lineHeightValue: 1.15 } });
  for (const template of ['modern', 'minimal', 'executive', 'banner', 'academic', 'compact', 'timeline']) {
    cases.push({ name: `${template} ${style}`, template, style, first: { category: 'Frontend', skills: LONG } });
  }
}

describe('review probe', () => {
  for (const c of cases) {
    it(c.name, async () => { assert.deepEqual(await sweep(c), []); });
  }
});
