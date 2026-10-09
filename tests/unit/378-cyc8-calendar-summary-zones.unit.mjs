// The Calendar and Timeline dates (src/utils/calendarGrid.js) and the Summary page's "due soon"
// window (src/utils/projectSummary.js) are local calendar days, so they must not move with the
// clock of the zone: checked in zones with a daylight-saving change (either hemisphere), one where
// midnight is skipped (Santiago, 6 Sep 2026) and India (UTC+5:30). tracker-views.unit.mjs pins the same
// functions in the machine's own zone; the ci workflow runs it in three more. Run: yarn test:unit
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { dayRange, daysBetween, monthWeeks, shiftMonth, weekStart } from '../../src/utils/calendarGrid.js';
import { projectSummary } from '../../src/utils/projectSummary.js';
import * as ops from '../../src/utils/boardOps.js';
import { createBoard, parseLocalISO } from '../../src/utils/boardModel.js';

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ; else process.env.TZ = ORIGINAL_TZ;
});

const ZONES = ['America/Los_Angeles', 'Pacific/Auckland', 'America/Santiago', 'Asia/Kolkata'];
const pad = (n) => String(n).padStart(2, '0');

test('calendar: every month of 2026 and 2028 is whole Monday-first weeks of consecutive days, in every zone', () => {
  for (const tz of ZONES) {
    process.env.TZ = tz;
    for (const year of [2026, 2028]) {
      for (let month = 1; month <= 12; month += 1) {
        const where = `${tz} ${year}-${pad(month)}`;
        const weeks = monthWeeks(`${year}-${pad(month)}-15`);
        assert.ok(weeks.length >= 4 && weeks.length <= 6, `${where}: ${weeks.length} weeks`);
        assert.ok(weeks.every((w) => w.length === 7), `${where}: whole weeks`);
        const days = weeks.flat();
        assert.equal(parseLocalISO(days[0].iso).getDay(), 1, `${where}: starts on a Monday`);
        for (let i = 1; i < days.length; i += 1) assert.equal(daysBetween(days[i - 1].iso, days[i].iso), 1, `${where}: ${days[i - 1].iso} then ${days[i].iso}`);
        const inMonth = days.filter((d) => d.inMonth);
        assert.equal(inMonth.length, new Date(year, month, 0).getDate(), `${where}: every day of the month, once`);
        assert.equal(inMonth[0].iso, `${year}-${pad(month)}-01`, where);
      }
    }
  }
});

test('calendar: the week of any day begins on a Monday up to six days before it, across the clock changes', () => {
  for (const tz of ZONES) {
    process.env.TZ = tz;
    for (const [year, month, days] of [[2026, 3, 31], [2026, 4, 30], [2026, 9, 30], [2026, 10, 31], [2026, 11, 30]]) {
      for (let d = 1; d <= days; d += 1) {
        const iso = `${year}-${pad(month)}-${pad(d)}`;
        const start = weekStart(iso);
        assert.equal(parseLocalISO(start).getDay(), 1, `${tz} ${iso}: ${start} is a Monday`);
        const back = daysBetween(start, iso);
        assert.ok(back >= 0 && back <= 6, `${tz} ${iso}: ${back} days after ${start}`);
      }
    }
    assert.equal(weekStart('2026-03-08'), '2026-03-02', `${tz}: the Sunday US clocks go forward`);
    assert.equal(weekStart('2026-04-05'), '2026-03-30', `${tz}: the Sunday New Zealand clocks go back`);
    assert.equal(weekStart('2026-09-06'), '2026-08-31', `${tz}: the Sunday Santiago skips midnight`);
  }
});

test('calendar: day counts, ranges and month steps are whole calendar days across the clock changes', () => {
  for (const tz of ZONES) {
    process.env.TZ = tz;
    assert.equal(daysBetween('2026-03-07', '2026-03-09'), 2, tz);
    assert.equal(daysBetween('2026-10-31', '2026-11-02'), 2, tz);
    assert.equal(daysBetween('2026-04-04', '2026-04-07'), 3, tz);
    assert.equal(daysBetween('2026-09-05', '2026-09-07'), 2, tz);
    assert.equal(daysBetween('2026-01-01', '2027-01-01'), 365, tz);
    assert.equal(daysBetween('2027-01-01', '2026-01-01'), -365, tz);
    assert.deepEqual(dayRange('2026-03-07', 3), ['2026-03-07', '2026-03-08', '2026-03-09'], tz);
    assert.deepEqual(dayRange('2026-04-04', 3), ['2026-04-04', '2026-04-05', '2026-04-06'], tz);
    assert.deepEqual(dayRange('2026-09-05', 3), ['2026-09-05', '2026-09-06', '2026-09-07'], tz);
    assert.equal(shiftMonth('2026-01-31', 1), '2026-02-01', tz);
    assert.equal(shiftMonth('2026-03-31', -1), '2026-02-01', tz);
    assert.equal(shiftMonth('2026-12-15', 1), '2027-01-01', tz);
    assert.equal(shiftMonth('2026-01-15', -1), '2025-12-01', tz);
  }
});

test('summary: "due soon" is today to seven calendar days on, however late or early the clock reads', () => {
  const cases = [
    // [zone, now, today, last day counted] — the evening before US clocks go forward; just after midnight before NZ's do
    ['America/Los_Angeles', new Date(2026, 2, 7, 23, 30), '2026-03-07', '2026-03-14'],
    ['Pacific/Auckland', new Date(2026, 8, 26, 0, 30), '2026-09-26', '2026-10-03'],
    ['Asia/Kolkata', new Date(2026, 11, 29, 23, 59), '2026-12-29', '2027-01-05'],
  ];
  for (const [tz, nowDate, today, last] of cases) {
    process.env.TZ = tz;
    const now = nowDate.getTime();
    let board = createBoard({ title: 'Zones', key: 'ZONE' }, { now });
    const add = (id, due) => { board = ops.addIssue(board, { id, title: id, due }, { now }); };
    add('late', shift(today, -1));
    add('today', today);
    add('last', last);
    add('after', shift(last, 1));
    const summary = projectSummary(board, now);
    assert.equal(summary.dueSoon, 2, `${tz}: ${today} and ${last} count, the day before and after do not`);
  }
});

/** The day `n` days from `iso`, by the calendar and written out here so the test does not lean on the code it checks. */
function shift(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + n));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}
