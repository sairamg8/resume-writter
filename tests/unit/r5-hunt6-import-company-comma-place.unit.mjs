// R5-HUNT6-COMPANY-COMMA-PLACE: a company line written "Company, City, ST" ("Google, Mountain View, CA")
// kept the city in the company name and left Location empty; only the dash form ("Google — Mountain
// View, CA") gave the location. The city and its state or country after the company's comma are now
// the job's location, beside a role, and over grouped roles too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const jobs = (...lines) => resumeFromText(['Jane Doe', '', 'EXPERIENCE', ...lines].join('\n'))
  .sections.find((s) => s.type === 'experience').items.map((j) => [j.company, j.role, j.location, j.startDate, j.endDate]);

test('the company\'s ", City, ST" is the location', () => {
  assert.deepEqual(jobs('Software Engineer', 'Google, Mountain View, CA', 'Jan 2015 – May 2019', '• Built things'),
    [['Google', 'Software Engineer', 'Mountain View, CA', 'Jan 2015', 'May 2019']]);
  assert.deepEqual(jobs('Globex Inc., Denver, CO | Analyst | 2010 – 2011'), [['Globex Inc.', 'Analyst', 'Denver, CO', '2010', '2011']]);
  assert.deepEqual(jobs('Siemens, Munich, Germany\t2019 – 2020', 'Data Scientist'), [['Siemens', 'Data Scientist', 'Munich, Germany', '2019', '2020']]);
});

test('an employer line over its roles gives each the place', () => {
  assert.deepEqual(jobs('Acme Corp, Austin, TX', 'Senior Developer, Jan 2012 – Dec 2014', '• Did it'),
    [['Acme Corp', 'Senior Developer', 'Austin, TX', 'Jan 2012', 'Dec 2014']]);
});

test('a company\'s legal ending stays in its name', () => {
  assert.deepEqual(jobs('Senior Engineer — Acme, Inc.', '2019 – 2020'), [['Acme, Inc.', 'Senior Engineer', '', '2019', '2020']]);
});
