// Defect: a job file from another tool may hold a time no Date holds (nanoseconds: 1.7e18). The job page's
// Application History printed 'Invalid Date' for such a status change (historyLabels let any finite number
// through, after J-19 had dropped text), and 'Created' / 'Updated' read "3.1e+285y ago" or similar
// (relativeTime). Both now leave such a time out, as an unreadable one: no line, an empty word.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historyLabels } from '../../src/utils/jobQuery.js';
import { relativeTime } from '../../src/utils/uiFormat.js';

test('a status change with a time no Date holds is listed with no time, not printed as Invalid Date', () => {
  const list = historyLabels([
    { status: 'saved', changedAt: 1760000000000 },
    { status: 'applied', changedAt: 1.76e18 },
    { status: 'offer', changedAt: -1e300 },
    { status: 'rejected', changedAt: 8.64e15 },
  ]);
  assert.deepEqual(list.map((e) => e.at), [1760000000000, null, null, 8.64e15]);
  assert.equal(new Date(list[3].at).toLocaleString().includes('Invalid'), false, 'the largest time a Date holds still prints');
});

test('relativeTime of a time no Date holds is empty, and of a real one is unchanged', () => {
  const now = new Date(1760000000000);
  assert.equal(relativeTime(1.76e18, now), '');
  assert.equal(relativeTime(-1e300, now), '');
  assert.equal(relativeTime(Infinity, now), '');
  assert.equal(relativeTime(1760000000000 - 3 * 86400000, now), '3d ago');
  assert.equal(relativeTime(1760000000000 + 3 * 86400000, now), 'in 3d');
});
