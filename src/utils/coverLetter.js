// What a cover letter prints around its body, worked out once so the PDF and the Word export
// cannot drift: the date line, the recipient block and the subject line.
import { todayLocalISO } from '@/utils/dates';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const text = (v) => (typeof v === 'string' ? v.trim() : '');

/** A 'YYYY-MM-DD' date as "15 January 2026"; anything else prints exactly as the user typed it. */
export function letterDate(value) {
  const v = text(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  const month = m ? Number(m[2]) : 0;
  const day = m ? Number(m[3]) : 0;
  if (!m || month < 1 || month > 12 || day < 1 || day > 31) return v;
  return `${day} ${MONTHS[month - 1]} ${m[1]}`;
}

/** Today, written the way the letter prints a date. */
export const todayLetterDate = (now = new Date()) => letterDate(todayLocalISO(now));

/**
 * The business-letter block between the letterhead and the body. Each value is '' when the
 * user left it empty, and an empty line prints nothing — no label, no gap.
 */
export function letterBlock(cl = {}) {
  return {
    date: letterDate(cl.date),
    recipientName: text(cl.recipientName),
    recipientTitle: text(cl.recipientTitle),
    company: text(cl.company),
    subject: text(cl.subject),
  };
}
