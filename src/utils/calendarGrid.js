// The dates the Calendar and Timeline views lay out: a month as whole weeks (Monday first), and
// a run of days. Local calendar days ('YYYY-MM-DD') throughout, built from their parts, never
// from UTC (boardModel's date rules). Pure (tests/unit/calendar-grid.unit.mjs).
import { addDays, parseLocalISO, toLocalISO } from './boardModel.js';

/** 'YYYY-MM' of a day. */
export const monthOf = (iso) => iso.slice(0, 7);

/** The first day of the month `n` months after the one `iso` is in. */
export function shiftMonth(iso, n) {
  const d = parseLocalISO(`${monthOf(iso)}-01`);
  return toLocalISO(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

/** The Monday on or before `iso`. */
export function weekStart(iso) {
  const d = parseLocalISO(iso);
  return addDays(iso, -((d.getDay() + 6) % 7));
}

/**
 * The weeks the month of `iso` spans, Monday first, each an array of 7 `{ iso, inMonth }` —
 * the days before and after it included, so every row is whole.
 */
export function monthWeeks(iso) {
  const first = `${monthOf(iso)}-01`;
  const start = weekStart(first);
  const weeks = [];
  for (let day = start; weeks.length < 6; ) {
    const week = [];
    for (let n = 0; n < 7; n++, day = addDays(day, 1)) week.push({ iso: day, inMonth: monthOf(day) === monthOf(first) });
    weeks.push(week);
    if (monthOf(day) !== monthOf(first)) break;
  }
  return weeks;
}

/** `count` days from `start`, as ISO days. */
export function dayRange(start, count) {
  return Array.from({ length: count }, (_, n) => addDays(start, n));
}

/** Whole days from `a` to `b` (negative when b is earlier); null when either is not a day. */
export function daysBetween(a, b) {
  const x = parseLocalISO(a);
  const y = parseLocalISO(b);
  if (!x || !y) return null;
  return Math.round((Date.UTC(y.getFullYear(), y.getMonth(), y.getDate()) - Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())) / 86400000);
}
