// R5-HUNT11 review of R5-HUNT11-LINKEDIN-GROUPED-ROLES-COMPANY: a job's place alone on the line under
// its date line is its location. A next job's company that reads as a place ("Globex, Inc.", "Initech,
// LLC": a name, a comma, a word), right under a job's dates with no text between them, over its own role
// and dates, became the job above's location, and the next job had no company. It is the next job's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const jobs = (r) => (r.sections.find((s) => s.type === 'experience')?.items || []).map((j) => [j.company, j.role, j.location, j.startDate]);

test('"Globex, Inc." over its role over its dates, under the job above’s dates, is the next job’s company', () => {
  const r = resumeFromText('Jordan Smith\n\nExperience\nStripe\nStaff Engineer\nJan 2020 - Present\nGlobex, Inc.\nEngineer\nJan 2017 - Dec 2019\n');
  assert.deepEqual(jobs(r), [['Stripe', 'Staff Engineer', '', 'Jan 2020'], ['Globex, Inc.', 'Engineer', '', 'Jan 2017']]);
});

test('"Initech, LLC" right over its dates is the next job’s title', () => {
  const r = resumeFromText('Jordan Smith\n\nExperience\nStripe\nStaff Engineer\nJan 2020 - Present\nInitech, LLC\nJan 2017 - Dec 2019\n');
  const [, next] = r.sections.find((s) => s.type === 'experience').items;
  assert.equal(r.sections.find((s) => s.type === 'experience').items[0].location, '');
  assert.ok(next && [next.company, next.role].includes('Initech, LLC'));
});

test('LinkedIn’s place under each role’s dates is still its location, a grouped role’s too', () => {
  const r = resumeFromText('Jordan Smith\n\nExperience\nStripe\nStaff Engineer\nJan 2020 - Present (4 years)\nSan Francisco, California\nGoogle\n5 years 2 months\nSenior Software Engineer\nJanuary 2017 - December 2019 (3 years)\nMountain View, California\nSoftware Engineer\nNovember 2014 - December 2016 (2 years 2 months)\nMountain View, California\n');
  assert.deepEqual(jobs(r), [
    ['Stripe', 'Staff Engineer', 'San Francisco, California', 'Jan 2020'],
    ['Google', 'Senior Software Engineer', 'Mountain View, California', 'January 2017'],
    ['Google', 'Software Engineer', 'Mountain View, California', 'November 2014'],
  ]);
});
