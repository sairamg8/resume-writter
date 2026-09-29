// R5-HUNT6-GRADUATED-DATE: an education dated in the past tense, "Graduated May 2021", "Class of
// 2020", "May 2020 (Graduated)", was no date. The education took it as its Degree, and the real degree
// went to the description. It now reads as the entry's end date, as "Expected May 2025" does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDateRange, resumeFromText } from '../../src/utils/importText.js';

const range = (text) => { const d = readDateRange(text); return d && [d.start, d.end, d.current]; };

test('a graduation date in the past tense is the end date', () => {
  assert.deepEqual(range('Graduated May 2021'), ['', 'May 2021', false]);
  assert.deepEqual(range('Graduation: 2020'), ['', '2020', false]);
  assert.deepEqual(range('Graduation Date: May 2020'), ['', 'May 2020', false]);
  assert.deepEqual(range('Class of 2020'), ['', '2020', false]);
  assert.deepEqual(range('May 2020 (Graduated)'), ['', 'May 2020', false]);
  assert.deepEqual(range('Aug 2017 – Graduated May 2021'), ['Aug 2017', 'May 2021', false]);
  assert.deepEqual(range('Expected May 2025'), ['', 'May 2025', false]);
});

test('the school keeps its degree and its graduation date', () => {
  const r = resumeFromText('John Smith\n\nEDUCATION\nCarnegie Mellon University\tGraduated May 2021\nB.S. Computer Science\nOhio State University\tClass of 2017\nB.A. Economics');
  const items = r.sections.find((s) => s.type === 'education').items;
  assert.deepEqual(items.map((e) => [e.institution, e.degree, e.startDate, e.endDate, e.description]), [
    ['Carnegie Mellon University', 'B.S. Computer Science', '', 'May 2021', ''],
    ['Ohio State University', 'B.A. Economics', '', '2017', ''],
  ]);
});
