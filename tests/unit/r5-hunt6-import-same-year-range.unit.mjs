// R5-HUNT6-SAME-YEAR-RANGE: a range inside one year prints the year once ("Jun – Aug 2021", "May –
// August 2020"), as internships and summer jobs are dated. It was no date: the job's role became
// "Jun", its start date the end month, and the real title a paragraph of its description. The first
// month now takes the end's year, or the year before when it comes later in the year.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDateRange, resumeFromText } from '../../src/utils/importText.js';

const range = (text) => { const d = readDateRange(text); return d && [d.start, d.end, d.current]; };

test('a month with no year before a dash takes the end\'s year', () => {
  assert.deepEqual(range('Jun - Aug 2021'), ['Jun 2021', 'Aug 2021', false]);
  assert.deepEqual(range('Jun – Aug 2021'), ['Jun 2021', 'Aug 2021', false]);
  assert.deepEqual(range('May – August 2020'), ['May 2020', 'August 2020', false]);
  assert.deepEqual(range('June–August 2021'), ['June 2021', 'August 2021', false]);
  assert.deepEqual(range('Jun to Aug 2021'), ['Jun 2021', 'Aug 2021', false]);
  assert.deepEqual(range('Dec – Feb 2021'), ['Dec 2020', 'Feb 2021', false]);
  assert.equal(readDateRange('Jun'), null);
});

test('a summer job dated "Jun – Aug 2021" keeps its role, company and dates', () => {
  const r = resumeFromText('Jane Doe\n\nEXPERIENCE\nGoogle\tJun – Aug 2021\nSoftware Engineering Intern\n• Built search\nAcme Corp\tMay – August 2020\nData Analyst Intern\n• Cleaned data');
  const jobs = r.sections.find((s) => s.type === 'experience').items;
  assert.deepEqual(jobs.map((j) => [j.company, j.role, j.startDate, j.endDate, j.current]), [
    ['Google', 'Software Engineering Intern', 'Jun 2021', 'Aug 2021', false],
    ['Acme Corp', 'Data Analyst Intern', 'May 2020', 'August 2020', false],
  ]);
  assert.doesNotMatch(jobs[0].description, /Software Engineering Intern/);
});
