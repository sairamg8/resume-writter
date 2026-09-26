// R4-LO-01: Experience's "Group roles by company" prints, in the PDF and Word, the employer on a line of
// its own with no date (its place at the right end, or in Word on the line under it), then each role
// with its dates and no company. The import put the employer line into the job above as text and gave
// each role no company (R4-IMP-09 covered only Markdown). Each role is now a job at that employer, with
// its dates and the employer's place (or its own, where it prints one).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const HEAD = ['Jordan Ellery', 'jordan.ellery@example.com', '', 'EXPERIENCE'];
const jobs = (lines) => (resumeFromText([...HEAD, ...lines]).sections.find((s) => s.type === 'experience')?.items || [])
  .map((j) => [j.company, j.role, j.startDate, j.endDate, j.current, j.location]);

test('the PDF\'s layout: "Acme ⇥ Portland, OR" over two dated roles, then a job alone', () => {
  assert.deepEqual(jobs([
    'Acme\tPortland, OR',
    'Engineering Manager\tMar 2021 – Present',
    '• Grew the team to twelve.',
    '',
    'Senior Engineer\tJun 2018 – Feb 2021',
    '• Built the billing service.',
    '',
    'Initech\tJun 2015 – May 2018',
    'Engineer\tRemote',
    '• Kept the lights on.',
  ]), [
    ['Acme', 'Engineering Manager', 'Mar 2021', '', true, 'Portland, OR'],
    ['Acme', 'Senior Engineer', 'Jun 2018', 'Feb 2021', false, 'Portland, OR'],
    ['Initech', 'Engineer', 'Jun 2015', 'May 2018', false, 'Remote'],
  ]);
});

test('Word\'s layout: the employer, its place at the right tab under it, a role with a place of its own', () => {
  // As docxXmlLines gives them: a break, then a tab to the right tab stop.
  const r = resumeFromText([...HEAD,
    // A job before the group: its text is not the employer.
    'Initech\tJun 2022 – Present', 'Engineer\tRemote', '• Kept it running.', '',
    { text: 'Acme\n\tLisbon' },
    'Staff Engineer\t01/2021 – Present',
    '• Ran the billing rewrite.',
    '',
    { text: 'Lead Engineer\t06/2019 – 12/2020\n\tPorto' },
    '• Moved the payment jobs.',
  ]);
  const items = r.sections.find((s) => s.type === 'experience').items;
  assert.deepEqual(items.map((j) => [j.company, j.role, j.location]), [['Initech', 'Engineer', 'Remote'], ['Acme', 'Staff Engineer', 'Lisbon'], ['Acme', 'Lead Engineer', 'Porto']]);
  assert.doesNotMatch(JSON.stringify(items), /"description":"[^"]*Acme/);
});

test('the Timeline\'s layout: the employer, then each role\'s date over the role', () => {
  assert.deepEqual(jobs([
    'Acme\tPortland, OR', 'Mar 2021 – Present', 'Engineering Manager', '• Grew the team.', '',
    'Jun 2018 – Feb 2021', 'Senior Engineer', '• Built the billing service.', '',
    'Jun 2015 – May 2018', 'Engineer\tInitech', 'Remote', '• Kept the lights on.',
  ]), [
    ['Acme', 'Engineering Manager', 'Mar 2021', '', true, 'Portland, OR'],
    ['Acme', 'Senior Engineer', 'Jun 2018', 'Feb 2021', false, 'Portland, OR'],
    ['Initech', 'Engineer', 'Jun 2015', 'May 2018', false, 'Remote'],
  ]);
});

// The review of R4-LO-01: a job after a group, and the last line of the job above, are not the group's.
test('a job after a group, role first with its company under it, is its own company\'s', () => {
  assert.deepEqual(jobs([
    'Acme\tPortland, OR', 'Engineering Manager\tMar 2021 – Present', '• Grew the team.',
    'Engineer\tJun 2015 – May 2018', 'Initech', '• Kept the lights on.',
  ]).map((j) => j.slice(0, 2)), [['Acme', 'Engineering Manager'], ['Initech', 'Engineer']]);
});

test('a job\'s last line after its list is not an employer; nor is the ATS text\'s "Company - Role"', () => {
  const got = jobs([
    'Northwind\t2021 – Present', 'Analyst\tLeeds', '• Built X', 'Promoted twice in two years',
    'Engineer\t2019 – 2021', 'Globex', '• Shipped.',
  ]);
  assert.deepEqual(got.map((j) => j.slice(0, 2)), [['Northwind', 'Analyst'], ['Globex', 'Engineer']]);
  const ats = jobs(['Acme - Engineer', '2020 - Present', 'Did the things']);
  assert.deepEqual(ats.map((j) => j.slice(0, 2)), [['Acme', 'Engineer']]);
});

test('the first group in the section, with no place', () => {
  assert.deepEqual(jobs(['Acme', 'Engineering Manager\t2021 – Present', '• Led.', 'Engineer\t2018 – 2021', '• Built.']), [
    ['Acme', 'Engineering Manager', '2021', '', true, ''], ['Acme', 'Engineer', '2018', '2021', false, ''],
  ]);
});

test('jobs printed the usual way are read as before', () => {
  assert.deepEqual(jobs([
    'Northwind Analytics\tMar 2021 – Present', 'Senior Data Engineer\tPortland, OR', '• Built the pipeline.', '',
    'Contoso Freight\tJun 2017 – Feb 2021', 'Data Engineer\tRemote', '• Moved the jobs.',
  ]), [
    ['Northwind Analytics', 'Senior Data Engineer', 'Mar 2021', '', true, 'Portland, OR'],
    ['Contoso Freight', 'Data Engineer', 'Jun 2017', 'Feb 2021', false, 'Remote'],
  ]);
});
