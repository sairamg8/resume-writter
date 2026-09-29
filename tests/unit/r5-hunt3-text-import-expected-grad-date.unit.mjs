// R5-HUNT3-TEXT-IMPORT-EXPECTED-GRAD-DATE: a graduation date written "Expected May 2025" (or
// "Anticipated May 2025", "Expected 2025") was no date to the text import, which the PDF and Word
// imports share. The education line then had no date, "Expected May 2025" became the Degree and the
// real degree on the next line went into the description. It is the entry's end date now.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDateRange, resumeFromText } from '../../src/utils/importText.js';

const education = (text) => resumeFromText(text).sections.find((s) => s.type === 'education')?.items || [];

test('"Expected May 2025" beside the school is the end date, and the degree under it the degree', () => {
  const [e] = education('Jane Doe\njane@x.com\n\nEDUCATION\nUniversity of Oregon\tExpected May 2025\nB.S. Computer Science\n');
  assert.equal(e.institution, 'University of Oregon');
  assert.equal(e.degree, 'B.S. Computer Science');
  assert.equal(e.startDate, '');
  assert.equal(e.endDate, 'May 2025');
  assert.equal(e.current, false);
  assert.doesNotMatch(e.description || '', /Computer Science|Expected/);
});

test('"Expected", "Anticipated" and "Expected graduation:" read as an end date', () => {
  for (const [text, end] of [['Expected May 2025', 'May 2025'], ['Expected 2025', '2025'], ['Anticipated May 2025', 'May 2025'],
    ['expected graduation: 05/2025', '05/2025'], ['(Expected Dec 2026)', 'Dec 2026']]) {
    const d = readDateRange(text);
    assert.ok(d, text);
    assert.deepEqual([d.start, d.end, d.current], ['', end, false], text);
  }
});

test('a school with a trailing "Expected" date keeps its name', () => {
  const [e] = education('Jane Doe\njane@x.com\n\nEDUCATION\nB.S. Computer Science, University of Oregon, Expected 2025\n');
  assert.equal(e.institution, 'University of Oregon');
  assert.equal(e.degree, 'B.S. Computer Science');
  assert.equal(e.endDate, '2025');
});

test('dates written as before read as before', () => {
  assert.deepEqual(readDateRange('2019 - 2021'), { start: '2019', end: '2021', current: false, text: '2019 - 2021' });
  assert.deepEqual(readDateRange('- Present'), { start: '', end: '', current: true, text: '- Present' });
  assert.equal(readDateRange('Expected results'), null);
});
