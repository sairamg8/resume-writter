// R2-047, R2-048, R2-049: what must travel together across a page break. A section is placed after a
// run of filler bullets and slid down the page 1.5 pt at a time, so its title and first entry cross
// the page foot at every offset:
//   - a section title never ends a page without the first line of its content (R2-047): 2-column
//     grids, References cards, the Sidebar's Experience and Projects cards, and a single column's
//     first entry, whose unbreakable header and the two lines it keeps are taller than the title's
//     own three-line keep;
//   - a 2-column grid keeps its reading order: a row's left entry never prints after its right one
//     (R2-048), the Timeline's too;
//   - a certification's date prints on the page of its name, an award's title is never left alone at
//     a page foot (R2-049) — nor, when the award is its section's first, the section's title.
// Each sweep ends where its section's title (or `needle`) is first pushed to page 2 — templates fill a
// page with different numbers of bullets — and fails if it never crosses the page foot.
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
const needleOf = (items, t, needle) => (needle ? items.find((i) => i.str.includes(needle)) : titleOf(items, t));

/** The fewest filler bullets that print `target()`'s title (or `needle`) on page 2. */
async function footOf(template, target, settings, needle) {
  const page = async (n) => {
    const t = target();
    return needleOf(allItems(await layout(template, settings, t, n, 0)), t, needle)?.page ?? 0;
  };
  let [lo, hi] = [1, 160];
  if (await page(hi) < 2) throw new Error(`${template}: "${needle || target().title}" never reaches page 2`);
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (await page(mid) > 1) hi = mid; else lo = mid;
  }
  return hi;
}

/**
 * Each layout of `target()` after n filler bullets and a gap of px, n over the six counts that end
 * where the title (or `needle`) is first pushed to page 2; `check` returns its problems.
 */
async function sweep(template, target, check, { settings = {}, needle } = {}) {
  const to = await footOf(template, target, settings, needle);
  const found = [];
  const pagesOf = new Set();
  for (let n = to - 5; n <= to; n += 1) {
    for (let px = 0; px <= 22; px += 2) {
      const t = target();
      const pages = await layout(template, settings, t, n, px);
      const items = allItems(pages);
      pagesOf.add(needleOf(items, t, needle)?.page);
      for (const p of check(items, pages.length, t)) found.push(`n=${n} px=${px}: ${p}`);
    }
  }
  if (!pagesOf.has(1) || !pagesOf.has(2)) found.push(`the sweep never crossed the page foot (pages ${[...pagesOf]})`);
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

// Centred (Section Options → Alignment), a certification prints its date on a line under its name.
const certifications = (settings = {}) => () => section('certifications', [
  { name: 'First Certificate', issuer: 'Org', date: '2020' },
  { name: 'AWS Certified Solutions Architect Professional with a very long certification name that wraps onto more lines', issuer: 'Amazon Web Services', credentialId: 'ABC-123', date: '2021' },
], settings, { title: 'Certifications' });

/** The certification's date on the page that prints the end of its name. */
function certDateWithName(items) {
  const date = items.find((i) => i.str.trim() === '2021');
  const name = items.filter((i) => /Architect|wraps onto|more lines|Amazon|ABC-123/.test(i.str));
  if (!date || !name.length) return ['certification not printed'];
  const pagesOfName = new Set(name.map((i) => i.page));
  return pagesOfName.size > 1 || !pagesOfName.has(date.page) ? [`name on page(s) ${[...pagesOfName]}, date on page ${date.page}`] : [];
}

const awards = () => section('awards', [
  { title: 'First Prize', issuer: 'Org', date: '2019' },
  { title: 'Best Engineer Award', issuer: 'Acme Corporation', date: '2020', description: '<p>For shipping things on time, every time.</p>' },
], {}, { title: 'Awards' });

// The award with a description first: its block and the two lines it keeps are taller than the
// section title's own three-line keep.
const awardsFirst = () => section('awards', [
  { title: 'Best Engineer Award', issuer: 'Acme Corporation', date: '2020', description: '<p>For shipping things on time, every time.</p><p>And again the next year.</p>' },
  { title: 'Second Prize', issuer: 'Org', date: '2019' },
], {}, { title: 'Awards' });

// One column: the first entry's header (two lines, unbreakable) and the two lines it keeps.
const experience1 = (settings = {}) => () => section('experience', [
  { company: 'Onecol Corp', role: 'Platform Engineer', location: 'Pune', startDate: '2019', endDate: '2021', description: '<ul><li>Built the platform</li><li>Ran it</li><li>Grew it</li></ul>' },
], settings, { title: 'Target Zone' });

const education1 = () => section('education', [
  { institution: 'Northfield University', degree: 'B.Sc.', fieldOfStudy: 'Computer Science', location: 'Pune', startDate: '2012', endDate: '2016', description: '<p>Thesis on distributed systems and more.</p><p>Second line.</p>' },
], {}, { title: 'Education' });

// Two rows: the second, its left entry's header the taller, at the page foot.
const experience4 = () => section('experience', [
  { company: 'Firstco', role: 'Engineer', startDate: '2021', endDate: '2023', description: '<ul><li>One</li><li>Two</li><li>Three</li><li>Four</li></ul>' },
  { company: 'Secondco', role: 'Engineer', startDate: '2020', endDate: '2021', description: '<ul><li>One</li><li>Two</li><li>Three</li><li>Four</li></ul>' },
  { company: 'Leftco', role: 'Senior Staff Principal Engineer of Platform Infrastructure Services', location: 'Pune', startDate: '2019', endDate: '2021', description: '<ul><li>Did a thing</li><li>Did another</li></ul>' },
  { company: 'Rightco', role: 'Dev', startDate: '2017', endDate: '2019', description: '<p>Short</p>' },
], { columns: 2 }, { title: 'Target Zone' });

// The Sidebar's main column prints Projects as cards, in a grid under Grids 2.
const projects2 = () => section('projects', [
  { name: 'Leftproj Platform', technologies: 'React, Node.js, PostgreSQL, Docker, Kubernetes, Terraform, AWS', url: 'https://example.com/left', startDate: '2020', description: '<ul><li>Built it</li><li>Ran it</li></ul>' },
  { name: 'Rightproj', technologies: 'Go', startDate: '2021', description: '<p>Short</p>' },
], { columns: 2 }, { title: 'Projects' });

/** The award's title never the last line of a page. */
function awardNotAlone(items, pageCount) {
  const title = items.find((i) => i.str.includes('Best Engineer Award'));
  if (!title) return ['award not printed'];
  const below = items.filter((i) => i.page === title.page && i.y < title.y - 1);
  return !below.length && title.page < pageCount ? [`the award's title ends page ${title.page}`] : [];
}

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
  it('sidebar: an Experience card, Title "Inline"', async () => {
    assert.deepEqual(await sweep('sidebar', experience1({ titleStyle: 'inline' }), titleNotAlone), []);
  });
  it('sidebar: a Projects card', async () => {
    assert.deepEqual(await sweep('sidebar', projects, titleNotAlone), []);
  });
  for (const template of ['classic', 'modern', 'executive', 'academic']) {
    it(`${template}: a one-column Experience entry`, async () => {
      assert.deepEqual(await sweep(template, experience1(), titleNotAlone), []);
    });
  }
  it('classic: a one-column Experience entry, centred', async () => {
    assert.deepEqual(await sweep('classic', experience1({ alignment: 'center' }), titleNotAlone), []);
  });
  it('classic: a one-column Education entry', async () => {
    assert.deepEqual(await sweep('classic', education1, titleNotAlone), []);
  });

  it('a 2-column section with no entry to print still prints its title, as one column does', async () => {
    const missing = [];
    for (const template of ['classic', 'modern', 'compact', 'sidebar', 'timeline']) {
      for (const type of ['experience', 'projects', 'awards', 'custom', 'skills']) {
        const s = section(type, [], { columns: 2 }, { title: `Zz${type}` });
        const pages = await read(await render(resume({ template, sections: [experience([{}]), s] })));
        if (!allItems(pages).some((t) => t.str.toUpperCase().includes(`ZZ${type.toUpperCase()}`))) missing.push(`${template} ${type}`);
      }
    }
    assert.deepEqual(missing, []);
  });
});

describe('a 2-column grid keeps its reading order across a page break (R2-048)', () => {
  for (const template of ['classic', 'sidebar', 'timeline']) {
    it(`${template}: Experience in two columns`, async () => {
      assert.deepEqual(await sweep(template, experience2, both(titleNotAlone, inOrder([['Leftco', 'Rightco']]))), []);
    });
    it(`${template}: Experience in two columns, its second row at the page foot`, async () => {
      assert.deepEqual(await sweep(template, experience4, inOrder([['Leftco', 'Rightco']]), { needle: 'Leftco' }), []);
    });
  }
  it('classic: Education in two columns', async () => {
    assert.deepEqual(await sweep('classic', education2, inOrder([['Northfield', 'Southgate']])), []);
  });
  // The Sidebar's two-column page prints Education in its dark column, an entry under another; its
  // Single · ATS-safe page prints it in a grid.
  it('sidebar: Education in two columns', async () => {
    assert.deepEqual(await sweep('sidebar', education2, inOrder([['Northfield', 'Southgate']]), { settings: { sidebarSingleColumn: true } }), []);
  });
  it('sidebar: Projects in two columns', async () => {
    assert.deepEqual(await sweep('sidebar', projects2, both(titleNotAlone, inOrder([['Leftproj', 'Rightproj']]))), []);
  });
});

describe('an entry keeps its date and its title with it (R2-049)', () => {
  for (const template of ['classic', 'executive']) {
    for (const alignment of ['left', 'center']) {
      it(`${template}: a certification's date stays with its name (${alignment})`, async () => {
        assert.deepEqual(await sweep(template, certifications({ alignment }), both(certDateWithName, titleNotAlone)), []);
      });
    }
    it(`${template}: an award's title is never alone at a page foot`, async () => {
      assert.deepEqual(await sweep(template, awards, both(awardNotAlone, titleNotAlone)), []);
    });
    it(`${template}: the section's title is never alone above its first award`, async () => {
      assert.deepEqual(await sweep(template, awardsFirst, titleNotAlone), []);
    });
  }
});
