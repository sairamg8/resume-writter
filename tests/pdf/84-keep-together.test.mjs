// R2-047, R2-048: what must travel together across a page break. A section is placed after a
// run of filler bullets and slid down the page 1.5 pt at a time, so its title and first entry cross
// the page foot at every offset:
//   - a section title never ends a page without the first line of its content (R2-047): 2-column
//     grids, References cards, the Sidebar's Experience and Projects cards;
//   - a 2-column grid keeps its reading order: a row's left entry never prints after its right one
//     (R2-048).
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, read, allItems } from './harness.mjs';

before(setup);
after(teardown);

/** Each layout of `target()` after `n` filler bullets and a gap of `px`, over the sweep; `check` returns its problems. */
async function sweep(template, target, check, { from = 27, to = 32, settings = {} } = {}) {
  const found = [];
  for (let n = from; n <= to; n += 1) {
    for (let px = 0; px <= 22; px += 2) {
      const lis = Array.from({ length: n }, (_, i) => `<li>Filler bullet ${i + 1}</li>`).join('');
      const lead = experience([{ description: `<ul>${lis}</ul>` }]);
      lead.settings = { ...lead.settings, spaceAfter: px };
      const t = target();
      const pages = await read(await render(resume({ template, settings, sections: [lead, t] })));
      for (const p of check(allItems(pages), pages.length, t)) found.push(`n=${n} px=${px}: ${p}`);
    }
  }
  return found;
}

/** The section title never the last line of a page that is not the last. */
function titleNotAlone(items, pageCount, t) {
  const title = items.find((i) => i.str.trim().toUpperCase() === t.title.toUpperCase());
  if (!title) return [`"${t.title}" not printed`];
  const below = items.filter((i) => i.page === title.page && i.y < title.y - 1);
  return !below.length && title.page < pageCount ? [`"${t.title}" ends page ${title.page}`] : [];
}

/** Every `[left, right]` pair of a grid row: the left one on the right one's page or before it. */
const inOrder = (pairs) => (items) => pairs.flatMap(([l, r]) => {
  const a = items.find((i) => i.str.includes(l));
  const b = items.find((i) => i.str.includes(r));
  if (!a || !b) return [`"${l}" or "${r}" not printed`];
  return a.page > b.page ? [`"${r}" on page ${b.page}, "${l}" after it on page ${a.page}`] : [];
});

const both = (...checks) => (...args) => checks.flatMap((c) => c(...args));

const education2 = () => section('education', [
  { institution: 'Northfield University of Technology and Applied Sciences', degree: 'B.Sc.', fieldOfStudy: 'Computer Science', startDate: '2012', endDate: '2016', description: '<p>Thesis on distributed systems.</p>' },
  { institution: 'Southgate College', degree: 'M.Sc.', startDate: '2016', endDate: '2018' },
], { columns: 2 }, { title: 'Education' });

const experience2 = () => section('experience', [
  { company: 'Leftco', role: 'Senior Staff Principal Engineer of Platform Infrastructure Services', startDate: '2019', endDate: '2021', description: '<ul><li>Did a thing</li><li>Did another</li></ul>' },
  { company: 'Rightco', role: 'Dev', startDate: '2017', endDate: '2019', description: '<p>Short</p>' },
], { columns: 2 }, { title: 'Target Zone' });

const references = () => section('references', [
  { name: 'Alex Doe', jobTitle: 'Manager', company: 'Acme', email: 'alex@example.com', phone: '+1 555 0100' },
  { name: 'Sam Roe', jobTitle: 'Director', company: 'Globex', email: 'sam@example.com', phone: '+1 555 0101' },
], { columns: 2 }, { title: 'References' });

const cards = () => section('experience', [
  { company: 'Cardco', role: 'Platform Engineer', location: 'Pune', startDate: '2019', endDate: '2021', description: '<ul><li>Built the platform</li><li>Ran it</li></ul>' },
], {}, { title: 'Target Zone' });

const projects = () => section('projects', [
  { name: 'Project Alpha', technologies: 'React, Node.js', url: 'https://example.com/alpha', startDate: '2020', description: '<p>Built it.</p>' },
], {}, { title: 'Projects' });

describe('a section title keeps the first line of its content (R2-047)', () => {
  for (const template of ['classic', 'modern', 'compact']) {
    it(`${template}: a 2-column Education grid`, async () => {
      assert.deepEqual(await sweep(template, education2, titleNotAlone), []);
    });
  }
  it('classic: References cards in two columns', async () => {
    assert.deepEqual(await sweep('classic', references, titleNotAlone), []);
  });
  it('sidebar: an Experience card', async () => {
    assert.deepEqual(await sweep('sidebar', cards, titleNotAlone), []);
  });
  it('sidebar: a Projects card', async () => {
    assert.deepEqual(await sweep('sidebar', projects, titleNotAlone), []);
  });
});

describe('a 2-column grid keeps its reading order across a page break (R2-048)', () => {
  for (const template of ['classic', 'sidebar']) {
    it(`${template}: Experience in two columns`, async () => {
      assert.deepEqual(await sweep(template, experience2, both(titleNotAlone, inOrder([['Leftco', 'Rightco']]))), []);
    });
    it(`${template}: Education in two columns`, async () => {
      assert.deepEqual(await sweep(template, education2, inOrder([['Northfield', 'Southgate']])), []);
    });
  }
});
