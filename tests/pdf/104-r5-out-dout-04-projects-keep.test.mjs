// R4-DOUT-04 (review of 5bac05e): the Sidebar's project card measures the lines its header takes
// (projectCardLines), but the shared ProjectsSection every other template prints — Classic, Minimal,
// the designed layouts, the Sidebar's "Single · ATS-safe" page — still counted its first project's
// header as two lines, the name and the joined "technologies · link" line, without measuring either.
// A name that wraps over technologies and a link that wrap onto three or four lines took more than
// that and its spare line: the section title stayed alone at the foot of a page while the project
// moved to the next. Each line is now wrapped at the entry's width (entryTextWidth, a Grids cell's).
// The sweep slides the section down the page as 104-r5-out-dout-04-sidebar-project-keep.test.mjs
// does (its helpers, copied). Fictional data only.
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

const bullets = '<ul><li>Built the stations</li><li>Ran the feed</li><li>Grew the network</li></ul>';
// About 110 bold characters: two lines of the page's text, on A4 or US Letter.
const NAME = 'Tidepool Community Weather Station Network, Open Data Dashboard and Volunteer Sensor Maintenance Programme';
// With the link, about 300 characters: three lines of the page's text or more.
const TECH = 'Reactx, TypeScript, Node.js, PostgreSQL, Redis, GraphQL, Terraform, Kubernetes, Docker, Grafana, Prometheus, OpenTelemetry, Apache Kafka, Elasticsearch, RabbitMQ, Ansible, Jenkins, Vault, Consul, Nginx, MinIO, ClickHouse';
const URL = 'github.example/tidepool-collective/community-weather-station-network';

const project = (settings = {}) => () => section('projects', [
  { name: NAME, technologies: TECH, url: URL, startDate: '2021', endDate: '2023', description: bullets },
], settings, { title: 'Target Zone' });

describe('A Projects title moves with a first project whose name and technologies line wrap (R4-DOUT-04)', () => {
  it('the case wraps as it says', async () => {
    const t = project()();
    assert.ok(await linesOf('classic', t, ['Tidepool', 'Dashboard', 'Volunteer', 'Programme']) >= 2, 'the name on two lines');
    assert.ok(await linesOf('classic', t, ['Reactx', 'Kubernetes', 'Elasticsearch', 'ClickHouse', 'tidepool-collective', 'station-network']) >= 3, 'the technologies and link on three lines or more');
  });
  it('Classic, Left: the title never ends a page alone', async () => {
    assert.deepEqual(await sweep('classic', project()), []);
  });
  it('Classic, Center: the title never ends a page alone', async () => {
    assert.deepEqual(await sweep('classic', project({ alignment: 'center' })), []);
  });
  it('Minimal, Grids 2: the title never ends a page alone', async () => {
    assert.deepEqual(await sweep('minimal', project({ columns: 2 })), []);
  });
});
