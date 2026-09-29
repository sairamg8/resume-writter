// R5-HUNT6-BLANK-SECTION-HEADING (review): the PDF and Word now leave out a section whose entries are
// all blank — one just added, or whose fields are all hidden with their eyes — heading and all
// (sectionPrints, entryPrints). The ATS Check reads the sections as they print (R1-LEFT-d, R4-CL-11,
// R5-HUNT1), but still asked only whether an entry was shown: a just-added blank Education section
// passed "Education section present" though the page has no such heading, its non-standard title was
// flagged (and renamed by the fix button), and its title matched a job posting's keyword. Now the
// report, its heading fix and the job match use the PDF's own rule. Fictional data only.
//
// Run: node --test tests/unit/r5-hunt6-review-ats-blank-section.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAtsScore, matchResumeWithJob, standardizeSectionsForAts } from '../../src/utils/atsChecker.js';

// As Add Section → Education makes it (SECTION_TYPE_DEFAULTS): one entry, every field empty.
const blankEducation = (title = 'Education') => ({
  id: 'edu', type: 'education', title, visible: true, settings: {},
  items: [{ id: 'edu_item1', institution: '', degree: '', fieldOfStudy: '', location: '', startDate: '', endDate: '', gpa: '', description: '', bullets: [] }],
});

const sample = (...extra) => ({
  id: 'r5h6', name: 'Sample', template: 'classic', settings: {},
  personal: { name: 'Robin Vale', title: 'Staff Engineer', email: 'robin.vale@example.com', summary: '', hiddenFields: [] },
  sections: [
    { id: 'exp', type: 'experience', title: 'Experience', visible: true, settings: {}, items: [
      { id: 'e1', company: 'Fabrikam Studio', role: 'Lead Engineer', startDate: '2020-01', current: true, description: '<p>Built the ledger service.</p>' },
    ] },
    ...extra,
  ],
});

const headings = (r) => Object.fromEntries(analyzeAtsScore(r).categories.headings.items.map((i) => [i.id, i]));

test('a just-added blank Education section prints no heading, so it scores as missing', () => {
  assert.equal(headings(sample(blankEducation())).has_edu.status, 'fail');
});

test('a Skills group with both eyes off prints nothing either, so Skills scores as missing', () => {
  const skills = { id: 'sk', type: 'skills', title: 'Skills', visible: true, settings: {},
    items: [{ id: 's1', category: 'Languages', skills: 'Go, Python', hiddenFields: ['category', 'skills'] }] };
  assert.equal(headings(sample(skills)).has_skills.status, 'fail');
  // The guard: one eye on, and it prints.
  skills.items[0].hiddenFields = ['category'];
  assert.equal(headings(sample(skills)).has_skills.status, 'pass');
});

test('a blank section with a non-standard title is neither flagged nor renamed', () => {
  const sections = sample(blankEducation('My College')).sections;
  const item = headings(sample(blankEducation('My College'))).std_headings;
  assert.equal(item.status, 'pass', item.detail);
  const out = standardizeSectionsForAts(sections, 'classic');
  sections.forEach((s, i) => assert.equal(out[i], s, `${s.title} is untouched`));
});

test("a blank section's title adds nothing to the job match", () => {
  const custom = { id: 'cu', type: 'custom', title: 'Kubernetes Projects', visible: true, settings: {},
    items: [{ id: 'c1', title: '', subtitle: '', date: '', location: '', description: '<p></p>', bullets: [] }] };
  const m = matchResumeWithJob(sample(custom), 'Kubernetes Kubernetes Kubernetes. Ledger.');
  assert.ok(m.missingKeywords.includes('Kubernetes'), JSON.stringify(m));
  assert.ok(m.matchedKeywords.includes('Ledger'), JSON.stringify(m));
});

test('once its entry holds text, the section is present, judged and matched (the guard)', () => {
  const edu = blankEducation('My College');
  edu.items[0].institution = 'State University';
  const h = headings(sample(edu));
  assert.equal(h.has_edu.status, 'pass');
  assert.match(h.std_headings.detail, /"My College" → "Education"/);
  const custom = { id: 'cu', type: 'custom', title: 'Kubernetes Projects', visible: true, settings: {}, items: [{ id: 'c1', title: 'Cluster tooling' }] };
  assert.ok(matchResumeWithJob(sample(custom), 'Kubernetes Kubernetes Kubernetes.').matchedKeywords.includes('Kubernetes'));
});
