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
