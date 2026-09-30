// R5-HUNT11 review of R5-HUNT11-EDU-SCHOOL-TAB-PLACE-OVER-DEGREE-DATE: a school over its degree's dated
// line is that degree's institution, but only when the dated line names no school, and "High School
// Diploma" read as one (its word "School"). Under another degree's list, "Boston Latin School ⇥ Boston, MA"
// (or the school alone) over "High School Diploma ⇥ June 2021" left the diploma with no institution and
// no place, the school in the entry above's text. A high-school diploma names a degree, no school.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const edu = (r) => (r.sections.find((s) => s.type === 'education')?.items || []).map((e) => [e.institution, e.degree, e.location, e.startDate]);

test('"Boston Latin School ⇥ Boston, MA" over "High School Diploma ⇥ June 2021" under a degree’s list', () => {
  const r = resumeFromText('Pat Lee\npat@x.com\n\nEducation\nHarvard University\tCambridge, MA\nBachelor of Arts in Economics\tMay 2025\n• Dean\'s List\nBoston Latin School\tBoston, MA\nHigh School Diploma\tJune 2021\n');
  assert.deepEqual(edu(r), [
    ['Harvard University', 'Bachelor of Arts in Economics', 'Cambridge, MA', 'May 2025'],
    ['Boston Latin School', 'High School Diploma', 'Boston, MA', 'June 2021'],
  ]);
  assert.doesNotMatch(r.sections[0].items[0].description, /Boston Latin/);
});

test('the school alone over the diploma’s dated line is its institution too', () => {
  const r = resumeFromText('Pat Lee\npat@x.com\n\nEducation\nHarvard University\nBachelor of Arts in Economics\tMay 2025\n• Dean\'s List\nBoston Latin School\nHigh School Diploma\tJune 2021\n');
  assert.deepEqual(edu(r).map((e) => e.slice(0, 2)), [['Harvard University', 'Bachelor of Arts in Economics'], ['Boston Latin School', 'High School Diploma']]);
});
