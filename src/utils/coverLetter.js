// What a cover letter prints around its body, worked out once so the PDF and the Word export
// cannot drift: the hidden contacts, the date line, the recipient block, the subject line, the
// closing and the signature.
import { formatDayDate, todayLocalISO } from '@/utils/dates';

const text = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * The letter's date as it prints, in the résumé's Design → Date format (`settings`, PAR-06): a
 * day it reads — 'YYYY-MM-DD', or "15 January 2026" as Today writes it — as "15/01/2026",
 * "2026-01-15" …; As entered (no format stored: every résumé before PAR-06) prints a 'YYYY-MM-DD'
 * day as "15 January 2026" and anything else — a day the month does not have, like 2026-02-31
 * (R1-12), included — exactly as the user typed it.
 */
export const letterDate = (value, settings) => formatDayDate(value, settings);

/** Today as the Today button writes it: "15 January 2026", which each Date format then prints its way. */
export const todayLetterDate = (now = new Date()) => letterDate(todayLocalISO(now));

/**
 * The business-letter block between the letterhead and the body. Each value is '' when the
 * user left it empty, and an empty line prints nothing — no label, no gap. `settings`: the
 * résumé's, whose Date format the date line takes.
 */
export function letterBlock(cl = {}, settings = {}) {
  return {
    date: letterDate(cl.date, settings),
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

/** The Fields Positions the panel offers, in its order; the first is the default. */
const FIELDS_POSITIONS = ['right', 'below-name', 'below-all'];

/**
 * Where the letterhead puts the contacts — the panel's "Fields Position". A value the panel never
 * wrote (an import's, a file edited by hand: "Right of Name", "RIGHT", "below") reads as 'right',
 * exactly as templateId() reads an unknown template id: the letterhead's layouts are keyed on the
 * exact string, so an unknown one drew the right-hand layout with the guard that caps the name
 * side switched off — the contacts column collapsed to no width and react-pdf threw "unsupported
 * number: Infinity" on the first contact icon, leaving the letter with no preview and no PDF at
 * all (and, with no photo, the contacts past the right margin) — V2FIDB-51-1. The panel reads it
 * here too, so the option it marks is always the layout that prints.
 */
export const letterFieldsPosition = (cl = {}) =>
  (FIELDS_POSITIONS.includes(cl?.fieldsPosition) ? cl.fieldsPosition : FIELDS_POSITIONS[0]);

/**
 * Does the letterhead draw contact icons — the chosen pack, or the image uploaded for a field?
 * Exactly when its contact style is Icon, in every look: the letter's own style, whatever the
 * résumé's. Personal Info offers the per-field upload then too, not only where the résumé draws
 * icons (drawsContactIcons, R9-5).
 */
export const letterDrawsContactIcons = (cl, settings) => letterContactFormat(cl, settings).style === 'icon';

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
 * A closing that already ends its clause: '!', '?', '.', ';', ':', '…', a CJK or Arabic comma or
 * full stop (Unicode's terminal punctuation). A bracket, a quote or an emoji does not.
 */
const ENDS_ITS_CLAUSE = /[\p{Term}…]$/u;

/**
 * The closing line and the signature. The closing gets one comma — also when the user typed
 * it with one ("Best regards," printed ",," — R1-7) — unless it ends in punctuation of its own
 * ("Thank you!" printed "Thank you!," — R9-9). The name and designation are the letter's own
 * once the user has set them (even to ''), else the résumé's name and title.
 */
export function letterSignature(cl = {}, personal = {}) {
  const closing = text(cl.closing).replace(/[\s,]+$/, '') || 'Sincerely';
  return {
    closing: ENDS_ITS_CLAUSE.test(closing) ? closing : `${closing},`,
    name: cl.signatureName != null ? cl.signatureName : (personal?.name || ''),
    designation: cl.signatureDesignation != null ? cl.signatureDesignation : (personal?.title || ''),
    wide: cl.signatureSpace === 'wide',
  };
}

/**
 * The résumé photo the letter may fall back on: none when the user hid it under Personal Info →
 * Photo, so the letter never prints a photo the résumé leaves out (R2-092). The letter's own photo
 * (clPhoto) is its own choice and prints either way.
 */
export const letterResumePhoto = (personal = {}) =>
  (list(personal?.hiddenFields)?.includes('photo') ? null : personal?.photo || null);
