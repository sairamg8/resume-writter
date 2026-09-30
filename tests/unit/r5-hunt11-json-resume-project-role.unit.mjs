// R5-HUNT11-JSON-RESUME-PROJECT-ROLE-INVISIBLE: a JSON Resume file's project `roles` was stored as the
// project's `role`, which no editor box shows and no export prints (the PDF, Word, Markdown and ATS
// text print a project's name, link, technologies, dates and description), while the Job Match counted
// it as a found keyword, a project holding only it printed its heading over an empty entry, and the
// app's own JSON Resume export wrote it back out. Now the import puts the role in the description, as
// a last "Role: …" paragraph the editor shows and every export prints, and a role a project already
// holds from an earlier import counts nowhere and stays out of the file.
//
// Run: node --test tests/unit/r5-hunt11-json-resume-project-role.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpwtResumeToJsonResume, jsonResumeToCpwtResume } from '../../src/utils/jsonResume.js';
import { extractResumeCorpus } from '../../src/utils/atsChecker.js';
import { entryPrints } from '../../src/utils/entryPrints.js';

const resumeWith = (items) => ({
  id: 'r5h11', name: 'Sample', template: 'classic', settings: {},
  personal: { name: 'Maria Lopez', title: 'Engineer', email: 'maria@example.com', summary: '', hiddenFields: [] },
  sections: [{ id: 'pr', type: 'projects', title: 'Projects', visible: true, settings: {}, items }],
});

test('an imported project\'s roles go into its description, where the editor and every export show them', () => {
  const r = jsonResumeToCpwtResume({
    basics: { name: 'Maria Lopez' },
    projects: [{ name: 'Payments API', roles: ['Tech Lead', 'Architect'], description: 'Built it' }],
  });
  const item = r.sections.find((s) => s.type === 'projects').items[0];
  assert.ok(!item.role, `no hidden role is stored: ${JSON.stringify(item.role)}`);
  assert.match(item.description, /Built it/);
  assert.match(item.description, /<p>Role: Tech Lead, Architect<\/p>/, item.description);
});

test('a project with no roles gets no Role paragraph', () => {
  const r = jsonResumeToCpwtResume({ basics: { name: 'A' }, projects: [{ name: 'X', roles: [], description: 'Built it' }] });
  assert.doesNotMatch(r.sections[0].items[0].description, /Role:/);
});

test('a role a project already holds counts in no job match, prints no heading and stays out of the file', () => {
  const item = { id: 'p1', name: 'Payments API', role: 'Tech Lead', technologies: '', url: '', description: '<p>Built it</p>' };
  const resume = resumeWith([item]);
  assert.doesNotMatch(extractResumeCorpus(resume), /Tech Lead/);
  assert.equal(entryPrints('projects', { id: 'p2', role: 'Tech Lead' }), false, 'a project holding only a role prints nothing');
  const file = cpwtResumeToJsonResume(resume);
  assert.ok(!JSON.stringify(file.projects).includes('Tech Lead'), JSON.stringify(file.projects));
  // A job's and a volunteer role's role still print and count.
  assert.equal(entryPrints('experience', { id: 'e', role: 'Tech Lead' }), true);
});
