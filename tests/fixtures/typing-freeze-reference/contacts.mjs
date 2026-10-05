// A copy of src/utils/contacts.js as it was before the typing-freeze ReDoS fixes, with the vanity-phone fix of claude/small-leftovers-1005
// (keypad letters dial their digits), its import pointed at src/utils: the reference the tf-redos-phone test compares the linear-time version
// with. Do not edit; it is slow on purpose on some inputs.
import { safeHref } from '../../../src/utils/richText.js'; // relative: the plain-node unit tests load it via atsChecker.js

/**
 * The contact fields, in the order every export prints them — the one table every place that
 * names a field reads: Personal info's labels, the cover letter's visibility toggles, the Design
 * panel's icon previews and the Sidebar's printed labels. `link` marks the fields that carry a
 * "Display label" and a "Link URL" override and print as a bare domain. An editor adds only its
 * own lucide icon and placeholder, by key (R1-3, R9-6).
 */
export const CONTACT_FIELDS = [
  { key: 'email',    label: 'Email'    },
  { key: 'phone',    label: 'Phone'    },
  { key: 'location', label: 'Location' },
  { key: 'website',  label: 'Website',  link: true },
  { key: 'linkedin', label: 'LinkedIn', link: true },
  { key: 'github',   label: 'GitHub',   link: true },
];

/** Their keys, in the same order. */
export const CONTACT_KEYS = CONTACT_FIELDS.map(({ key }) => key);

/** Each contact field's name, where a template prints one (the Sidebar's labels). */
export const CONTACT_LABELS = Object.fromEntries(CONTACT_FIELDS.map(({ key, label }) => [key, label]));

/**
 * Design → Contact Layout "2 Grid": each cell's share of the row and the gap between the two cells,
 * CSS px — the PDF's cells (PdfContactRow) and the Word résumé's tab stops (wordExportHeader.js).
 */
export const CONTACT_GRID = { cell: 0.46, gapPx: 24 };

const LINK_FIELDS = new Set(CONTACT_FIELDS.filter(({ link }) => link).map(({ key }) => key));

/** What follows a phone's separator when it is the number's extension: " ext. 890", " x12", " (ext 12)". */
const EXT_AFTER = /^\s*[([]?\s*(?:ext(?:ension)?\.?|x|#)[\s:]*\d+/i;

/** A word a Phone field may start with: "Phone: 555 0100", "Call 1-800-FLOWERS". */
const PHONE_LABEL = /^\s*(?:tel(?:ephone)?|phone|ph|mob(?:ile)?|cell|call|fax|home|work|office|direct)\b[.:]?\s*/i;

/**
 * A vanity number: its digits, then one word of letters (and digits) with no space in it, set off by
 * a hyphen, dot or space: "1-800-FLOWERS", "1-800-GO-FEDEX", "800 555 CALL". [1] is the digits' part,
 * [2] the word.
 */
const VANITY = /^(\+?[\d\s().\u2010-\u2015-]*\d[\s().\u2010-\u2015-]*?)([a-z][a-z\d]*(?:[.\u2010-\u2015-][a-z\d]+)*)[\s.\u2010-\u2015-]*$/i;

/** The key a letter is on, a to z, on a phone's keypad. */
const KEYPAD = '22233344455566677778889999';

/**
 * Seven digits that are no whole number, which a vanity word finishes: they start with a 1 or a 0, the
 * long-distance and trunk prefix ("1 800 555", "1 212 555", "0800 123"; a local number starts with
 * neither), or a "+" country code, a toll-free 800 and three digits ("+44 800 123"). Tested on the
 * digits with their leading "+".
 */
const UNFINISHED = /^(?:\+?[01]\d{6}|\+\d{1,3}0?800\d{3})$/;

/**
 * The digits one number (its extension already cut off) dials: its own digits, and for a vanity
 * number the keypad digit of each letter ("1-800-FLOWERS" → 18003569377). Letters are a vanity only
 * when the number needs them: under seven digits before the word, or seven that are no whole number
 * (UNFINISHED: "1 800 555 CALL", "0800 123 FLOWERS"). After a whole number, a word is a label ("555-0100
 * home", "555 123 4567 home", "555-0100 (mobile)") and adds nothing, as does one before the first digit
 * ("Phone: ").
 */
function dial(text) {
  const s = text.replace(PHONE_LABEL, '').replace(/[([][^\d)\]]*[)\]]/g, '').trim();
  const v = VANITY.exec(s);
  const typed = v ? v[1].replace(/[^\d+]/g, '') : '';
  const lead = typed.replace('+', '');
  const vanity = lead.length > 2 && (lead.length < 7 || UNFINISHED.test(typed));
  return vanity ? lead + v[2].replace(/[a-z]/gi, (c) => KEYPAD[parseInt(c, 36) - 10]).replace(/\D/g, '') : s.replace(/\D/g, '');
}

/**
 * A website / LinkedIn / GitHub's "Link URL" override, or '' when it is unset or no link. An override of
 * just a scheme or "www." ("https://", "www.", "https://www.", "http://www") names no address, and one the
 * PDF would not follow (a javascript: address) is no link: either counts as unset, as such a value does in
 * contactItems — the value typed in the field is linked instead, in every export. Before, it replaced the
 * valid value typed there, which printed unlinked or linked to "https://www."
 * (R5-HUNT12-LINK-URL-OVERRIDE-BARE-SCHEME, R5-HUNT12-LINK-URL-PLACEHOLDER-KILLS-CONTACT-LINK).
 */
export function linkOverride(key, personal) {
  const url = LINK_FIELDS.has(key) ? String(personal?.[`${key}Url`] || '').trim() : '';
  return url && namesAddress(url) && safeHref(url) ? url : '';
}

/**
 * Whether a website / LinkedIn / GitHub value names an address: not '' nor just a scheme and "www"
 * ("https://", "www.", "https://www.", "http://www") — the values safeHref links nowhere. The one
 * test linkOverride, the ATS text and JSON Resume share, so "https://www" under a Display label is
 * no address in any of them (R5-HUNT12-REVIEW-ATS-HOSTLESS-WWW-UNDER-LABEL).
 */
export function namesAddress(value) {
  return Boolean(displayUrl(value).replace(/^www\.?$/i, ''));
}

/**
 * A Phone field's tel: link, or null (not seven to fifteen digits: "On request", "Room 101", two
 * numbers typed with no separator). It dials the first number only — the field cut at '/', ',', ';',
 * '|' or "or" once what comes before holds seven digits, so "030/1234567" stays one number — and an
 * extension ("ext. 890", "x890", "#890") rides as RFC 3966's ";ext=". Every digit of the field was the
 * dial string: "+1 (555) 123-4567 ext. 890" dialled +15551234567890 and "+91 … / +91 …" linked to
 * "+91…+91…" (R5-HUNT12-PHONE-TEL-LINK-MERGES-EXTENSION). A vanity number dials its letters' keypad
 * digits ("1-800-FLOWERS" → tel:18003569377, see dial): the letters were dropped, so it linked to
 * tel:1800, and any text with three digits was linked, "Room 101" as tel:101, a 20-digit paste whole
 * (R5-HUNT12-VANITY-PHONE-TEL-LINK-DROPS-LETTERS). A field of over 200 characters is no number, which
 * also bounds the patterns here: a long paste was quadratic in their backtracking.
 */
function telHref(value) {
  if (value.length > 200) return null;
  const parts = value.split(/[/,;|]|\bor\b/i);
  let number = parts[0];
  let i = 1;
  for (; i < parts.length && dial(number).length < 7; i += 1) number += parts[i];
  // An extension set off by a comma ("(555) 123-4567, ext. 890") is this number's, not a second
  // number; one in brackets ("(ext. 12)") is read as one too. Before, the first lost its extension
  // and the second had its digits glued onto the number (R5-HUNT12-REVIEW-TEL-EXT-BRACKET-COMMA).
  if (i < parts.length && EXT_AFTER.test(parts[i])) number += ` ${parts[i]}`;
  // The marker follows a digit, or a word's last letter that has a digit before it ("1-800-FLOWERS
  // x12"); a label ("Phone # 555 0100") and the X of "FEDEX 12" are no marker.
  const ext = number.match(/(\d(?:[^]*?[a-z](?=[\s.)\]-]))?[\s.)\]-]*)[([]?\s*(?:ext(?:ension)?\.?|x|#)[\s:]*(\d+)/i);
  const main = ext ? number.slice(0, ext.index + ext[1].length) : number;
  const plus = /^\D*\+/.test(main);
  // "+44 (0) 20 7946 0958": the bracketed 0 is the trunk prefix dialled only from inside the country,
  // never after its code — +4402079460958 is no number (R5-HUNT12-REVIEW-TEL-TRUNK-ZERO).
  const digits = dial(plus ? main.replace(/\(\s*0\s*\)/g, '') : main);
  if (digits.length < 7 || digits.length > 15) return null;
  return `tel:${plus ? '+' : ''}${digits}${ext ? `;ext=${ext[2]}` : ''}`;
}

/**
 * Where a contact line should link to, or null. E-mail → mailto:, phone → tel: (telHref), website /
 * LinkedIn / GitHub → the "Link URL" override when it gives a link (linkOverride), else the value itself
 * (https:// added to a bare domain). Location is never a link.
 */
export function contactHref(key, personal) {
  const value = String(personal?.[key] || '').trim();
  if (!value) return null;
  if (key === 'email') return safeHref(/^mailto:/i.test(value) ? value : `mailto:${value}`);
  if (key === 'phone') return telHref(value);
  if (key === 'location') return null;
  return safeHref(linkOverride(key, personal) || value);
}

/**
 * The contact lines to print: [{ key, value, href }]. `value` is the "Display label" when the
 * field has one (website, LinkedIn, GitHub), else the value. A field whose printed value is empty
 * is left out — a website typed as just "https://" or "www." prints nothing, so it is no contact
 * (R5-HUNT8-EMPTY-WEBSITE-CONTACT). `hidden` defaults to the résumé's hidden fields; the cover
 * letter passes its own.
 */
export function contactItems(personal, hidden = personal?.hiddenFields || []) {
  return CONTACT_KEYS
    .filter((key) => String(personal?.[key] || '').trim() && !hidden.includes(key))
    .map((key) => {
      const raw = String(personal[key]).trim();
      const label = String(personal[`${key}Label`] || '').trim();
      return { key, value: label || (LINK_FIELDS.has(key) ? displayUrl(raw) : raw), href: contactHref(key, personal) };
    })
    .filter(({ value }) => value);
}

/**
 * A URL as a résumé prints it: "https://www.linkedin.com/in/me/" → "linkedin.com/in/me". The trailing
 * slashes are cut with a loop, not /\/+$/: that regex starts a run at every slash and fails at the
 * end of each, so a value with a long run of slashes before another character (a paste) took time
 * squared in its length — 20 000 of them, 175 ms, and contactItems asks for this on every render, once
 * per link field (R5-HUNT11-WEBSITE-FREEZE-LEAD).
 */
export function displayUrl(url) {
  const shown = String(url || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  let end = shown.length;
  while (end > 0 && shown.charCodeAt(end - 1) === 47) end -= 1; // '/'
  return end === shown.length ? shown : shown.slice(0, end);
}
