// R5-HUNT8-UNDATED-ENTRY-MERGED, review: the rule that makes an undated block after a blank line an
// entry of its own also took a dated entry's own text for one, where its title and its text are parted
// by a blank line: a job's opening paragraph became a job (its sentence the role), a paragraph wrapped
// onto a second line a job whose company was half a sentence, and an education entry's "Relevant
// Coursework" list a degree. Such a block is its entry's text again; an undated entry still is one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];

test('a job’s paragraph after a blank line under its title is its description, not a job', () => {
  const jobs = items(resumeFromText('Jane Doe\n\nExperience\nSenior Engineer | Acme | 2019 - 2020\n\nLed a team of 5 engineers building the payments platform\n• Built X\n\nEngineer | Beta | 2017 - 2019\n• Did Y'), 'experience');
  assert.deepEqual(jobs.map((j) => [j.role, j.company]), [['Senior Engineer', 'Acme'], ['Engineer', 'Beta']]);
  assert.match(jobs[0].description, /Led a team of 5 engineers.*Built X/);
});

test('a paragraph wrapped onto a second line is no entry', () => {
  const jobs = items(resumeFromText('Jane Doe\n\nExperience\nAcme Corp\t2019 – 2020\nEngineer\n• Built X\n\nLed the migration of the monolith to microservices, cutting deploy\ntime by 80% and saving money.'), 'experience');
  assert.equal(jobs.length, 1);
  assert.match(jobs[0].description, /cutting deploy.*time by 80%/);
});

test('a list under a subheading after a blank line stays the education entry’s', () => {
  const edu = items(resumeFromText('Jane Doe\n\nEducation\nBSc Computer Science - MIT\n2014 - 2018\n\nRelevant Coursework\n• Algorithms\n• Databases'), 'education');
  assert.equal(edu.length, 1);
  assert.match(edu[0].description, /Relevant Coursework.*Algorithms.*Databases/);
});

test('an undated entry after one with no description still is one, its named fields its own (the ATS text’s)', () => {
  const p = items(resumeFromText('Jane Doe\n\nProjects\nChat App (Firebase)\n2021\n\nResume Builder (React)\nLink: https://rb.dev\n\nTodo (Vue)\n2020\n* did'), 'projects');
  assert.deepEqual(p.map((x) => [x.name, x.startDate, x.url]), [['Chat App', '2021', ''], ['Resume Builder', '', 'https://rb.dev'], ['Todo', '2020', '']]);
  assert.doesNotMatch(p[1].description, /rb\.dev/);
  const c = items(resumeFromText('Jane Doe\n\nCertifications\nAWS Certified Developer - Amazon - 2021\n\nCertified ScrumMaster - Scrum Alliance\nExpires: 2027-06 | ID: CSM-1\nLink: https://sa.org/c/1\n'), 'certifications');
  assert.deepEqual(c.map((x) => [x.name, x.issuer, x.date, x.expiry, x.credentialId, x.url]), [
    ['AWS Certified Developer', 'Amazon', '2021', '', '', ''],
    ['Certified ScrumMaster', 'Scrum Alliance', '', '2027-06', 'CSM-1', 'https://sa.org/c/1'],
  ]);
  const jobs = items(resumeFromText('Jane Doe\n\nExperience\nBeta - Engineer\n2017 - 2019\n\nFreelance Developer\n* Built sites.'), 'experience');
  assert.deepEqual(jobs.map((j) => j.role), ['Engineer', 'Freelance Developer']);
});
