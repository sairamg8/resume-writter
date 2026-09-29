// R5-HUNT5-DOCX-IMPORT-DROPS-NONBREAKING-HYPHEN, review: the Word import now reads <w:noBreakHyphen/> as
// "-", but the same non-breaking hyphen as a character (U+2011, what a PDF of that Word file or text
// pasted from it holds) was still no dash: "2019‑2021" gave the entry no dates, "555‑0100" no phone.
// It, the plain Unicode hyphen (U+2010), the figure dash (U+2012) and the minus sign (U+2212) are dashes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDateRange, resumeFromText } from '../../src/utils/importText.js';

const range = (text) => { const d = readDateRange(text); return d && [d.start, d.end, d.current]; };

test('a range with a Unicode hyphen reads as the range', () => {
  assert.deepEqual(range('2019‑2021'), ['2019', '2021', false]);
  assert.deepEqual(range('Mar 2019 ‐ Present'), ['Mar 2019', '', true]);
  assert.deepEqual(range('2015‒19'), ['2015', '2019', false]);
  assert.deepEqual(range('Jan 2020 − Jun 2021'), ['Jan 2020', 'Jun 2021', false]);
  assert.deepEqual(range('‑ Jun 2021'), ['', 'Jun 2021', false]);
});

test('an entry and a phone typed with a non-breaking hyphen keep their dates and number', () => {
  const r = resumeFromText('Sam Lee\nsam@example.com | 555‑0100\n\nEXPERIENCE\nAcme Corp\t2019‑2021\nEngineer\n• Built things');
  assert.equal(r.personal.phone, '555‑0100');
  const [job] = r.sections.find((s) => s.type === 'experience').items;
  assert.deepEqual([job.company, job.role, job.startDate, job.endDate], ['Acme Corp', 'Engineer', '2019', '2021']);
  assert.deepEqual(r.sections.map((s) => s.type), ['experience']);
});
