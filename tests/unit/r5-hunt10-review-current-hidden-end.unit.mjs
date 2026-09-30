// R5-HUNT10-REVIEW-CURRENT-HIDDEN-END-PRINTS: entryPrints counted a current role's `current: true` as
// its "Present" even with the End Date's eye off, where the PDF, Word and Markdown print no end
// (endDateOf). The job editor's eyes are Company, Job Title, Location, Start Date, End Date and
// Description (`current` has none of its own), so a current job with every eye off still "printed":
// the PDF and Word drew the section's heading over nothing (Markdown, whose body is empty, left it
// out), the ATS Check counted the section present, and Export -> JSON Resume wrote
// it as an empty job, which R5-HUNT10-JSON-RESUME-WRITES-UNPRINTED-ENTRIES meant to leave out.
//
// Run: node --test tests/unit/r5-hunt10-review-current-hidden-end.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { entryPrints, sectionPrints } from '../../src/utils/entryPrints.js';
import { endDateOf } from '../../src/utils/dates.js';
import { cpwtResumeToJsonResume } from '../../src/utils/jsonResume.js';
import { generateMarkdownResume } from '../../src/utils/markdownExport.js';

const EYES = ['company', 'role', 'location', 'startDate', 'endDate', 'description'];
const job = (extra) => ({ id: 'e1', company: 'Globex', role: 'Lead', location: 'Austin', startDate: '2022-02', endDate: '', current: true, description: '<p>Led it.</p>', bullets: [], ...extra });
const experience = (items) => ({ id: 'ex', type: 'experience', title: 'Experience', visible: true, settings: {}, items });
const resumeWith = (sections) => ({
  id: 'r5h10r', name: 'Sample', template: 'classic', settings: {},
  personal: { name: 'Maria Lopez', title: 'Engineer', email: 'maria@example.com', summary: '', hiddenFields: [] },
  sections,
});

test('the job editor offers exactly these eyes, and a current role with its End Date eye off prints no end (the premise)', () => {
  const editor = readFileSync(new URL('../../src/components/SectionEditorEntryItems.jsx', import.meta.url), 'utf8');
  const start = editor.indexOf('field="company"');
  const fields = [...editor.slice(start, editor.indexOf('field="description"', start) + 20).matchAll(/field="(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(fields, EYES);
  assert.equal(endDateOf(job({ hiddenFields: ['endDate'] }), {}), '');
  assert.equal(endDateOf(job(), {}), 'Present');
});

test('a current job with every eye off prints nothing', () => {
  const item = job({ hiddenFields: EYES });
  assert.equal(entryPrints('experience', item), false);
  assert.equal(sectionPrints(experience([item])), false);
});

test('a current job with every eye off is not written to the JSON Resume file, nor headed in Markdown', () => {
  const r = resumeWith([experience([job({ hiddenFields: EYES })])]);
  const file = cpwtResumeToJsonResume(r);
  assert.deepEqual(file.work, [], JSON.stringify(file.work));
  assert.deepEqual(file.meta.sections.map((s) => [s.type, s.entries]), [['experience', 0]]);
  const md = generateMarkdownResume(r);
  assert.ok(!md.includes('Experience'), md);
});

test('a current role still prints its "Present" alone while its End Date is shown', () => {
  const onlyPresent = job({ hiddenFields: EYES.filter((k) => k !== 'endDate') });
  assert.equal(entryPrints('experience', onlyPresent), true);
  assert.equal(entryPrints('experience', job({ company: '', role: '', location: '', startDate: '', description: '' })), true);
  assert.equal(cpwtResumeToJsonResume(resumeWith([experience([onlyPresent])])).work.length, 1);
  assert.equal(entryPrints('experience', job({ current: false, hiddenFields: EYES })), false);
});
