// R5-HUNT1-text-import-education-degree-comma-school: an education line typed "Degree Subject, School"
// ("BSc Computer Science, Stanford University, 2013 - 2017") read the school as the field of study and
// left the institution empty, and "School, Degree Subject" read the whole line as the school. With no
// school found elsewhere, the half after a degree that names its subject is the school now, and a
// school's line split at its comma gives the degree after it. A degree and its field ("B.S., Computer
// Science", "Master of Science, Computer Science") and a grade after the comma keep their reading.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const schools = (r) => (r.sections.find((s) => s.type === 'education')?.items || [])
  .map((e) => [e.degree, e.fieldOfStudy, e.institution]);
const one = (line) => schools(resumeFromText(`Jane Doe\njane@x.com\n\nEDUCATION\n${line}\n`))[0];

test('"Degree Subject, School" gives the school', () => {
  assert.deepEqual(one('BSc Computer Science, Stanford University, 2013 - 2017'), ['BSc Computer Science', '', 'Stanford University']);
  assert.deepEqual(one('B.S. Computer Science, Georgia Tech, 2013 - 2017'), ['B.S. Computer Science', '', 'Georgia Tech']);
  assert.deepEqual(one('BSc in Computer Science, MIT, 2013 - 2017'), ['BSc in Computer Science', '', 'MIT']);
});

test('"School, Degree Subject" gives the degree', () => {
  assert.deepEqual(one('Massachusetts Institute of Technology, BSc Computer Science, 2013 - 2017'), ['BSc Computer Science', '', 'Massachusetts Institute of Technology']);
});

test('a degree and its field, and a grade after the comma, read as before', () => {
  assert.deepEqual(one('Master of Science, Computer Science, 2013 - 2017'), ['Master of Science', 'Computer Science', '']);
  assert.deepEqual(one('Stanford University\t2013 - 2017\nB.S., Computer Science'), ['B.S.', 'Computer Science', 'Stanford University']);
  assert.deepEqual(one('BSc Computer Science, First Class Honours\t2013 - 2017\nStanford University'), ['BSc Computer Science', 'First Class Honours', 'Stanford University']);
  assert.deepEqual(one('University of California, Berkeley\t2013 - 2017\nBSc Computer Science'), ['BSc Computer Science', '', 'University of California, Berkeley']);
});
