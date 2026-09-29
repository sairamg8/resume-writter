// R5-HUNT4-PDF-SKILLS-TITLE-ORPHAN-LONG-INLINE-GROUP: the Skills section title passed no presence, so it
// kept only its own three body lines. In Inline and Bullet styles each group is one unbreakable row, and
// a first group whose skills wrapped onto four lines or more was taller: the title stayed alone at the
// foot of a page while the group moved to the next. The title now keeps the first group measured at the
// entry's width (entryTextWidth, less a Bullet's marker). The sweep slides the section down the page as
// r5hunt3-certifications-title-keep.test.mjs does (its helpers, copied). Fictional data only.
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

// About 420 characters of skills: five lines of the page's text or more.
const SKILLS = [
  'Rust', 'Go', 'TypeScript', 'Kotlin', 'Elixir', 'Haskell', 'OCaml', 'Zig', 'Distributed tracing', 'Event sourcing',
  'Tide gauge telemetry', 'Coastal sensor networks', 'Kubernetes operators', 'PostgreSQL logical replication',
  'Message queues', 'Stream processing', 'Terraform modules', 'Observability pipelines', 'Chaos engineering',
  'Capacity planning', 'Incident command', 'Accessibility audits', 'Load testing', 'Feature flags',
  'Canary releases', 'Schema migrations', 'Data retention policies', 'Offline-first sync',
].join(', ');

const skills = (settings = {}) => () => section('skills', [
  { category: 'Technical', skills: SKILLS },
  { category: 'Other', skills: 'Knot tying' },
], settings, { title: 'Target Zone' });

describe('A Skills title moves with a first Inline or Bullet group that wraps (R5-HUNT4-PDF-SKILLS-TITLE-ORPHAN-LONG-INLINE-GROUP)', () => {
  it('the case wraps as it says', async () => {
    const t = skills({ skillsStyle: 'inline' })();
    assert.ok(await linesOf('classic', t, SKILLS.split(', ')) >= 4, 'the first group on four lines');
  });
  it('Classic, Inline: the title never ends a page alone', async () => {
    assert.deepEqual(await sweep('classic', skills({ skillsStyle: 'inline' })), []);
  });
  it('Classic, Bullet: the title never ends a page alone', async () => {
    assert.deepEqual(await sweep('classic', skills({ skillsStyle: 'bullet' })), []);
  });
  it('Modern, Inline, Center: the title never ends a page alone', async () => {
    assert.deepEqual(await sweep('modern', skills({ skillsStyle: 'inline', alignment: 'center' })), []);
  });
});
