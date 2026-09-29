// R5-HUNT9-BODY-LINE-BRACKET-YEARS-NEW-ENTRY: a line in a job's or a school's text ending with several
// years in brackets ("Named top seller (2019 and 2021)", "Dean’s List (Fall 2018, Spring 2019)") was read
// as dated, so it started a blank entry of its own (in Education, degree "Dean’s List (Fall 2018" and
// field "Spring 2019)"). Several years in brackets date only a certificate's or an award's line now;
// under a job or a school the line stays its entry's text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];

test('a job’s line with years in brackets stays in its description', () => {
  const jobs = items(resumeFromText('Jane Doe\njane@x.com\n\nEXPERIENCE\nSales Manager, Acme Corp\t2018 – Present\n• Exceeded quota every quarter\nNamed top seller (2019 and 2021)\n\nAccount Executive, Beta Inc\t2015 – 2018\n• Closed deals'), 'experience');
  assert.deepEqual(jobs.map((j) => [j.company, j.role]), [['Acme Corp', 'Sales Manager'], ['Beta Inc', 'Account Executive']]);
  assert.match(jobs[0].description, /Named top seller \(2019 and 2021\)/);
});

test('a school’s line with terms in brackets stays in its description', () => {
  const edu = items(resumeFromText('Jane Doe\njane@x.com\n\nEDUCATION\nUniversity of Michigan\t2016 – 2020\nB.S. Computer Science\nDean’s List (Fall 2018, Spring 2019)\n\nStanford University\t2020 – 2022\nM.S. Data Science'), 'education');
  assert.deepEqual(edu.map((e) => [e.institution, e.degree, e.fieldOfStudy || '']), [
    ['University of Michigan', 'B.S. Computer Science', ''],
    ['Stanford University', 'M.S. Data Science', ''],
  ]);
  assert.match(edu[0].description, /Dean’s List \(Fall 2018, Spring 2019\)/);
});

test('awards with no list marks still read several years in brackets as an award’s line', () => {
  const a = items(resumeFromText('Jane Doe\n\nAwards\nEmployee of the Month (Acme, Mar 2020)\nDean’s List (2018, 2019)\nHackathon Winner, 2019'), 'awards');
  assert.deepEqual(a.map((x) => x.title), ['Employee of the Month (Acme)', 'Dean’s List (2018, 2019)', 'Hackathon Winner']);
});
