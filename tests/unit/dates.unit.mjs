// Unit tests for src/utils/dates.js (no imports there, so Node loads it as it is).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dateRange, DATE_FORMATS, DEFAULT_DATE_FORMAT, dateFormatOf, dateLabels, formatDate, formatDayDate, parseDayDate,
  parseMonthYear, presentLabel,
} from '../../src/utils/dates.js';

test('dateRange: "start – end", either alone, an end alone keeps its dash (R2-7)', () => {
  assert.equal(dateRange('05/2023', '05/2026'), '05/2023 – 05/2026');
  assert.equal(dateRange('05/2023', ''), '05/2023');
  assert.equal(dateRange('', '03/2027'), '– 03/2027');
  assert.equal(dateRange(undefined, undefined), '');
  assert.equal(dateRange('  05/2023 ', ' 05/2026 '), '05/2023 – 05/2026', 'trimmed');
});

test('dateRange: a year imported as a number prints as written; other values are nothing (R9-1)', () => {
  assert.equal(dateRange(2019, 2021), '2019 – 2021');
  assert.equal(dateRange(null, 7), '– 7');
  assert.equal(dateRange(2019, '  '), '2019');
  assert.equal(dateRange({}, NaN), '', 'not a date: nothing');
  assert.equal(dateRange(true, ['2020']), '', 'not a date: nothing');
});

// ── Design → Date format (PAR-06) ─────────────────────────────────────────────
const as = (dateFormat) => ({ dateFormat });

test('parseMonthYear: every month-and-year shape the picker and imports store; nothing else', () => {
  const jan24 = { y: 2024, m: 1 };
  for (const v of ['Jan 2024', 'January 2024', 'jan 2024', 'JANUARY 2024', 'Jan. 2024', 'Jan, 2024', ' Jan  2024 ',
    '01/2024', '1/2024', '01.2024', '1.2024', '01-2024', '01 / 2024', '2024-01', '2024-1', '2024/01', '2024.01']) {
    assert.deepEqual(parseMonthYear(v), jan24, v);
  }
  assert.deepEqual(parseMonthYear('Sept 2021'), { y: 2021, m: 9 });
  assert.deepEqual(parseMonthYear('Sep 2021'), { y: 2021, m: 9 });
  assert.deepEqual(parseMonthYear('2019'), { y: 2019, m: null }, 'a year alone');
  assert.deepEqual(parseMonthYear(2019), { y: 2019, m: null }, 'a year imported as a number');
  for (const v of ['', '  ', 'Jan', 'Present', 'Summer 2020', '13/2024', '0/2024', '2024-13', 'Janu 2024', 'Mayo 2024',
    '2019 – 2021', '2019-2021', '15/01/2024', '2024-01-15', '24', 7, 2019.5, 12345, NaN, null, undefined, {}, ['2020'], true]) {
    assert.equal(parseMonthYear(v), null, JSON.stringify(v));
  }
});

test('the formats: As entered is the default and first; FlowCV\'s month-year presets follow', () => {
  assert.equal(DEFAULT_DATE_FORMAT, 'asEntered');
  assert.deepEqual(DATE_FORMATS, ['asEntered', 'MMM YYYY', 'MMMM YYYY', 'MM/YYYY', 'MM.YYYY', 'YYYY-MM', 'YYYY.MM', 'YYYY']);
  assert.equal(dateFormatOf(undefined), 'asEntered');
  assert.equal(dateFormatOf({}), 'asEntered', 'a résumé saved before PAR-06');
  assert.equal(dateFormatOf(as('DD MMM YYYY')), 'asEntered', 'a format a newer build stored');
  assert.equal(dateFormatOf(as('toString')), 'asEntered', 'not an Object.prototype key');
  assert.equal(dateFormatOf(as('MM/YYYY')), 'MM/YYYY');
});

test('formatDate: each format, for every stored shape of March 2023', () => {
  const shapes = ['Mar 2023', 'March 2023', '03/2023', '3/2023', '03.2023', '2023-03'];
  const want = {
    'MMM YYYY': 'Mar 2023', 'MMMM YYYY': 'March 2023', 'MM/YYYY': '03/2023', 'MM.YYYY': '03.2023',
    'YYYY-MM': '2023-03', 'YYYY.MM': '2023.03', YYYY: '2023',
  };
  for (const [format, printed] of Object.entries(want)) {
    for (const v of shapes) assert.equal(formatDate(v, as(format)), printed, `${format}: ${v}`);
    assert.equal(formatDate('2023', as(format)), '2023', `${format}: a year alone is the year`);
    assert.equal(formatDate(2023, as(format)), '2023', `${format}: a number year`);
  }
});

test('formatDate: As entered, no settings and free text print as stored (trimmed; numbers as written)', () => {
  for (const settings of [undefined, {}, as('asEntered'), as('bogus')]) {
    for (const v of ['Mar 2023', '03/2023', '2023-03', 'Summer 2020']) assert.equal(formatDate(v, settings), v);
    assert.equal(formatDate(' Mar 2023 ', settings), 'Mar 2023');
    assert.equal(formatDate(2019, settings), '2019');
    assert.equal(formatDate(7, settings), '7');
  }
  for (const format of DATE_FORMATS) {
    for (const v of ['Summer 2020', 'Present', 'Jan', '13/2024', 'Q3 2021']) assert.equal(formatDate(v, as(format)), v, `${format}: ${v}`);
    assert.equal(formatDate('', as(format)), '');
    assert.equal(formatDate('   ', as(format)), '');
    assert.equal(formatDate({}, as(format)), '', 'not a date: nothing');
    assert.equal(formatDate(7, as(format)), '7', 'a number that is not a year: as written');
  }
});

test('dateRange(start, end, settings): both sides in the format, the old range rule unchanged', () => {
  assert.equal(dateRange('Jan 2020', 'Mar 2023', as('MM/YYYY')), '01/2020 – 03/2023');
  assert.equal(dateRange('Jan 2020', 'Mar 2023', as('MMMM YYYY')), 'January 2020 – March 2023');
  assert.equal(dateRange('Jan 2020', 'Mar 2023', as('YYYY')), '2020 – 2023');
  assert.equal(dateRange('05/2023', presentLabel(as('YYYY-MM')), as('YYYY-MM')), '2023-05 – Present');
  assert.equal(dateRange('', '03/2027', as('MMM YYYY')), '– Mar 2027');
  assert.equal(dateRange('2019-05', '  ', as('MM.YYYY')), '05.2019');
  assert.equal(dateRange('Jan 2020', 'Mar 2023'), 'Jan 2020 – Mar 2023', 'no settings: as stored');
});

test('dateLabels / presentLabel: English — the résumé language (PAR-03) extends them', () => {
  assert.equal(presentLabel(), 'Present');
  assert.equal(presentLabel(as('MM/YYYY')), 'Present');
  assert.equal(dateLabels().months.length, 12);
  assert.equal(dateLabels().monthsShort[8], 'Sep', 'the picker\'s abbreviation');
});

test('parseDayDate: an ISO day and the Today button\'s words; never an ambiguous or impossible day', () => {
  assert.deepEqual(parseDayDate('2026-01-15'), { y: 2026, m: 1, d: 15 });
  assert.deepEqual(parseDayDate('15 January 2026'), { y: 2026, m: 1, d: 15 });
  assert.deepEqual(parseDayDate(' 5 Jan 2026 '), { y: 2026, m: 1, d: 5 });
  assert.deepEqual(parseDayDate('29 February 2024'), { y: 2024, m: 2, d: 29 });
  for (const v of ['2026-02-31', '31 April 2026', '29 February 2026', '15/01/2026', '01.15.2026', 'January 15, 2026',
    '15 Janvier 2026', 'Jan 2026', '2026-1-5', '', null, 20260115]) {
    assert.equal(parseDayDate(v), null, JSON.stringify(v));
  }
});

test('formatDayDate: the cover letter\'s date, day first, in each format; As entered keeps the old rule', () => {
  const want = {
    asEntered: ['15 January 2026', '15 January 2026', '15 Jan 2026'],
    'MMM YYYY': ['15 Jan 2026', '15 Jan 2026', '15 Jan 2026'],
    'MMMM YYYY': ['15 January 2026', '15 January 2026', '15 January 2026'],
    'MM/YYYY': ['15/01/2026', '15/01/2026', '15/01/2026'],
    'MM.YYYY': ['15.01.2026', '15.01.2026', '15.01.2026'],
    'YYYY-MM': ['2026-01-15', '2026-01-15', '2026-01-15'],
    'YYYY.MM': ['2026.01.15', '2026.01.15', '2026.01.15'],
    YYYY: ['15 January 2026', '15 January 2026', '15 Jan 2026'],
  };
  for (const [format, printed] of Object.entries(want)) {
    assert.deepEqual(['2026-01-15', '15 January 2026', '15 Jan 2026'].map((v) => formatDayDate(v, as(format))), printed, format);
    for (const v of ['Monday', '2026-02-31', '15/01/2026']) assert.equal(formatDayDate(v, as(format)), v, `${format}: ${v}`);
  }
  assert.equal(formatDayDate('2026-01-05'), '5 January 2026', 'no settings: the letter\'s rule before PAR-06');
  assert.equal(formatDayDate(undefined), '');
});
