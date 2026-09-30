// R5-HUNT11-EDU-SCHOOL-TAB-PLACE-OVER-DEGREE-DATE: the standard US student layout, "School ⇥ City, ST"
// over "Degree ⇥ Date", left the institution empty (the school went into the description) and gave the
// degree the next school, or a "Relevant Coursework: …" line, as its institution. The school over its
// degree's dated line is its entry's institution now, its place the location.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const items = (r, type) => r.sections.find((s) => s.type === type)?.items || [];
const edu = (r) => items(r, 'education').map((e) => [e.institution, e.location, e.degree, e.startDate, e.endDate]);

test('two schools, each "School ⇥ City, ST" over "Degree ⇥ Date", are two entries with their own school', () => {
  const r = resumeFromText('Taylor Brooks\ntb@x.edu\n\nEDUCATION\nHarvard University\tCambridge, MA\nBachelor of Arts in Economics\tMay 2025\nUniversity of Oxford\tOxford, UK\nStudy Abroad Program\tJan 2024 – May 2024\n');
  assert.deepEqual(edu(r), [
    ['Harvard University', 'Cambridge, MA', 'Bachelor of Arts in Economics', 'May 2025', ''],
    ['University of Oxford', 'Oxford, UK', 'Study Abroad Program', 'Jan 2024', 'May 2024'],
  ]);
  assert.equal(items(r, 'education')[0].description, '');
});

test('a "Relevant Coursework: …" line under the degree is its text, not its school', () => {
  const r = resumeFromText('Taylor Brooks\ntb@x.edu\n\nEDUCATION\nHarvard University\tCambridge, MA\nBachelor of Arts in Economics\tMay 2025\nRelevant Coursework: Econometrics, Game Theory\n\nSKILLS\nPython\n');
  assert.deepEqual(edu(r), [['Harvard University', 'Cambridge, MA', 'Bachelor of Arts in Economics', 'May 2025', '']]);
  assert.match(items(r, 'education')[0].description, /Relevant Coursework: Econometrics, Game Theory/);
});

test('one school alone keeps its school and place', () => {
  const r = resumeFromText('Taylor Brooks\ntb@x.edu\n\nEDUCATION\nHarvard University\tCambridge, MA\nBachelor of Arts in Economics\tMay 2025\n');
  assert.deepEqual(edu(r), [['Harvard University', 'Cambridge, MA', 'Bachelor of Arts in Economics', 'May 2025', '']]);
});

test('a school alone over its degree, with a coursework line, then the next school the same way', () => {
  const r = resumeFromText('Taylor Brooks\ntb@x.edu\n\nEDUCATION\nHarvard University\nBachelor of Arts in Economics\tMay 2025\nRelevant Coursework: Econometrics, Game Theory\nUniversity of Oxford\nMaster of Science in Finance\t2025 – 2026\n');
  assert.deepEqual(edu(r).map((e) => [e[0], e[2]]), [['Harvard University', 'Bachelor of Arts in Economics'], ['University of Oxford', 'Master of Science in Finance']]);
  assert.match(items(r, 'education')[0].description, /Relevant Coursework/);
});

test('"School ⇥ Date" over "Degree ⇥ City, ST" still reads as before', () => {
  const r = resumeFromText('Pat Lee\npat@x.com\n\nEDUCATION\nStanford University\t2018 – 2020\nMaster of Science\tStanford, CA\nUniversity of Oregon\t2014 – 2018\nBachelor of Science\nGPA: 3.9\n');
  assert.deepEqual(edu(r), [['Stanford University', 'Stanford, CA', 'Master of Science', '2018', '2020'], ['University of Oregon', '', 'Bachelor of Science', '2014', '2018']]);
});
