// What a cover letter prints around its body, worked out once so the PDF and the Word export
// cannot drift: the hidden contacts, the date line, the recipient block, the subject line, the
// closing and the signature.
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

const list = (v) => (Array.isArray(v) ? v : null);

/**
 * Contact fields the letter leaves out: its own list — the Cover Letter panel's "Visible Contact
 * Fields" — whatever the résumé hides (FIDB-44). A letter that has no list yet (a new letter, or
 * one saved before the panel wrote it) follows the résumé's hidden fields, as it always printed;
 * the panel shows that same state, and its first toggle gives the letter a list of its own.
 */
export function letterHiddenFields(cl = {}, personal = {}) {
  return list(cl?.hiddenFields) ?? list(personal?.hiddenFields) ?? [];
}

/**
 * The closing line and the signature. The name and designation are the letter's own once the
 * user has set them (even to ''), else the résumé's name and title.
 */
export function letterSignature(cl = {}, personal = {}) {
  return {
    closing: `${cl.closing || 'Sincerely'},`,
    name: cl.signatureName != null ? cl.signatureName : (personal?.name || ''),
    designation: cl.signatureDesignation != null ? cl.signatureDesignation : (personal?.title || ''),
    wide: cl.signatureSpace === 'wide',
  };
}
