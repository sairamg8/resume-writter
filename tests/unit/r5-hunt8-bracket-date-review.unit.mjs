// R5-HUNT8-AWARD-MULTI-YEAR-PAREN, review: the fix stopped every split inside brackets, so a date after
// a word in brackets was no date at all: "Software Engineer, Acme (Remote, Jan 2020 – Present)" lost its
// dates (its company "Present)"), and a job or an award dated so went into the entry above. And a line of
// awards with no list marks lost "Dean’s List (2018, 2019)" to the award above's description, no longer
// dated. Now a date after a word in brackets is the date, its bracket closed over the word ("Acme
// (Remote)"); several dates in brackets stay in the title, the line still an entry's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];

test('a date after a word in brackets is the date, the bracket closed', () => {
  const jobs = items(resumeFromText('Jane Doe\n\nExperience\nSoftware Engineer, Acme (Remote, Jan 2020 – Present)\n• Built X\nEngineer, Beta (Contract, 2018 – 2019)\n• Did Y'), 'experience');
  assert.deepEqual(jobs.map((j) => [j.role, j.company, j.startDate, j.endDate, j.current]), [
    ['Software Engineer', 'Acme (Remote)', 'Jan 2020', '', true],
    ['Engineer', 'Beta (Contract)', '2018', '2019', false],
  ]);
  const a = items(resumeFromText('Jane Doe\n\nAwards\n• Employee of the Month (Acme, Mar 2020)'), 'awards');
  assert.deepEqual(a.map((x) => [x.title, x.date]), [['Employee of the Month (Acme)', 'Mar 2020']]);
});

test('awards with no list marks: several years in brackets keep their line an award', () => {
  const a = items(resumeFromText('Jane Doe\n\nAwards\nEmployee of the Month (Acme, Mar 2020)\nDean’s List (2018, 2019)\nHackathon Winner, 2019'), 'awards');
  assert.deepEqual(a.map((x) => [x.title, x.date]), [
    ['Employee of the Month (Acme)', 'Mar 2020'],
    ['Dean’s List (2018, 2019)', ''],
    ['Hackathon Winner', '2019'],
  ]);
  assert.equal(a[0].description || '', '');
});
