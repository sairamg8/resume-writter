// R5-HUNT12-LINKEDIN-DEGREE-ABBR-FIELD: LinkedIn's "Save to PDF" prints a degree with a short form as
// "Bachelor of Science - BS, Computer Science · (2012 - 2016)". The field of study was left empty and
// "BS, Computer Science" became the education's description. The field after the short form is the
// field of study now, and the short form alone is the degree's, no stray paragraph.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const schools = (r) => (r.sections.find((s) => s.type === 'education')?.items || [])
  .map((e) => [e.institution, e.degree, e.fieldOfStudy, e.startDate, e.endDate, e.description]);

test('LinkedIn’s "Degree - ABBR, Field · (years)": the degree, its field of study, no description', () => {
  const r = resumeFromText('Jane Doe\njane@doe.com\n\nEducation\nUniversity of Washington\nBachelor of Science - BS, Computer Science · (2012 - 2016)\nStanford University Graduate School of Business\nMaster of Business Administration - MBA, Finance · (2018 - 2020)\nHarvard University\nMaster of Science - MS · (2010 - 2011)\nYale University\nBachelor\'s degree, Economics · (2008 - 2011)\n');
  assert.deepEqual(schools(r), [
    ['University of Washington', 'Bachelor of Science', 'Computer Science', '2012', '2016', ''],
    ['Stanford University Graduate School of Business', 'Master of Business Administration', 'Finance', '2018', '2020', ''],
    ['Harvard University', 'Master of Science', '', '2010', '2011', ''],
    ['Yale University', 'Bachelor\'s degree', 'Economics', '2008', '2011', ''],
  ]);
});
