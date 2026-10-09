// Defect: the demo job's deadline was dated from now + 120 hours, but a day is 23 or 25 hours long
// across a daylight-saving change, so near midnight it landed a calendar day off: six days ahead
// in Los Angeles in the week before the March change, four days ahead in Auckland in the week before
// the April one. It is now five calendar days on, in every time zone. The zone is set per case, as
// board-model.unit.mjs does. Run: yarn test:unit
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { demoJobs } from '../../src/utils/jobEdits.js';

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ; else process.env.TZ = ORIGINAL_TZ;
});

test('demoJobs: the deadline is five calendar days ahead across a daylight-saving change, late in the evening', () => {
  process.env.TZ = 'America/Los_Angeles';
  // 5 Mar 23:30 PST; the clocks go forward on 8 Mar, so 120 hours later is 11 Mar 00:30.
  assert.equal(demoJobs(new Date(2026, 2, 5, 23, 30))[0].deadline, '2026-03-10');
});

test('demoJobs: the deadline is five calendar days ahead across a daylight-saving change, just after midnight', () => {
  process.env.TZ = 'Pacific/Auckland';
  // 1 Apr 00:30 NZDT; the clocks go back on 5 Apr, so 120 hours later is 5 Apr 23:30.
  assert.equal(demoJobs(new Date(2026, 3, 1, 0, 30))[0].deadline, '2026-04-06');
});

test('demoJobs: an ordinary day, a month end and a year end, in zones either side of UTC', () => {
  for (const tz of ['Asia/Kolkata', 'Pacific/Auckland', 'America/Los_Angeles']) {
    process.env.TZ = tz;
    assert.equal(demoJobs(new Date(2026, 8, 22, 15, 0))[0].deadline, '2026-09-27', tz);
    assert.equal(demoJobs(new Date(2026, 0, 29, 23, 59))[0].deadline, '2026-02-03', `${tz}: past a month end`);
    assert.equal(demoJobs(new Date(2026, 11, 29, 0, 1))[0].deadline, '2027-01-03', `${tz}: past a year end`);
    assert.equal(demoJobs(new Date(2026, 8, 22, 15, 0))[0].appliedDate, '2026-09-12', `${tz}: applied ten days before`);
  }
});
