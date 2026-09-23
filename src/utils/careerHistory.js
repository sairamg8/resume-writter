// The Career History panel's numbers (Dashboard, Job Tracker), from the experience the résumé
// prints (AUD-29). It measured from the oldest start to today: a gap, an end date and an ended
// career all counted as time worked, a past job with no end date ran to today although the PDF
// prints its start alone, a promotion was two companies, and hidden entries counted. Plain JS with
// a relative import, so the node unit tests load it as it is.
import { parseMonthYear } from './dates.js';

/**
 * Every experience entry the résumé prints, in order: the visible items of every visible
 * experience section — the rule the ATS checker, the cover letter and the PDF follow.
 */
export function careerItems(resume) {
  const sections = Array.isArray(resume?.sections) ? resume.sections : [];
  return sections
    .filter((s) => s && s.type === 'experience' && s.visible !== false)
    .flatMap((s) => (Array.isArray(s.items) ? s.items.filter((i) => i && i.visible !== false) : []));
}

/** A stored date as a count of months (a year alone: its January), or null when it is not a month and year. */
export function monthIndex(value) {
  const d = parseMonthYear(value);
  return d ? d.y * 12 + (d.m || 1) - 1 : null;
}

/**
 * An entry's months as [start, end), end exclusive ("Jan 2020 – Mar 2023" is 38), or null when its
 * length is not known. A current job runs to this month. A job with no end date that is not current
 * has none: the PDF and Word print its start alone and the ATS check calls its dates missing, so the
 * panel does not invent one. Nor does an end that is not a month and year, or one not after the start.
 */
export function entrySpan(item, now = new Date()) {
  const start = monthIndex(item?.startDate);
  const end = item?.current ? now.getFullYear() * 12 + now.getMonth() : monthIndex(item?.endDate);
  return start !== null && end !== null && end > start ? [start, end] : null;
}

/** The months worked across `items`: their spans merged, so two jobs at once count once and a gap not at all. */
export function careerMonths(items, now = new Date()) {
  const spans = items.map((i) => entrySpan(i, now)).filter(Boolean).sort((a, b) => a[0] - b[0]);
  let total = 0;
  let run = null;
  for (const [start, end] of spans) {
    if (run && start <= run[1]) run[1] = Math.max(run[1], end);
    else {
      if (run) total += run[1] - run[0];
      run = [start, end];
    }
  }
  return run ? total + run[1] - run[0] : total;
}

/** A company as compared: trimmed, inner spaces collapsed, any case ("Initech " is "initech"). */
const companyKey = (name) => String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/** How many different companies `items` name (a promotion at one is one); a blank name is none. */
export function companyCount(items) {
  return new Set(items.map((i) => companyKey(i?.company)).filter(Boolean)).size;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** An entry's length beside it: "3yr 2mo", "2yr", "5mo"; '' when none. */
export function entryLabel(months) {
  if (!(months > 0)) return '';
  const yrs = Math.floor(months / 12);
  const mos = months % 12;
  if (yrs === 0) return `${mos}mo`;
  if (mos === 0) return `${yrs}yr`;
  return `${yrs}yr ${mos}mo`;
}

/** The career total: "4 years", "1 year", "5 months", "3 yrs 2 mos", "1 yr 1 mo"; '' when none. */
export function totalLabel(months) {
  if (!(months > 0)) return '';
  const yrs = Math.floor(months / 12);
  const mos = months % 12;
  if (yrs === 0) return plural(mos, 'month', 'months');
  if (mos === 0) return plural(yrs, 'year', 'years');
  return `${plural(yrs, 'yr', 'yrs')} ${plural(mos, 'mo', 'mos')}`;
}

/** "1 company", "3 companies"; '' when none. */
export const companiesLabel = (n) => (n > 0 ? plural(n, 'company', 'companies') : '');
