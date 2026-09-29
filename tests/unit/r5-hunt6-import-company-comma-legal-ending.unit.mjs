// R5-HUNT6-COMPANY-COMMA-LEGAL-ENDING (review of R5-HUNT6-COMPANY-COMMA-PLACE): "Company, City, ST"
// beside a role gives the job its location. A company's legal ending after its comma was taken for the
// city: "Google, Inc., CA" came back as company "Google" and location "Inc., CA". A legal ending
// ("Inc.", "LLC", "Ltd") is the company's own and is no city, so the company keeps it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const jobs = (...lines) => resumeFromText(['Jane Doe', '', 'EXPERIENCE', ...lines].join('\n'))
  .sections.find((s) => s.type === 'experience').items.map((j) => [j.company, j.role, j.location]);

test('"Inc." after the company\'s comma is no city', () => {
  const [[company, role, location]] = jobs('Software Engineer — Google, Inc., CA', 'Jan 2019 – Dec 2019', '• Built search');
  assert.equal(role, 'Software Engineer');
  assert.match(company, /^Google, Inc\./);
  assert.doesNotMatch(location, /Inc/);
});

test('"LLC" after the comma stays in the company over grouped roles too', () => {
  const [[company, , location]] = jobs('Blue Bottle, LLC, OR', 'Senior Developer, Jan 2012 – Dec 2014', '• Did it');
  assert.match(company, /^Blue Bottle, LLC/);
  assert.doesNotMatch(location, /LLC/);
});

test('a company with a legal ending and then its city and state still gives the location', () => {
  assert.deepEqual(jobs('Software Engineer', 'Acme, LLC, Austin, TX', 'Jan 2015 – May 2019', '• Built things'),
    [['Acme, LLC', 'Software Engineer', 'Austin, TX']]);
});
