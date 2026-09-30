// R5-HUNT10-JSON-RESUME-WRITES-UNPRINTED-ENTRIES: Export → JSON Resume wrote entries that print
// nothing — a new Languages row with no language (as a lone fluency "Professional"), a new section's
// blank job, a job with every field's eye off — and counted them in meta.sections. The PDF, Word,
// Markdown and ATS text leave them out (entryPrints); other JSON Resume tools printed a lone
// "Professional" and an empty job. Now only entries that print, in sections that print, are written.
//
// Run: node --test tests/unit/r5-hunt10-jsonresume-unprinted-entries.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpwtResumeToJsonResume } from '../../src/utils/jsonResume.js';

const resumeWith = (sections) => ({
  id: 'r5h10', name: 'Sample', template: 'classic', settings: {},
  personal: { name: 'Maria Lopez', title: 'Engineer', email: 'maria@example.com', summary: '', hiddenFields: [] },
  sections,
});

const JOB_KEYS = ['company', 'role', 'location', 'startDate', 'endDate', 'current', 'description'];

test('a Languages row with no language is not written as a lone "Professional"', () => {
  const file = cpwtResumeToJsonResume(resumeWith([
    { id: 'la', type: 'languages', title: 'Languages', visible: true, settings: {}, items: [
      { id: 'l1', language: '', proficiency: 'Professional' },
    ] },
  ]));
  assert.deepEqual(file.languages, []);
  assert.ok(!file.meta.sections.some((s) => s.type === 'languages'), JSON.stringify(file.meta.sections));
});

test('a blank job and a job with every eye off are not written; a printed job still is', () => {
  const file = cpwtResumeToJsonResume(resumeWith([
    { id: 'ex', type: 'experience', title: 'Experience', visible: true, settings: {}, items: [
      { id: 'e0', company: '', role: '', location: '', startDate: '', endDate: '', current: false, description: '' },
      { id: 'e1', company: 'Initech', role: 'Engineer', startDate: '2020-01', endDate: '2022-01', current: false, description: '<p>Built it.</p>', hiddenFields: JOB_KEYS },
      { id: 'e2', company: 'Globex', role: 'Lead', startDate: '2022-02', current: true, description: '' },
    ] },
  ]));
  assert.equal(file.work.length, 1, JSON.stringify(file.work));
  assert.equal(file.work[0].name, 'Globex');
  const exp = file.meta.sections.find((s) => s.type === 'experience');
  assert.equal(exp.entries, 1);
});

test('a new Experience section holding only its blank entry is left out of the file', () => {
  const file = cpwtResumeToJsonResume(resumeWith([
    { id: 'ex', type: 'experience', title: 'Experience', visible: true, settings: {}, items: [
      { id: 'e0', company: '', role: '', location: '', startDate: '', endDate: '', current: false, description: '' },
    ] },
  ]));
  assert.deepEqual(file.work, []);
  assert.deepEqual(file.meta.sections, []);
});
