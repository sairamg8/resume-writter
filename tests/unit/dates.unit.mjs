// Unit tests for src/utils/dates.js (no imports there, so Node loads it as it is).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateRange } from '../../src/utils/dates.js';

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
