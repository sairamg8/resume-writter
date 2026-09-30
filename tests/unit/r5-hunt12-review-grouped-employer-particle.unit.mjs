// R5-HUNT12 review of R5-HUNT12-LINKEDIN-GROUPED-ROLE-DESC-BECOMES-COMPANY: a line with a word in lower
// case over a grouped role's next role was taken for the role above's text, so a next employer with a
// name's particle ("Universidad de Chile", "Banco do Brasil") went into the Google role's description and
// its own role joined the Google group. A particle is a name's word: that employer starts a job of its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const jobs = (r) => (r.sections.find((s) => s.type === 'experience')?.items || []).map((j) => [j.company, j.role, j.startDate, j.description]);
const google = 'Jane Doe\njane@doe.com\n\nExperience\nGoogle\n5 years 2 months\nSenior Software Engineer\nJanuary 2021 - Present (3 years 9 months)\nMountain View, California, United States\nSoftware Engineer\nAugust 2019 - January 2021 (1 year 6 months)\nMountain View, California, United States\n';

for (const [employer, role] of [['Universidad de Chile', 'Research Assistant'], ['Banco do Brasil', 'Analyst'], ['Bank of America', 'Analyst']]) {
  test(`"${employer}" after LinkedIn's grouped roles is the next job's company, not the role above's text`, () => {
    const r = resumeFromText(`${google}${employer}\n${role}\nJune 2016 - August 2019 (3 years 3 months)\n`);
    assert.deepEqual(jobs(r), [
      ['Google', 'Senior Software Engineer', 'January 2021', ''],
      ['Google', 'Software Engineer', 'August 2019', ''],
      [employer, role, 'June 2016', ''],
    ]);
  });
}

test('a role’s short text in lower case is still that role’s, the next role the group’s', () => {
  const r = resumeFromText(`${google.replace('Software Engineer\nAugust', 'Leading the storage team\nSoftware Engineer\nAugust')}`);
  assert.deepEqual(jobs(r), [
    ['Google', 'Senior Software Engineer', 'January 2021', '<p>Leading the storage team</p>'],
    ['Google', 'Software Engineer', 'August 2019', ''],
  ]);
});
