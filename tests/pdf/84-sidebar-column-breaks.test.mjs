// R2-104: the Sidebar's dark column at a page break. Its section titles had no keep, so a title was
// left at the foot of a page with its entries on the next ("EDUCATION" ending page 1 under 18 skill
// groups and Languages), and an education, certification or reference entry split across two pages.
// The column is filled with skill groups and language rows, one more at a time, so each title and
// entry crosses the page foot. References come last there and never reach the foot: a second test
// slides them alone across it, with a first reference whose fields wrap in the column too.
import { before, after, it } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resume, section, experience, render, read, allItems } from './harness.mjs';

before(setup);
after(teardown);

const skills = (n) => section('skills', Array.from({ length: n }, (_, i) => ({ category: `Cat${i + 1}`, skills: 'React, Node.js, TypeScript, PostgreSQL, Docker' })));
const languages = (n) => section('languages', ['English', 'German', 'French', 'Hindi', 'Telugu'].slice(0, n).map((language) => ({ language, proficiency: 'Fluent' })));
const education = () => section('education', [
  { degree: 'Bachelor of Technology', institution: 'Northfield University', fieldOfStudy: 'Computer Science', location: 'Pune', gpa: '8.5', startDate: '2012', endDate: '2016' },
  { degree: 'Master of Science', institution: 'Southgate College', fieldOfStudy: 'Data Systems', location: 'Delhi', startDate: '2016', endDate: '2018' },
], {}, { title: 'Education' });
const certifications = () => section('certifications', [
  { name: 'Cloud Architect', issuer: 'Cloudorg', date: '2021', credentialId: 'CA-1' },
  { name: 'Data Engineer', issuer: 'Dataorg', date: '2022', credentialId: 'DE-2' },
], {}, { title: 'Certifications' });
const references = () => section('references', [
  { name: 'Alex Doe', jobTitle: 'Manager', company: 'Acme', email: 'alex@example.com', phone: '+1 555 0100' },
  { name: 'Sam Roe', jobTitle: 'Director', company: 'Globex', email: 'sam@example.com', phone: '+1 555 0101' },
], {}, { title: 'References' });

/** Each entry's first and last line: one page. */
const ENTRIES = [
  ['Bachelor of Technology', '2012'], ['Master of Science', '2016 – 2018'],
  ['Cloud Architect', 'CA-1'], ['Data Engineer', 'DE-2'],
  ['Alex Doe', '555 0100'], ['Sam Roe', '555 0101'],
];
const TITLES = ['EDUCATION', 'CERTIFICATIONS', 'REFERENCES', 'LANGUAGES'];

it('a dark-column title never ends a page, and an entry never splits across two', async () => {
  const found = [];
  for (let groups = 14; groups <= 22; groups += 1) {
    for (let langs = 1; langs <= 5; langs += 1) {
      const r = resume({ template: 'sidebar', sections: [experience([{ description: '<p>Main column</p>' }]), skills(groups), languages(langs), education(), certifications(), references()] });
      const pages = await read(await render(r));
      const side = allItems(pages).filter((t) => t.x < pages[0].W * 0.38);
      const tag = `groups=${groups} langs=${langs}`;
      for (const title of TITLES) {
        const t = side.find((i) => i.str.trim() === title);
        if (!t) { found.push(`${tag}: ${title} not printed`); continue; }
        if (t.page < pages.length && !side.some((i) => i.page === t.page && i.y < t.y - 1)) found.push(`${tag}: ${title} ends page ${t.page}`);
      }
      for (const [head, tail] of ENTRIES) {
        const a = side.find((i) => i.str.includes(head));
        const b = side.find((i) => i.str.includes(tail) && (!a || i.page > a.page || i.y <= a.y));
        if (!a || !b) found.push(`${tag}: "${head}" entry not printed`);
        else if (a.page !== b.page) found.push(`${tag}: "${head}" on page ${a.page}, its "${tail}" on page ${b.page}`);
      }
    }
  }
  assert.deepEqual(found, []);
});

// A first reference whose name, job title and company wrap in the column.
const longReferences = () => section('references', [
  { name: 'Alexandra Catherine Doe-Montgomery', jobTitle: 'Senior Vice President of Engineering Operations', company: 'Acme International Holdings Group', relationship: 'Former manager for four years', email: 'alex@example.com', phone: '+1 555 0100' },
  { name: 'Sam Roe', jobTitle: 'Director', company: 'Globex', email: 'sam@example.com', phone: '+1 555 0101' },
], {}, { title: 'References' });

/** References alone under `groups` skill groups and a gap of `px` after them. */
async function referencesAfter(refs, groups, px) {
  const s = skills(groups);
  s.settings = { ...s.settings, spaceAfter: px };
  const pages = await read(await render(resume({ template: 'sidebar', sections: [experience([{ description: '<p>Main column</p>' }]), s, refs()] })));
  return { pages, side: allItems(pages).filter((t) => t.x < pages[0].W * 0.38) };
}

it('the References title keeps its first reference, however its fields wrap, and a reference never splits', async () => {
  const found = [];
  const cases = [[references, [['Alex Doe', '555 0100'], ['Sam Roe', '555 0101']]], [longReferences, [['Alexandra', '555 0100'], ['Sam Roe', '555 0101']]]];
  for (const [refs, entries] of cases) {
    // The fewest skill groups that push REFERENCES to page 2: the sweep ends there.
    const page = async (g) => (await referencesAfter(refs, g, 0)).side.find((i) => i.str.trim() === 'REFERENCES')?.page;
    let [lo, hi] = [1, 60];
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (await page(mid) > 1) hi = mid; else lo = mid; }
    const seen = new Set();
    for (let groups = hi - 6; groups <= hi; groups += 1) {
      for (let px = 0; px <= 22; px += 2) {
        const { pages, side } = await referencesAfter(refs, groups, px);
        const tag = `${refs().items[0].name} groups=${groups} px=${px}`;
        const t = side.find((i) => i.str.trim() === 'REFERENCES');
        if (!t) { found.push(`${tag}: REFERENCES not printed`); continue; }
        seen.add(t.page);
        if (t.page < pages.length && !side.some((i) => i.page === t.page && i.y < t.y - 1)) found.push(`${tag}: REFERENCES ends page ${t.page}`);
        for (const [head, tail] of entries) {
          const a = side.find((i) => i.str.includes(head));
          const b = side.find((i) => i.str.includes(tail) && (!a || i.page > a.page || i.y <= a.y));
          if (!a || !b) found.push(`${tag}: "${head}" entry not printed`);
          else if (a.page !== b.page) found.push(`${tag}: "${head}" on page ${a.page}, its "${tail}" on page ${b.page}`);
        }
      }
    }
    if (!seen.has(1) || !seen.has(2)) found.push(`${refs().items[0].name}: the sweep never crossed the page foot`);
  }
  assert.deepEqual(found, []);
});

// RES-R2-104, left for later above: an education's head is unbreakable, but nothing kept its
// coursework with it, so the head was left at the foot of a page and all of its text went to the
// next. Now the head keeps two lines of that text under it, as the main column's entry header keeps
// two lines of body text, and the EDUCATION title keeps them too. Slid across the page foot as the
// references are above, one paragraph that wraps over several lines in the column.
const coursework = () => section('education', [
  {
    degree: 'Bachelor of Technology', institution: 'Northfield University', fieldOfStudy: 'Computer Science', startDate: '2012', endDate: '2016',
    description: '<p>Coursework in distributed systems, databases, compilers, operating systems, computer networks, machine learning, statistics and algorithms.</p>',
  },
], {}, { title: 'Education' });

/** Education alone under `groups` skill groups and a gap of `px` after them. */
async function educationAfter(groups, px) {
  const s = skills(groups);
  s.settings = { ...s.settings, spaceAfter: px };
  const pages = await read(await render(resume({ template: 'sidebar', sections: [experience([{ description: '<p>Main column</p>' }]), s, coursework()] })));
  return { pages, side: allItems(pages).filter((t) => t.x < pages[0].W * 0.38) };
}

it('an education\'s head keeps the first lines of its coursework on its page, and its title keeps both (RES-R2-104)', async () => {
  const found = [];
  // The fewest skill groups that push EDUCATION to page 2: the sweep ends there.
  const page = async (g) => (await educationAfter(g, 0)).side.find((i) => i.str.trim() === 'EDUCATION')?.page;
  let [lo, hi] = [1, 60];
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (await page(mid) > 1) hi = mid; else lo = mid; }
  const seen = new Set();
  for (let groups = hi - 6; groups <= hi; groups += 1) {
    for (let px = 0; px <= 22; px += 2) {
      const { pages, side } = await educationAfter(groups, px);
      const tag = `groups=${groups} px=${px}`;
      const t = side.find((i) => i.str.trim() === 'EDUCATION');
      const head = side.find((i) => i.str.includes('Bachelor of Technology'));
      const dates = head && side.find((i) => i.str.includes('2012') && (i.page > head.page || i.y <= head.y));
      const text = side.find((i) => i.str.includes('Coursework'));
      if (!t || !head || !dates || !text) { found.push(`${tag}: the education is not all printed`); continue; }
      seen.add(head.page);
      if (t.page < pages.length && !side.some((i) => i.page === t.page && i.y < t.y - 1)) found.push(`${tag}: EDUCATION ends page ${t.page}`);
      if (head.page !== dates.page) found.push(`${tag}: the head splits across pages ${head.page} and ${dates.page}`);
      if (text.page !== dates.page) found.push(`${tag}: the head ends page ${dates.page}, its coursework starts page ${text.page}`);
    }
  }
  if (!seen.has(1) || !seen.has(2)) found.push('the sweep never crossed the page foot');
  assert.deepEqual(found, []);
});
