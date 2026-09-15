// What a cover letter prints around its body, worked out once so the PDF and the Word export
// cannot drift: the hidden contacts, the date line, the recipient block, the subject line, the
// closing and the signature.
import { todayLocalISO } from '@/utils/dates';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const text = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * A 'YYYY-MM-DD' date as "15 January 2026"; anything else — including a day the month does not
 * have, like 2026-02-31 (R1-12) — prints exactly as the user typed it.
 */
export function letterDate(value) {
  const v = text(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return v;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const real = new Date(year, month - 1, day);
  if (real.getFullYear() !== year || real.getMonth() !== month - 1 || real.getDate() !== day) return v;
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

/**
 * The letterhead's contact style (icon | bullet | bar) and layout (single | justify | 2grid):
 * the letter's own once its panel sets them, else the résumé's. The panel's chips show these
 * same values. A résumé that stores neither (an import, older data) prints icons, justified —
 * the defaults resolveTemplateSettings gives the PDF and Word — so the panel, which reads the
 * stored settings, marks those too; a 'bar' fallback marked Bar over a letter of icons (R9-3).
 */
export function letterContactFormat(cl = {}, settings = {}) {
  return {
    style: cl?.headerStyle || settings?.contactStyle || 'icon',
    layout: cl?.headerLayout || settings?.contactLayout || 'justify',
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
 * The closing line and the signature. The closing gets one comma — also when the user typed
 * it with one ("Best regards," printed ",," — R1-7). The name and designation are the letter's
 * own once the user has set them (even to ''), else the résumé's name and title.
 */
export function letterSignature(cl = {}, personal = {}) {
  const closing = text(cl.closing).replace(/[\s,]+$/, '') || 'Sincerely';
  return {
    closing: `${closing},`,
    name: cl.signatureName != null ? cl.signatureName : (personal?.name || ''),
    designation: cl.signatureDesignation != null ? cl.signatureDesignation : (personal?.title || ''),
    wide: cl.signatureSpace === 'wide',
  };
}
