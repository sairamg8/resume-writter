// R4-DOUT-04 (review): the Sidebar page's project card prints its technologies and link on one line
// under its name (104-r5-out-dout-04-sidebar-project-tech-line.test.mjs). The section title's keep
// (SidebarMainProjects' presence, cardPresence) counted that line as one line, and the name as one,
// without measuring either: long technologies with a link wrap onto three or four lines of the main
// column, a long name onto two, and the title stayed alone at the foot of a page while the card moved
// to the next. Each line is now wrapped at the card's text width (projectCardLines). The sweep slides
// the section down the page as 104-r5-out-dout-07-timeline-wrap-keep.test.mjs does (its helpers,
// copied). Fictional data only.
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, read, allItems } from './harness.mjs';

before(setup);
after(teardown);

/** The dark column's share of the paper (PdfSidebarColumn.jsx SIDE_COL): the main column's text starts past it. */
const SIDE_SHARE = 0.38;

const layout = async (target, n, px) => {
  const lis = Array.from({ length: n }, (_, i) => `<li>Filler bullet ${i + 1}</li>`).join('');
  const lead = experience([{ description: `<ul>${lis}</ul>` }]);
  lead.settings = { ...lead.settings, spaceAfter: px };
  return read(await render(resume({ template: 'sidebar', sections: [lead, target] })));
};

const titleOf = (items, t) => items.find((i) => i.str.trim().toUpperCase() === t.title.toUpperCase());

/** The fewest filler bullets that print `target()`'s title on page 2. */
async function footOf(target) {
  const page = async (n) => {
    const t = target();
    return titleOf(allItems(await layout(t, n, 0)), t)?.page ?? 0;
  };
  let [lo, hi] = [1, 160];
  if (await page(hi) < 2) throw new Error(`"${target().title}" never reaches page 2`);
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (await page(mid) > 1) hi = mid; else lo = mid;
  }
  return hi;
}

/** Each layout of `target()` over the six filler counts that end where its title is first pushed to page 2. */
async function sweep(target) {
  const to = await footOf(target);
  const found = [];
  const pagesOf = new Set();
  for (let n = to - 5; n <= to; n += 1) {
    for (let px = 0; px <= 22; px += 2) {
      const t = target();
      const pages = await layout(t, n, px);
      const items = allItems(pages);
      pagesOf.add(titleOf(items, t)?.page);
      for (const p of titleNotAlone(items, pages, t)) found.push(`n=${n} px=${px}: ${p}`);
    }
  }
  if (!pagesOf.has(1) || !pagesOf.has(2)) found.push(`the sweep never crossed the page foot (pages ${[...pagesOf]})`);
  return found;
}

/** The section title never the last line of the main column on a page that is not the last. */
function titleNotAlone(items, pages, t) {
  const title = titleOf(items, t);
  if (!title) return [`"${t.title}" not printed`];
  const mainLeft = pages[title.page - 1].W * SIDE_SHARE;
  const below = items.filter((i) => i.page === title.page && i.x > mainLeft && i.y < title.y - 1);
  return !below.length && title.page < pages.length ? [`"${t.title}" ends page ${title.page}`] : [];
}

/** The lines (distinct baselines) `words` print on: a check that the card wraps as the case needs. */
async function linesOf(t, words) {
  const items = allItems(await read(await render(resume({ template: 'sidebar', sections: [t] }))));
  return new Set(items.filter((i) => words.some((w) => i.str.includes(w))).map((i) => Math.round(i.y))).size;
}

const bullets = '<ul><li>Built the stations</li><li>Ran the feed</li><li>Grew the network</li></ul>';
// About 66 bold characters: two lines of the card, on A4 or US Letter.
const NAME = 'Tidepool Community Weather Station Network and Open Data Dashboard';
// With the link, about 210 characters: three or four lines of the card.
const TECH = 'Reactx, TypeScript, Node.js, PostgreSQL, Redis, GraphQL, Terraform, Kubernetes, Docker, Grafana, Prometheus, OpenTelemetry, Apache Kafka';
const URL = 'github.example/tidepool-collective/community-weather-station-network';

const project = (settings = {}) => () => section('projects', [
  { name: NAME, technologies: TECH, url: URL, startDate: '2021', endDate: '2023', description: bullets },
], settings, { title: 'Target Zone' });

describe('Sidebar: a Projects title moves with a first card whose name and technologies line wrap (R4-DOUT-04)', () => {
  it('the case wraps as it says', async () => {
    const t = project()();
    assert.ok(await linesOf(t, ['Tidepool', 'Weather', 'Network', 'Dashboard']) >= 2, 'the name on two lines');
    assert.ok(await linesOf(t, ['Reactx', 'Kubernetes', 'Prometheus', 'Kafka', 'tidepool-collective', 'station-network']) >= 3, 'the technologies and link on three lines or more');
  });
  it('Left: the title never ends a page alone', async () => {
    assert.deepEqual(await sweep(project()), []);
  });
  it('Center: the title never ends a page alone', async () => {
    assert.deepEqual(await sweep(project({ alignment: 'center' })), []);
  });
});
