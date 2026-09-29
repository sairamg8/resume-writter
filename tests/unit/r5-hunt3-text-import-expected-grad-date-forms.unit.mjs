// R5-HUNT3-TEXT-IMPORT-EXPECTED-GRAD-DATE (review): the first fix read "Expected May 2025" only as a
// prefix on a lone date. "May 2025 (Expected)" and "Expected Graduation Date: May 2025" still became
// the Degree (the real degree went into the description), and "Aug 2021 - Expected May 2025" kept the
// end but put the start date in the description. Each is the entry's dates now.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDateRange, resumeFromText } from '../../src/utils/importText.js';

const education = (text) => resumeFromText(`Jane Doe\njane@x.com\n\nEDUCATION\n${text}`).sections.find((s) => s.type === 'education')?.items || [];

test('an expected date written after the date, or as "Expected Graduation Date:", is the end date', () => {
  for (const [text, start, end] of [['May 2025 (Expected)', '', 'May 2025'], ['2025 (expected)', '', '2025'],
    ['Expected Graduation Date: May 2025', '', 'May 2025'], ['Aug 2021 - Expected May 2025', 'Aug 2021', 'May 2025'],
    ['Aug 2021 – May 2025 (Expected)', 'Aug 2021', 'May 2025']]) {
    const d = readDateRange(text);
    assert.ok(d, text);
    assert.deepEqual([d.start, d.end, d.current], [start, end, false], text);
  }
  assert.equal(readDateRange('May 2025 (Expected)').text, 'May 2025 (Expected)');
});

test('the school, degree and dates of an entry with such a date', () => {
  for (const [date, start] of [['May 2025 (Expected)', ''], ['Expected Graduation Date: May 2025', ''], ['Aug 2021 - Expected May 2025', 'Aug 2021']]) {
    const [e] = education(`University of Oregon\t${date}\nB.S. Computer Science\n`);
    assert.deepEqual([e.institution, e.degree, e.startDate, e.endDate, e.current, e.description || ''],
      ['University of Oregon', 'B.S. Computer Science', start, 'May 2025', false, ''], date);
  }
});
