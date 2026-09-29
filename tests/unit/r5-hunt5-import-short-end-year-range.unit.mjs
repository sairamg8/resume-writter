// R5-HUNT5-IMPORT-SHORT-END-YEAR-RANGE-MISREAD: an academic year with a two-digit end year. "2019–21"
// (an en dash) was no date, so it became the Degree and the next school went into the first one's
// description; "2019-21" read as the impossible month 21 of 2019, its end lost. Both now read as 2019
// to 2021. "2011-12" stays December 2011: the app's own YYYY-MM Date format prints it so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDateRange, resumeFromText } from '../../src/utils/importText.js';

const range = (text) => { const d = readDateRange(text); return d && [d.start, d.end, d.current]; };

test('a two-digit end year after a dash is the end year', () => {
  assert.deepEqual(range('2019–21'), ['2019', '2021', false]);
  assert.deepEqual(range('2019-21'), ['2019', '2021', false]);
  assert.deepEqual(range('2015 – 19'), ['2015', '2019', false]);
  assert.deepEqual(range('2011–12'), ['2011', '2012', false]);
});

test('YYYY-MM is still a month, and an end year before the start is no range', () => {
  assert.deepEqual(range('2011-12'), ['2011-12', '', false]);
  assert.deepEqual(range('2021-03'), ['2021-03', '', false]);
  assert.equal(readDateRange('2019–05'), null);
});

test('each school with an academic-year range is an entry of its own', () => {
  const r = resumeFromText('Priya Shah\npriya@mail.com\n\nEDUCATION\nUniversity of Leeds\t2019–21\nMSc Data Science\nUniversity of Pune\t2015–19\nBEng Computer Engineering');
  const items = r.sections.find((s) => s.type === 'education').items;
  assert.deepEqual(items.map((e) => [e.institution, e.degree, e.startDate, e.endDate]), [
    ['University of Leeds', 'MSc Data Science', '2019', '2021'],
    ['University of Pune', 'BEng Computer Engineering', '2015', '2019'],
  ]);
});
