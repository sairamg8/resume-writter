// H3-452: a job or a school set with its dates in the left column and its title after them on the same
// line ("2019 - present ⇥ Audit Manager, Hargreaves & Co, Leeds", the layout of most UK CVs) had no company,
// role, school or degree: the whole title was read as the entry's location. A title after the date on a
// line with nothing over it is the entry's title.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const CV = `Oliver J. Whitfield
Audit Manager
o.whitfield@example.co.uk | 0113 496 0123

EMPLOYMENT HISTORY

2019 - present\tAudit Manager, Hargreaves & Co, Leeds
- Lead a team of 8 on audits of listed clients

2014 - 2019\tSenior Auditor, Pennine LLP, Manchester
- Planned and delivered 25 audits a year

EDUCATION
2011 - 2014\tBA (Hons) Accounting and Finance, University of Leeds
`;

test('a job with its title after its date has a role and a company, and no location', () => {
  const r = resumeFromText(CV);
  const jobs = r.sections.find((s) => s.type === 'experience').items;
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].role, 'Audit Manager');
  assert.match(jobs[0].company, /Hargreaves/);
  assert.equal(jobs[0].startDate, '2019');
  assert.equal(jobs[0].current, true);
  assert.ok(!/Audit Manager/.test(jobs[0].location), 'the title is not the location');
  assert.equal(jobs[1].role, 'Senior Auditor');
  assert.match(jobs[1].company, /Pennine/);
  assert.equal(jobs[1].endDate, '2019');
});

test('a school with its degree after its date has a degree and a school, and no location', () => {
  const r = resumeFromText(CV);
  const [school] = r.sections.find((s) => s.type === 'education').items;
  assert.match(school.degree, /BA \(Hons\)/);
  assert.match(school.institution, /University of Leeds/);
  assert.equal(school.location, '');
  assert.equal(school.endDate, '2014');
});

test('a place after the date, with the title over it, is still the location', () => {
  const r = resumeFromText(`Pat Doe
pat@example.com

EXPERIENCE
Acme Corp - Senior Engineer
Mar 2021 - Present | Portland, OR
* Built it
`);
  const [job] = r.sections.find((s) => s.type === 'experience').items;
  assert.equal(job.location, 'Portland, OR');
  assert.equal(job.company, 'Acme Corp');
});
