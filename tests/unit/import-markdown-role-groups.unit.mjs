// R4-IMP-09: Experience's "Group roles by company" exports the employer as "### **Acme**" over its
// place, and each role as "#### **Senior Engineer**" over its dates. The import read every ###/####
// line as an entry of its own: an item "Acme" with no role and no dates (its place as its
// description), and an item per role with no company. Each role now comes back as its own job at Acme,
// with its dates and the group's place.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownLines, resumeFromText } from '../../src/utils/importText.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

// A fictional person: two roles at one company, grouped, and a job elsewhere.
const RESUME = {
  personal: { name: 'Jordan Ellery', title: 'Engineering Manager', email: 'jordan.ellery@example.com' },
  sections: [{
    id: 's1', type: 'experience', title: 'Experience', settings: { groupRoles: true },
    items: [
      { id: 'e1', company: 'Acme', role: 'Engineering Manager', location: 'Portland, OR', startDate: 'Mar 2021', endDate: '', current: true, description: '<ul><li>Grew the team to twelve.</li></ul>' },
      { id: 'e2', company: 'Acme', role: 'Senior Engineer', location: 'Portland, OR', startDate: 'Jun 2018', endDate: 'Feb 2021', description: '<ul><li>Built the billing service.</li></ul>' },
      { id: 'e3', company: 'Initech', role: 'Engineer', location: 'Remote', startDate: 'Jun 2015', endDate: 'May 2018', description: '<ul><li>Kept the lights on.</li></ul>' },
    ],
  }],
};

test('the app\'s own grouped Markdown: each role a job at its company, with its dates and the place', () => {
  const md = generateMarkdownResume(RESUME);
  assert.match(md, /### \*\*Acme\*\*/, 'the export groups the roles');
  assert.match(md, /#### \*\*Senior Engineer\*\*/, 'the export groups the roles');
  const jobs = resumeFromText(markdownLines(md)).sections.find((s) => s.type === 'experience')?.items || [];
  assert.deepEqual(jobs.map((j) => [j.company, j.role, j.startDate, j.endDate, j.current, j.location]), [
    ['Acme', 'Engineering Manager', 'Mar 2021', '', true, 'Portland, OR'],
    ['Acme', 'Senior Engineer', 'Jun 2018', 'Feb 2021', false, 'Portland, OR'],
    ['Initech', 'Engineer', 'Jun 2015', 'May 2018', false, 'Remote'],
  ], md);
  assert.match(jobs[0].description, /Grew the team to twelve/);
  assert.match(jobs[1].description, /Built the billing service/);
  assert.doesNotMatch(jobs[0].description, /Portland/);
});

test('an entry with its own dates and a heading under it: both stay entries, as before', () => {
  const md = '# Jordan Ellery\n\n## Experience\n### Acme — Engineer\n*Mar 2021 – Present*\n\n#### Highlights\n- Built it.\n';
  const jobs = resumeFromText(markdownLines(md)).sections.find((s) => s.type === 'experience')?.items || [];
  assert.equal(jobs[0].company, 'Acme');
  assert.equal(jobs[0].startDate, 'Mar 2021');
  assert.match(JSON.stringify(jobs), /Highlights/);
});

// The review of R4-IMP-09: an entry whose title holds a role and a company is no employer over roles.
test('"### Acme — Engineer" over "#### Highlights" with no dates: Acme\'s job as written', () => {
  const md = '# Jordan Ellery\n\n## Experience\n### Acme — Engineer\n#### Highlights\n- Built it.\n';
  const jobs = resumeFromText(markdownLines(md)).sections.find((s) => s.type === 'experience')?.items || [];
  assert.deepEqual([jobs[0]?.company, jobs[0]?.role], ['Acme', 'Engineer']);
});
