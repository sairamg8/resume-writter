// R5-HUNT12-LINKEDIN-GROUPED-ROLE-DESC-BECOMES-COMPANY: in LinkedIn's grouped roles, a role's one-line
// description with no closing period ("Leading the storage team") became the next role's company, the
// next role left the group and the first role lost its text. The description stays the first role's now,
// the next role Google's; a next employer over its role ("Microsoft") is still a job of its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const jobs = (r) => (r.sections.find((s) => s.type === 'experience')?.items || []).map((j) => [j.company, j.role, j.startDate, j.description]);

test('a role’s short description with no period stays its own; the next role is the group’s', () => {
  const r = resumeFromText('Jane Doe\njane@doe.com\n\nExperience\nGoogle\n5 years 2 months\nSenior Software Engineer\nJanuary 2021 - Present (3 years 9 months)\nMountain View, California, United States\nLeading the storage team\nSoftware Engineer\nAugust 2019 - January 2021 (1 year 6 months)\nMountain View, California, United States\nBuilt indexing pipelines\nMicrosoft\nSoftware Engineer II\nJune 2016 - August 2019 (3 years 3 months)\nRedmond, Washington\n');
  assert.deepEqual(jobs(r), [
    ['Google', 'Senior Software Engineer', 'January 2021', '<p>Leading the storage team</p>'],
    ['Google', 'Software Engineer', 'August 2019', '<p>Built indexing pipelines</p>'],
    ['Microsoft', 'Software Engineer II', 'June 2016', ''],
  ]);
});
