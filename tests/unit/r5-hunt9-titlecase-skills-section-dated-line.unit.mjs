// R5-HUNT9-TITLECASE-SUBHEADING-STARTS-SECTION, review: the fix kept a Title-Case skills title no
// section wherever a dated line followed it before the next heading, the section's own lines included.
// So a "Technical Skills" section after the last job, with a line such as "Certified: AWS Solutions
// Architect, 2021" in it, was lost: its lines went into the job above, and the dated one became a bogus
// job with the company "Technical Skills". Only a line past the title's own block (after a blank line or
// a list), and no "Label: value" line, is a next entry's now.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];
const types = (r) => r.sections.map((s) => s.type);
const job = 'Jane Doe\njane@x.com\n\nExperience\nSoftware Engineer, Acme Corp\t2020 – Present\n• Built the billing platform\n\n';
const school = '\n\nEducation\nMIT\t2014 – 2018\nB.S. Computer Science';

test('a Title-Case skills section with a dated line of its own still is a section', () => {
  for (const skills of [
    'Technical Skills\nLanguages: Python, Java\nCertified: AWS Solutions Architect, 2021',
    'Skills\nLanguages: Python, Java\n\nCertifications: AWS Solutions Architect, 2021',
  ]) {
    const r = resumeFromText(`${job}${skills}${school}`);
    assert.deepEqual(types(r), ['experience', 'skills', 'education'], skills);
    const jobs = items(r, 'experience');
    assert.deepEqual(jobs.map((j) => [j.company, j.role]), [['Acme Corp', 'Software Engineer']], skills);
    assert.doesNotMatch(jobs[0].description, /Python|AWS/, skills);
  }
});

test('a Title-Case skills title inside a project, a dated project after its list, still is the project’s', () => {
  const r = resumeFromText('Jane Doe\njane@x.com\n\nPROJECTS\nResume Builder\t2023\n• A React app\nTech Stack\n• React, Node\nChat App\t2022\n• Realtime chat');
  assert.deepEqual(types(r), ['projects']);
  assert.deepEqual(items(r, 'projects').map((x) => [x.name, x.startDate]), [['Resume Builder', '2023'], ['Chat App', '2022']]);
});
