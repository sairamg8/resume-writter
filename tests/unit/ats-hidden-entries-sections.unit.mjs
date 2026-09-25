// R1-LEFT-d (seen by the sections cluster in Round 1, not filed): the ATS Check counted a section whose
// entries are all hidden — or that has none — as present. Since R2-057 such a section prints nothing
// (sectionPrints in src/templates/pdf/shared/PdfSections.jsx): no heading in the PDF or the preview,
// and none in Word, Markdown or the ATS text. Yet "Work Experience section present", "Education
// section present" and "Skills section present" still passed, worth 16 of the 20 heading points. They
// now read the sections as they print: one with no shown entry is missing, as a parser finds it.
//
// Run: node --test tests/unit/ats-hidden-entries-sections.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeAtsScore } from '../../src/utils/atsChecker.js';
import { generateAtsPlainText } from '../../src/utils/atsPlainText.js';

const sample = ({ hideExp = false, hideEdu = false, hideSkills = false, emptyEdu = false } = {}) => ({
  id: 'ats_hidden_entries', name: 'Sample', template: 'classic', settings: {},
  personal: { name: 'Pat Sample', title: 'Engineer', email: 'pat@example.com', phone: '+1 555 0100' },
  sections: [
    { id: 'exp', type: 'experience', title: 'Experience', visible: true, items: [
      { id: 'e1', company: 'Northwind Traders', role: 'Staff Engineer', startDate: '2021-01', current: true, visible: !hideExp,
        bullets: ['Built a billing service handling 10k requests per second.'] },
      { id: 'e2', company: 'Fabrikam Studio', role: 'Web Developer', startDate: '2017-06', endDate: '2020-12', visible: !hideExp },
    ] },
    { id: 'edu', type: 'education', title: 'Education', visible: true, items: emptyEdu ? [] : [
      { id: 'd1', institution: 'State University', degree: 'B.S.', fieldOfStudy: 'Computer Science', endDate: '2017-05', visible: !hideEdu },
    ] },
    { id: 'sk', type: 'skills', title: 'Skills', visible: true, items: [
      { id: 's1', category: 'Languages', skills: 'Go, Python', visible: !hideSkills },
    ] },
  ],
});

const headings = (r) => Object.fromEntries(analyzeAtsScore(r).categories.headings.items.map((i) => [i.id, i]));

test('every section with a shown entry: each is present (the guard)', () => {
  const h = headings(sample());
  for (const id of ['has_exp', 'has_edu', 'has_skills']) assert.equal(h[id].status, 'pass', id);
});

test('a section whose entries are all hidden prints nothing, and scores as missing', () => {
  for (const [opt, id, heading] of [['hideExp', 'has_exp', 'EXPERIENCE'], ['hideEdu', 'has_edu', 'EDUCATION'], ['hideSkills', 'has_skills', 'SKILLS']]) {
    const r = sample({ [opt]: true });
    assert.doesNotMatch(generateAtsPlainText(r), new RegExp(`^${heading}`, 'm'), `the ATS text leaves ${heading} out`);
    assert.equal(headings(r)[id].status, 'fail', `${id}: every entry hidden`);
  }
  const full = analyzeAtsScore(sample()).categories.headings.score;
  assert.equal(analyzeAtsScore(sample({ hideExp: true })).categories.headings.score, full - 6, 'its 6 points go');
});

test('a section with no entries at all scores as missing too', () => {
  assert.equal(headings(sample({ emptyEdu: true })).has_edu.status, 'fail');
});

test('one shown entry is enough', () => {
  const r = sample();
  r.sections[0].items[1].visible = false;
  assert.equal(headings(r).has_exp.status, 'pass');
});
