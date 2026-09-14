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
  assert.equal(dateRange(null, 7), '', 'not text: nothing');
});
