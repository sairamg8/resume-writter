// R5-HUNT9-SUBHEADING-BECOMES-ENTRY: a sub-heading inside a job or a school after a blank line ("Key
// Responsibilities", "Highlights", "Relevant Coursework", "Activities") became a blank entry of its own
// once the entry above had a bullet, its list taken from the job or school it belongs to (a regression
// from R5-HUNT8-UNDATED-ENTRY-MERGED). Such a label and its list stay the entry's text now; an undated
// entry after a dated one still is one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];

test('a job’s sub-heading and its list after a blank line stay the job’s', () => {
  for (const label of ['Key Responsibilities', 'Highlights', 'Selected Clients', 'Technologies Used', 'Promoted to Senior Engineer']) {
    const text = `Jane Doe\njane@x.com\n\nEXPERIENCE\nSoftware Engineer, Acme Corp\t2020 – Present\n• Built the billing platform\n\n${label}\n• Led a team of five\n\nData Analyst, Beta Inc\t2018 – 2020\n• Built dashboards`;
    const jobs = items(resumeFromText(text), 'experience');
    assert.deepEqual(jobs.map((j) => [j.company, j.role]), [['Acme Corp', 'Software Engineer'], ['Beta Inc', 'Data Analyst']], label);
    assert.match(jobs[0].description, new RegExp(`Built the billing platform.*${label}.*Led a team of five`), label);
    assert.doesNotMatch(jobs[1].description, /Led a team/, label);
  }
});

test('a school’s “Relevant Coursework” and “Activities” after a blank line stay the school’s', () => {
  const edu = items(resumeFromText('Jane Doe\njane@x.com\n\nEDUCATION\nUniversity of Michigan\t2016 – 2020\nB.S. Computer Science\n• Teaching assistant\n\nRelevant Coursework\n• Algorithms\n• Operating Systems\n\nActivities\n• Chess club'), 'education');
  assert.equal(edu.length, 1);
  assert.equal(edu[0].institution, 'University of Michigan');
  assert.match(edu[0].description, /Teaching assistant.*Relevant Coursework.*Algorithms.*Operating Systems.*Activities.*Chess club/);
});

test('an undated project or job after a dated one with text still is an entry of its own', () => {
  const p = items(resumeFromText('Jane Doe\n\nProjects\nChat App\t2021\n• Realtime chat\n\nResume Builder\n• A React app for resumes.'), 'projects');
  assert.deepEqual(p.map((x) => x.name), ['Chat App', 'Resume Builder']);
  const jobs = items(resumeFromText('Jane Doe\n\nExperience\nAcme Corp\t2019 – 2020\nEngineer\n• Stuff\n\nFreelance Developer\n• Built sites.'), 'experience');
  assert.deepEqual(jobs.map((j) => j.role), ['Engineer', 'Freelance Developer']);
});
