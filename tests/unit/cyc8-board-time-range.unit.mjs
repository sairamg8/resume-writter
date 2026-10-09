// CYC8-S14: a board file from another tool may carry a time as a finite number past +-8.64e15 ms (nanosecond
// stamps). The readers took any finite number, and the issue view called new Date(at).toISOString() on it,
// which throws a RangeError and blanks the dialog. Now the readers refuse a time a Date cannot hold (an
// activity entry with one is left out; a comment's or issue's stamp falls back as a missing one does) and
// the display never throws: isoTime gives undefined and formatDateTime gives ''. Run: yarn test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readActivity, readComment, readIssue } from '../../src/utils/boardReaders.js';
import { formatDateTime, isoTime, relativeTime } from '../../src/utils/uiFormat.js';

const NANOSECONDS = 1.7e18;
const LAST = 8.64e15;

test('an activity entry stamped beyond the Date range is left out, one at the edge is kept', () => {
  const entry = (at) => ({ id: 'a1', kind: 'edited', field: 'title', from: 'A', to: 'B', at });
  assert.equal(readActivity(entry(NANOSECONDS)).kept, null);
  assert.equal(readActivity(entry(NANOSECONDS)).lost, true);
  assert.equal(readActivity(entry(-NANOSECONDS)).kept, null);
  assert.equal(readActivity(entry(LAST)).kept?.at, LAST);
  assert.equal(readActivity(entry(1_700_000_000_000)).kept?.at, 1_700_000_000_000);
});

test('a comment\'s stamps beyond the range fall back as a missing one does', () => {
  const { kept } = readComment({ id: 'c1', text: 'Called back', createdAt: NANOSECONDS, editedAt: NANOSECONDS });
  assert.equal(kept.createdAt, 0);
  assert.equal(kept.editedAt, null);
});

test('an issue\'s stamps beyond the range are read as missing ones', () => {
  const { kept } = readIssue({ id: 'i1', title: 'Write the cover note', createdAt: NANOSECONDS, updatedAt: NANOSECONDS });
  assert.ok(kept);
  for (const at of [kept.createdAt, kept.updatedAt]) {
    assert.ok(Math.abs(at) <= LAST, `${at} is a time a Date holds`);
    assert.doesNotThrow(() => new Date(at).toISOString());
  }
});

test('the display of a time beyond the range does not throw', () => {
  assert.equal(isoTime(NANOSECONDS), undefined);
  assert.equal(isoTime(-NANOSECONDS), undefined);
  assert.equal(formatDateTime(NANOSECONDS), '');
  assert.doesNotThrow(() => relativeTime(NANOSECONDS));
  assert.equal(isoTime(0), '1970-01-01T00:00:00.000Z');
  assert.equal(isoTime(new Date(Date.UTC(2026, 8, 23, 10, 0, 0))), '2026-09-23T10:00:00.000Z');
  assert.equal(isoTime('soon'), undefined);
});
