// Job-tracker dates are stored as local calendar days ('YYYY-MM-DD'). `new Date('YYYY-MM-DD')`
// parses that as UTC midnight, which is the previous evening west of Greenwich and 05:30 in
// India, so these helpers keep every comparison in the user's own day.

/** Today's local date as 'YYYY-MM-DD' (toISOString() would give the UTC day). */
export function todayLocalISO(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The last millisecond of a 'YYYY-MM-DD' local day, or null for a blank/invalid value. */
export function endOfLocalDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999) : null;
}

const SOON_MS = 3 * 24 * 60 * 60 * 1000;

/** 'past' once the deadline day is over, 'soon' within 3 days of its end, otherwise null. */
export function deadlineState(iso, now = new Date()) {
  const end = endOfLocalDay(iso);
  if (!end) return null;
  if (end < now) return 'past';
  return end - now < SOON_MS ? 'soon' : null;
}

// ── Résumé dates and Design → Date format (PAR-06) ─────────────────────────────────────────
// An entry's dates are stored as they came in: the month picker writes "Jan 2024" (what every
// build reads), an import can hold "05/2023", "2019-05", 2019 or "Summer 2020". The PDF, Word and
// the editor print every one of them through here, in the résumé's `settings.dateFormat`. A value
// that is not a month and year prints exactly as stored, so nothing is lost or garbled.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The words a date prints with: month names, the picker's three-letter ones, a current job's end. */
const ENGLISH = Object.freeze({ months: MONTHS, monthsShort: MONTHS.map((m) => m.slice(0, 3)), present: 'Present' });

/**
 * The words the dates of the résumé with `settings` print with. English: the résumé language
 * (PAR-03) returns its own here, and every date of the PDF, Word and the editor follows it with
 * no caller changed — each passes the résumé's settings already.
 */
// eslint-disable-next-line no-unused-vars -- the résumé language reads it
export function dateLabels(settings) {
  return ENGLISH;
}

/** A current job's end — "Present" — in the résumé's words. */
export const presentLabel = (settings) => dateLabels(settings).present;

/**
 * An entry's end as it prints: "Present" while it is current — a job, and since R2-150 an
 * education, a project or a volunteering role, which have the same flag — else its End Date.
 */
export const endDateOf = (item, settings) => (item?.current ? presentLabel(settings) : item?.endDate);

/** 'january', 'jan', 'sept' … → 1–12: the month words a stored date can hold (any case). */
const MONTH_OF = new Map([
  ...MONTHS.flatMap((name, i) => [[name.toLowerCase(), i + 1], [name.slice(0, 3).toLowerCase(), i + 1]]),
  ['sept', 9],
]);

const monthYear = (y, m) => (m >= 1 && m <= 12 ? { y, m } : null);

/**
 * A stored date as { y, m } (m 1–12, or null for a year alone), or null when it is not a month
 * and year: "Jan 2024", "January 2024", "Sept. 2024", "01/2024", "1/2024", "01.2024", "01-2024",
 * "2024-01", "2024/01", "2024.01", "2024" or the number 2024 all read; a month alone ("Jan", which
 * the picker stores until a year is chosen), "13/2024", "Summer 2020" and any other text do not.
 */
export function parseMonthYear(value) {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 1000 && value <= 9999 ? { y: value, m: null } : null;
  if (typeof value !== 'string') return null;
  const v = value.trim();
  let x = /^(\d{4})$/.exec(v);
  if (x) return { y: Number(x[1]), m: null };
  x = /^([a-z]+)\.?,?\s+(\d{4})$/i.exec(v);
  if (x) return monthYear(Number(x[2]), MONTH_OF.get(x[1].toLowerCase()));
  x = /^(\d{1,2})\s*[/.-]\s*(\d{4})$/.exec(v);
  if (x) return monthYear(Number(x[2]), Number(x[1]));
  x = /^(\d{4})\s*[/.-]\s*(\d{1,2})$/.exec(v);
  return x ? monthYear(Number(x[1]), Number(x[2])) : null;
}

const pad = (n) => String(n).padStart(2, '0');

/**
 * Each Date format but As entered: `my` prints a month and year, `dmy` a day (the cover letter's
 * date, day first as the letter has always printed it). Year only has no day form. FlowCV's
 * month-year presets (PAR-06); the ids are stored in settings.dateFormat.
 */
const FORMATS = {
  'MMM YYYY': { my: (y, m, w) => `${w.monthsShort[m - 1]} ${y}`, dmy: (y, m, d, w) => `${d} ${w.monthsShort[m - 1]} ${y}` },
  'MMMM YYYY': { my: (y, m, w) => `${w.months[m - 1]} ${y}`, dmy: (y, m, d, w) => `${d} ${w.months[m - 1]} ${y}` },
  'MM/YYYY': { my: (y, m) => `${pad(m)}/${y}`, dmy: (y, m, d) => `${pad(d)}/${pad(m)}/${y}` },
  'MM.YYYY': { my: (y, m) => `${pad(m)}.${y}`, dmy: (y, m, d) => `${pad(d)}.${pad(m)}.${y}` },
  'YYYY-MM': { my: (y, m) => `${y}-${pad(m)}`, dmy: (y, m, d) => `${y}-${pad(m)}-${pad(d)}` },
  'YYYY.MM': { my: (y, m) => `${y}.${pad(m)}`, dmy: (y, m, d) => `${y}.${pad(m)}.${pad(d)}` },
  YYYY: { my: (y) => String(y) },
};

/** Every date as stored — what each build before this setting printed, and what one without it prints. */
export const DEFAULT_DATE_FORMAT = 'asEntered';

/** Design → Date format's choices, As entered first. */
export const DATE_FORMATS = [DEFAULT_DATE_FORMAT, ...Object.keys(FORMATS)];

/**
 * The résumé's Date format: its stored choice when this build knows it, else As entered — also
 * for a value a newer build stored, which stays stored as it is (normalizeResume keeps it).
 */
export function dateFormatOf(settings) {
  const id = settings?.dateFormat;
  return DATE_FORMATS.includes(id) ? id : DEFAULT_DATE_FORMAT;
}

/** A stored date as text: trimmed; a year imported as a number (2019) as written; else ''. */
const dateText = (v) => (typeof v === 'string' ? v.trim() : (Number.isFinite(v) ? String(v) : ''));

/**
 * One stored date as the résumé with `settings` prints it: a month and year in its Date format (a
 * year alone as the year, in every format); anything else, and every date As entered, as stored —
 * trimmed, a year imported as a number as written (R9-1), '' for what is neither text nor number.
 */
export function formatDate(value, settings) {
  const text = dateText(value);
  const format = FORMATS[dateFormatOf(settings)];
  const date = format && text ? parseMonthYear(value) : null;
  if (!date) return text;
  return date.m ? format.my(date.y, date.m, dateLabels(settings)) : String(date.y);
}

/**
 * A from–to range as the exports print it: "05/2023 – 05/2026", "05/2023" alone, "– 05/2026"
 * when only the end is known (a certificate's expiry, a current job with no start: "– Present"),
 * '' when neither is — each side through formatDate, in the Date format of `settings` (the
 * résumé's). The one rule for every dated section of the PDF's two columns and of Word, which
 * each built it slightly differently (R2-7, R9-2).
 */
export function dateRange(start, end, settings) {
  const [a, b] = [start, end].map((v) => formatDate(v, settings));
  if (a && b) return `${a} – ${b}`;
  return a || (b ? `– ${b}` : '');
}

/**
 * A day as { y, m, d }: 'YYYY-MM-DD', or "15 January 2026" / "15 Jan 2026" as the cover letter's
 * Today button writes it; null for anything else — "15/01/2026" could be either order — and for a
 * day its month does not have, like 2026-02-31 (R1-12).
 */
export function parseDayDate(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const words = iso ? null : /^(\d{1,2})\s+([a-z]+)\.?,?\s+(\d{4})$/i.exec(v);
  if (!iso && !words) return null;
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]].map(Number) : [Number(words[3]), MONTH_OF.get(words[2].toLowerCase()), Number(words[1])];
  const real = new Date(y, m - 1, d);
  return m && real.getFullYear() === y && real.getMonth() === m - 1 && real.getDate() === d ? { y, m, d } : null;
}

/**
 * A cover letter's date in the résumé's Date format, day first: "15 Jan 2026", "15 January 2026",
 * "15/01/2026", "15.01.2026", "2026-01-15", "2026.01.15". As entered — and Year only, which has no
 * day form — keeps the letter's own rule: a 'YYYY-MM-DD' day as "15 January 2026", anything else,
 * a day it cannot read included, exactly as typed.
 */
export function formatDayDate(value, settings) {
  const text = typeof value === 'string' ? value.trim() : '';
  const day = parseDayDate(text);
  if (!day) return text;
  const words = dateLabels(settings);
  const format = FORMATS[dateFormatOf(settings)]?.dmy;
  if (format) return format(day.y, day.m, day.d, words);
  return /^\d{4}-/.test(text) ? `${day.d} ${words.months[day.m - 1]} ${day.y}` : text;
}
