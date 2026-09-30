// R5-HUNT12-STACKED-PLACE-LINE-LOSES-COMPANY: a job printed as its company, its role and its place a line
// each over its dates (in any order) got the place as its company, and its real company went into the job
// above's description. In Markdown ("### Google" over the role over the place over the dates) the job
// split into a company-only entry and an untitled one; a school did the same with its degree and place.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText, markdownLines } from '../../src/utils/importText.js';

const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];
const jobs = (r) => items(r, 'experience').map((j) => [j.company, j.role, j.location, j.startDate, j.endDate]);
const both = [['Google', 'Software Engineer', 'Mountain View, CA', '2017', '2021'], ['Meta', 'Product Designer', 'Menlo Park, CA', '2015', '2017']];

test('plain text: Company, Role, City and Dates stacked — each job keeps its company, the city its location', () => {
  const r = resumeFromText('John Smith\njohn@example.com\n\nEXPERIENCE\nGoogle\nSoftware Engineer\nMountain View, CA\n2017 – 2021\n- Search infra\n\nMeta\nProduct Designer\nMenlo Park, CA\n2015 – 2017\n- Designed feed\n');
  assert.deepEqual(jobs(r), both);
  assert.equal(items(r, 'experience')[0].description, '<ul><li>Search infra</li></ul>');
});

test('plain text: the other orders (Company / City / Role, Role / Company / City) too', () => {
  const r = resumeFromText('John Smith\njohn@example.com\n\nEXPERIENCE\nGoogle\nMountain View, CA\nSoftware Engineer\n2017 – 2021\n- Search infra\n\nProduct Designer\nMeta\nMenlo Park, CA\n2015 – 2017\n- Designed feed\n');
  assert.deepEqual(jobs(r), both);
  assert.equal(items(r, 'experience')[0].description, '<ul><li>Search infra</li></ul>');
});

test('Markdown: "### Company" over the role over the place over the dates is one job; a school over its degree and place one school', () => {
  const r = resumeFromText(markdownLines('# John Smith\njohn@example.com\n\n## Experience\n\n### Google\nSoftware Engineer\nMountain View, CA\n2017 – 2021\n- Search infra\n\n### Meta\nMenlo Park, CA\nProduct Designer\n*2015 – 2017*\n- Designed feed\n\n## Education\n\n### Stanford University\nB.S. Mathematics\nStanford, CA\n2011 – 2015\n'));
  assert.deepEqual(jobs(r), both);
  assert.deepEqual(items(r, 'education').map((e) => [e.institution, e.degree, e.location, e.startDate, e.endDate]), [['Stanford University', 'B.S. Mathematics', 'Stanford, CA', '2011', '2015']]);
});
