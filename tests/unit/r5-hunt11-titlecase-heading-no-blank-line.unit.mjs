// R5-HUNT11-TITLECASE-HEADING-NO-BLANK-LINE: in a file with no heading marks (a Word résumé whose bold
// section titles are spaced by paragraph spacing, a compact text file), a Title-Case known title with no
// blank line before it ("Education", "Skills") was no heading: every later section stayed in the one
// above, the schools became jobs and the skills a job's text. Such a title starts its section now; a
// label inside a job ("Projects"), a skills category ("Languages", "Tools") and a role ("Volunteer") do not.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];
const types = (r) => r.sections.map((s) => s.type);

test('Title-Case "Education" and "Skills" with no blank line before them start their sections', () => {
  const r = resumeFromText('Marcus Lee\nProduct Designer\nmarcus@lee.design | 555-201-3344 | Austin, TX\nExperience\nFigma\tJan 2021 – Present\nSenior Product Designer\n• Led the redesign\nDropbox\tJun 2018 – Dec 2020\nProduct Designer\n• Designed onboarding\nEducation\nRhode Island School of Design\t2014 – 2018\nBFA Graphic Design\nSkills\nFigma, Sketch, Prototyping\n');
  assert.deepEqual(types(r), ['experience', 'education', 'skills']);
  const jobs = items(r, 'experience');
  assert.deepEqual(jobs.map((j) => [j.company, j.role]), [['Figma', 'Senior Product Designer'], ['Dropbox', 'Product Designer']]);
  assert.doesNotMatch(jobs[1].description, /Education/);
  assert.deepEqual(items(r, 'education').map((e) => [e.institution, e.degree, e.startDate]), [['Rhode Island School of Design', 'BFA Graphic Design', '2014']]);
  assert.equal(items(r, 'skills')[0].skills, 'Figma, Sketch, Prototyping');
});

test('after a "Summary" first, the sections are sections, not the summary; a job’s label, a role and a skills category stay theirs', () => {
  const r = resumeFromText('Marcus Lee\nmarcus@lee.design\nSummary\nDesigner with ten years of experience building products people love.\nExperience\nFigma\tJan 2021 – Present\nSenior Product Designer\n• Led the redesign\nProjects\n• Built a design system\nRed Cross\t2016 – 2018\nVolunteer\nSkills\nLanguages\nPython, Go\nTools\nGit, Docker\nEducation\nMIT\t2014 – 2018\nB.S. Computer Science\n');
  assert.deepEqual(types(r), ['experience', 'skills', 'education']);
  assert.doesNotMatch(r.personal.summary, /Figma|Experience/);
  const jobs = items(r, 'experience');
  assert.deepEqual(jobs.map((j) => [j.company, j.role]), [['Figma', 'Senior Product Designer'], ['Red Cross', 'Volunteer']]);
  assert.match(jobs[0].description, /Projects.*Built a design system/);
  assert.deepEqual(items(r, 'skills').map((s) => [s.category, s.skills]), [['Languages', 'Python, Go'], ['Tools', 'Git, Docker']]);
});
