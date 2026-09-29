// R5-HUNT8-UNDATED-ENTRY-MERGED: in a section where any entry has a date, an entry with no date was
// swallowed by the dated one next to it, even after a blank line: an undated project or freelance job
// became the first lines of its neighbour's description, and an undated certificate "Additional
// Information". The app's own ATS text did not read back. A block with no date that starts after a blank
// line (or first in the section) and opens with a title line is an entry of its own now.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';
import { generateAtsPlainText } from '../../src/utils/atsPlainText.js';

const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];
const types = (r) => r.sections.map((s) => s.type);

test('an undated project before or after a dated one is an entry of its own', () => {
  for (const text of [
    'Jane Doe\n\nProjects\nResume Builder\n• A React app for resumes.\n\nChat App\t2021\n• Realtime chat',
    'Jane Doe\n\nProjects\nChat App\t2021\n• Realtime chat\n\nResume Builder\n• A React app for resumes.',
  ]) {
    const p = items(resumeFromText(text), 'projects');
    const byName = Object.fromEntries(p.map((x) => [x.name, x]));
    assert.deepEqual(p.map((x) => x.name).sort(), ['Chat App', 'Resume Builder'], text);
    assert.equal(byName['Chat App'].startDate, '2021', text);
    assert.doesNotMatch(byName['Chat App'].description, /Resume Builder|React app/, text);
    assert.match(byName['Resume Builder'].description, /A React app for resumes/, text);
  }
});

test('an undated job over a dated one is a job of its own', () => {
  const jobs = items(resumeFromText('Jane Doe\n\nExperience\nFreelance Developer\n• Built sites.\n\nAcme Corp\t2019 – 2020\nEngineer\n• Stuff'), 'experience');
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].role, 'Freelance Developer');
  assert.match(jobs[0].description, /Built sites/);
  assert.deepEqual([jobs[1].company, jobs[1].role, jobs[1].startDate, jobs[1].endDate], ['Acme Corp', 'Engineer', '2019', '2020']);
  assert.doesNotMatch(jobs[1].description, /Freelance|Built sites/);
});

test('the ATS text export of undated projects and certificates reads back', () => {
  const resume = {
    personal: { name: 'Jane Doe', email: 'jane@x.com' },
    sections: [
      { type: 'projects', title: 'Projects', items: [
        { name: 'Resume Builder', technologies: 'React', description: '<ul><li>A React app.</li></ul>' },
        { name: 'Chat App', technologies: 'Firebase', startDate: '2021', description: '<ul><li>Realtime chat.</li></ul>' },
      ] },
      { type: 'certifications', title: 'Certifications', items: [
        { name: 'AWS Certified Developer', issuer: 'Amazon', date: '2021' },
        { name: 'Certified ScrumMaster', issuer: 'Scrum Alliance' },
      ] },
    ],
  };
  const txt = generateAtsPlainText(resume);
  const r = resumeFromText(txt);
  assert.deepEqual(types(r), ['projects', 'certifications'], txt);
  assert.deepEqual(items(r, 'projects').map((p) => [p.name, p.technologies, p.startDate]), [['Resume Builder', 'React', ''], ['Chat App', 'Firebase', '2021']], txt);
  assert.doesNotMatch(items(r, 'projects')[1].description, /Resume Builder|React app/, txt);
  assert.deepEqual(items(r, 'certifications').map((c) => [c.name, c.issuer, c.date]), [
    ['AWS Certified Developer', 'Amazon', '2021'],
    ['Certified ScrumMaster', 'Scrum Alliance', ''],
  ], txt);
});

test('a dated entry’s own lines with no blank line between still stay its own', () => {
  const jobs = items(resumeFromText('Jane Doe\n\nExperience\nAcme Corp\t2019 – 2020\nEngineer\n• Stuff\nPromoted twice'), 'experience');
  assert.equal(jobs.length, 1);
  assert.match(jobs[0].description, /Promoted twice/);
});
