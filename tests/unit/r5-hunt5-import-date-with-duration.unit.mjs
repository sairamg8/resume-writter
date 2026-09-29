// R5-HUNT5-IMPORT-DATE-WITH-DURATION-SUFFIX-NOT-A-DATE: a date range followed by how long it lasted,
// "January 2020 - Present (4 years 9 months)" as LinkedIn's PDF prints it, or "· 3 yrs 2 mos", was no
// date, so each job lost its role and dates to its description. The length is now dropped from the date.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDateRange, resumeFromText } from '../../src/utils/importText.js';

test('a range with its length after it reads as the range', () => {
  const cases = [
    ['January 2020 - Present (4 years 9 months)', 'January 2020', '', true],
    ['Dec 2019 - Jan 2020 (2 months)', 'Dec 2019', 'Jan 2020', false],
    ['Jun 2019 – Aug 2019 (3 months)', 'Jun 2019', 'Aug 2019', false],
    ['Mar 2018 - Feb 2019 (1 year)', 'Mar 2018', 'Feb 2019', false],
    ['Jan 2020 – Present · 3 yrs 2 mos', 'Jan 2020', '', true],
    ['May 2021 - Jun 2021 (less than a year)', 'May 2021', 'Jun 2021', false],
  ];
  for (const [text, start, end, current] of cases) {
    const d = readDateRange(text);
    assert.ok(d, text);
    assert.deepEqual([d.start, d.end, d.current], [start, end, current], text);
  }
});

test('a job dated with its length gets its role and dates', () => {
  const r = resumeFromText('Priya Shah\npriya@mail.com\n\nEXPERIENCE\n\nInfosys\nSenior Data Analyst\nJanuary 2020 - Present (4 years 9 months)\n• Built dashboards');
  const [job] = r.sections.find((s) => s.type === 'experience').items;
  assert.deepEqual([job.company, job.role, job.startDate, job.current], ['Infosys', 'Senior Data Analyst', 'January 2020', true]);
  assert.doesNotMatch(job.description, /Senior Data Analyst|years/);
  assert.match(job.description, /Built dashboards/);
});

test('a length set apart at "·" on the entry line stays with the date', () => {
  const r = resumeFromText('Priya Shah\npriya@mail.com\n\nEXPERIENCE\nInfosys\tJan 2020 – Present · 3 yrs 2 mos\nSenior Data Analyst\n• Built dashboards');
  const [job] = r.sections.find((s) => s.type === 'experience').items;
  assert.deepEqual([job.company, job.role, job.startDate, job.current], ['Infosys', 'Senior Data Analyst', 'Jan 2020', true]);
  assert.doesNotMatch(job.description, /yrs/);
});
