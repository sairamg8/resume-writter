import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STARTER_TEMPLATES, buildResumeFromStarter } from '../../src/utils/starterTemplates.js';

test('STARTER_TEMPLATES: contains valid role starters with personal info and sections', () => {
  assert.ok(STARTER_TEMPLATES.length >= 3);
  for (const t of STARTER_TEMPLATES) {
    assert.ok(t.id, 'starter has id');
    assert.ok(t.name, 'starter has name');
    assert.ok(t.personal.name, 'starter has personal name');
    assert.ok(t.personal.email, 'starter has personal email');
    assert.ok(Array.isArray(t.sections), 'starter has sections array');
    assert.ok(t.sections.some(s => s.type === 'experience'), 'has experience');
    assert.ok(t.sections.some(s => s.type === 'skills'), 'has skills');
  }
});

test('buildResumeFromStarter: creates full resume object with unique ID', () => {
  const resume = buildResumeFromStarter('software-engineer', 'res_123');
  assert.equal(resume.id, 'res_123');
  assert.equal(resume.personal.title, 'Senior Full Stack Engineer');
  assert.ok(resume.sections.length >= 3);
  assert.ok(resume.settings, 'has settings');
  assert.ok(resume.coverLetter, 'has base cover letter');
});

// Every starter printed an empty Skills section: its skills were stored as { id, name }, and the
// editor, the PDF, Word and the exports read a group's `category` and `skills` (bug audit 2026-09-22).
test('every starter’s skills print: its Skills groups hold skills, as the editor writes them', async () => {
  const { skillGroup } = await import('../../src/utils/skills.js');
  for (const t of STARTER_TEMPLATES) {
    const skills = buildResumeFromStarter(t.id, 'r').sections.find((s) => s.type === 'skills');
    const listed = skills.items.flatMap((item) => skillGroup(item).list);
    assert.ok(listed.length >= 6, `${t.id}: ${JSON.stringify(skills.items)}`);
    for (const item of skills.items) assert.equal(item.name, undefined, `${t.id}: no old name label`);
  }
});

// A résumé built from a starter is current data, like a blank one: it was stamped dataVersion 1, so
// the next load ran every migration since — v9 moved the Modern starter's photo text Center → Top.
test('a starter résumé and a JSON Resume import carry the data version this build writes', async () => {
  const { DATA_VERSION } = await import('../../src/utils/dataVersion.js');
  const { jsonResumeToCpwtResume } = await import('../../src/utils/jsonResume.js');
  for (const t of STARTER_TEMPLATES) assert.equal(buildResumeFromStarter(t.id, 'r').dataVersion, DATA_VERSION, t.id);
  assert.equal(jsonResumeToCpwtResume({ basics: { name: 'X' } }).dataVersion, DATA_VERSION);
});
