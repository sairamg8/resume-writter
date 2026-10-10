// Text import (N1, English only): headings people write that the import did not know — "Academic Qualification" (the
// singular; "Academic Qualifications" was known), "Qualifications", "Professional Skills", "Honours" … — started a custom
// section, so the school or the job under it was no education or experience entry. They name their types now. And an
// education line that ends in a year after a plain space, "University of Leeds 2015" or "BSc Physics, University of
// Leeds 2015", has that year as its start date (a lone date reads as a start, as "2015" alone does) where it is
// unambiguous: the text before it names a school or a degree and does not take a year after it ("Class of 2015").
// Run: node --test tests/unit/525-n1-import-english-headings-and-year.unit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headingType, resumeFromText } from '../../src/utils/importText.js';

test('English heading variants name their section types, the singular "Academic Qualification" among them', () => {
  const want = {
    education: ['Academic Qualification', 'Educational Qualification', 'Qualifications', 'Education Details', 'Academic Details', 'Education and Qualifications'],
    experience: ['Employment Experience', 'Job Experience', 'Relevant Work Experience', 'Professional Employment', 'Work Experience and Internships'],
    skills: ['Professional Skills', 'Key Competencies', 'Soft Skills', 'Computer Skills', 'Skills and Abilities', 'Additional Skills'],
    projects: ['Project Experience', 'Side Projects', 'Open Source Projects'],
    awards: ['Honours', 'Honours and Awards', 'Awards and Recognition', 'Accomplishments'],
    certifications: ['Training and Certifications', 'Courses and Certifications'],
    volunteering: ['Volunteering Experience', 'Volunteer Activities'],
  };
  for (const [type, titles] of Object.entries(want)) for (const title of titles) assert.equal(headingType(title), type, title);
  // Case, punctuation and "&" are read as before.
  assert.equal(headingType('ACADEMIC QUALIFICATION:'), 'education');
  assert.equal(headingType('Honours & Awards'), 'awards');
});

test('the headings the import knew are unchanged', () => {
  for (const [title, type] of [['Professional Experience', 'experience'], ['Work History', 'experience'], ['Technical Skills', 'skills'],
    ['Core Competencies', 'skills'], ['Academic Qualifications', 'education'], ['Education', 'education'], ['References', 'custom']]) {
    assert.equal(headingType(title), type, title);
  }
  assert.equal(headingType('Things I Like'), null, 'an unknown heading is still unknown');
});

const education = (text) => resumeFromText(text).sections.find((s) => s.type === 'education')?.items ?? [];
const head = 'Robin Sample\nrobin.sample@example.com\n\n';

test('a résumé under "ACADEMIC QUALIFICATION" has its school as an education entry', () => {
  const resume = resumeFromText(`${head}ACADEMIC QUALIFICATION\nUniversity of Leeds\t2011 - 2015\nBSc Physics\n`);
  const [s] = resume.sections;
  assert.equal(s.type, 'education');
  assert.deepEqual([s.items[0].institution, s.items[0].degree, s.items[0].startDate, s.items[0].endDate], ['University of Leeds', 'BSc Physics', '2011', '2015']);
});

test('a year after a school\'s name with no dash or comma is its start date', () => {
  const [e] = education(`${head}EDUCATION\nUniversity of Leeds 2015\nBSc Physics\n`);
  assert.deepEqual([e.institution, e.degree, e.startDate, e.endDate, e.current], ['University of Leeds', 'BSc Physics', '2015', '', false]);
});

test('a degree line "BSc Physics, University of Leeds 2015" gives the degree, the school and the year', () => {
  const [e] = education(`${head}EDUCATION\nBSc Physics, University of Leeds 2015\n`);
  assert.deepEqual([e.institution, e.degree, e.startDate, e.endDate], ['University of Leeds', 'BSc Physics', '2015', '']);
});

test('where it is ambiguous the year stays in the text: "Class of 2015", a year after "of", and other sections', () => {
  const [e] = education(`${head}EDUCATION\nUniversity of Leeds, Class of 2015\nBSc Physics\n`);
  assert.equal(e.endDate, '2015', '"Class of 2015" is the graduation year, as before');
  assert.equal(e.startDate, '');
  assert.equal(e.institution, 'University of Leeds');
  // A job is not an education line: its company's "2015" is part of the name.
  const jobs = resumeFromText(`${head}EXPERIENCE\nStudio 2015\tJan 2020 - Present\nDesigner\n`).sections.find((s) => s.type === 'experience');
  assert.equal(jobs.items[0].company, 'Studio 2015');
  assert.equal(jobs.items[0].startDate, 'Jan 2020');
});
