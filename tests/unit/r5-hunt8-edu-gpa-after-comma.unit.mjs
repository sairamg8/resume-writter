// R5-HUNT8-EDU-GPA-AFTER-COMMA: "B.S. Computer Science, GPA 3.8" under a school's dated line put "GPA 3.8"
// in Field of Study and left the GPA empty; "…; GPA: 3.8" and "… (GPA 3.9)" kept it in the Degree, and
// "…, University of Washington, GPA 3.8" in the school. A GPA after a comma, a semicolon or in brackets
// is the GPA now, and an honour right after it ("…, Cum Laude") goes to the description.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumeFromText } from '../../src/utils/importText.js';

const edu = (text) => resumeFromText(`Jane Doe\n\nEducation\n${text}`).sections.find((s) => s.type === 'education').items[0];
const fields = (e) => [e.institution, e.degree, e.fieldOfStudy, e.gpa];

test('a GPA after the degree on its line is the GPA, not the field of study nor part of the degree', () => {
  for (const [line, degree, gpa] of [
    ['B.S. Computer Science, GPA 3.8', 'B.S. Computer Science', '3.8'],
    ['B.S. in Computer Science, GPA: 3.8/4.0', 'B.S. in Computer Science', '3.8/4.0'],
    ['Bachelor of Science in Computer Science; GPA: 3.8', 'Bachelor of Science in Computer Science', '3.8'],
    ['B.S. Computer Science (GPA 3.9)', 'B.S. Computer Science', '3.9'],
    ['B.S. Computer Science | GPA: 3.8', 'B.S. Computer Science', '3.8'],
  ]) {
    const e = edu(`University of Washington\t2012 – 2016\n${line}`);
    assert.deepEqual(fields(e), ['University of Washington', degree, '', gpa], line);
  }
});

test('an honour after the GPA goes to the description', () => {
  const e = edu('University of Washington\t2012 – 2016\nB.S. Computer Science, GPA: 3.9/4.0, Cum Laude');
  assert.deepEqual(fields(e), ['University of Washington', 'B.S. Computer Science', '', '3.9/4.0']);
  assert.match(e.description, /Cum Laude/);
});

test('a GPA after the school is not part of the school', () => {
  const e = edu('B.S. Computer Science, University of Washington, GPA 3.8\t2012 – 2016');
  assert.deepEqual(fields(e), ['University of Washington', 'B.S. Computer Science', '', '3.8']);
});

test('a degree and its field after a comma still read as before', () => {
  const e = edu('University of Washington\t2012 – 2016\nB.S., Computer Science');
  assert.deepEqual(fields(e), ['University of Washington', 'B.S.', 'Computer Science', '']);
});
