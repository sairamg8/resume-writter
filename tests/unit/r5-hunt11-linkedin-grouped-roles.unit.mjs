// R5-HUNT11-LINKEDIN-GROUPED-ROLES-COMPANY: LinkedIn's "Save to PDF" prints an employer with several
// roles as its name, its total length alone ("5 years 2 months"), then each role over its dates and its
// place. Each role got the length (or the role above's city) as its company, and the employer went into
// the job above's text. Each role's company is the employer now, and a place under the dates the location.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const jobs = (r) => (r.sections.find((s) => s.type === 'experience')?.items || []).map((j) => [j.company, j.role, j.location, j.startDate, j.endDate]);

test('a LinkedIn employer with two roles under a single-role job: each role Google’s, each place its location', () => {
  const r = resumeFromText('Jordan Smith\n\nExperience\nStripe\nStaff Software Engineer\nJanuary 2020 - Present (4 years 9 months)\nSan Francisco, California, United States\nLeading the ledger team.\n\nGoogle\n5 years 2 months\nSenior Software Engineer\nJanuary 2017 - December 2019 (3 years)\nMountain View, California\nSoftware Engineer\nNovember 2014 - December 2016 (2 years 2 months)\n');
  assert.deepEqual(jobs(r), [
    ['Stripe', 'Staff Software Engineer', 'San Francisco, California, United States', 'January 2020', ''],
    ['Google', 'Senior Software Engineer', 'Mountain View, California', 'January 2017', 'December 2019'],
    ['Google', 'Software Engineer', '', 'November 2014', 'December 2016'],
  ]);
  const [stripe] = r.sections.find((s) => s.type === 'experience').items;
  assert.equal(stripe.description, '<p>Leading the ledger team.</p>');
});

test('the employer first in its section, a role’s text between the roles, then a next employer’s job', () => {
  const r = resumeFromText('Jordan Smith\n\nExperience\nGoogle\n5 years 2 months\nSenior Software Engineer\nJanuary 2017 - December 2019 (3 years)\nMountain View, California\nBuilt search.\nSoftware Engineer\nNovember 2014 - December 2016 (2 years 2 months)\nMountain View, California\n\nMicrosoft\nSoftware Engineer Intern\nJune 2013 - August 2013 (3 months)\nRedmond, Washington\n');
  assert.deepEqual(jobs(r), [
    ['Google', 'Senior Software Engineer', 'Mountain View, California', 'January 2017', 'December 2019'],
    ['Google', 'Software Engineer', 'Mountain View, California', 'November 2014', 'December 2016'],
    ['Microsoft', 'Software Engineer Intern', 'Redmond, Washington', 'June 2013', 'August 2013'],
  ]);
  assert.match(r.sections[0].items[0].description, /Built search/);
});
