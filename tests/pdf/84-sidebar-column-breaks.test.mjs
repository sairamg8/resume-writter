// R2-104: the Sidebar's dark column at a page break. Its section titles had no keep, so a title was
// left at the foot of a page with its entries on the next ("EDUCATION" ending page 1 under 18 skill
// groups and Languages), and an education, certification or reference entry split across two pages.
// The column is filled with skill groups and language rows, one more at a time, so each title and
// entry crosses the page foot.
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
