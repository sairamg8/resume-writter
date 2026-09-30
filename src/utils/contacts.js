import { safeHref } from './richText.js'; // relative: the plain-node unit tests load it via atsChecker.js

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

const digitCount = (s) => s.replace(/\D/g, '').length;

/** What follows a phone's separator when it is the number's extension: " ext. 890", " x12", " (ext 12)". */
const EXT_AFTER = /^\s*[([]?\s*(?:ext(?:ension)?\.?|x|#)[\s:]*\d+/i;

/**
 * A Phone field's tel: link, or null (under three digits: "On request"). It dials the first number
 * only — the field cut at '/', ',', ';', '|' or "or" once what comes before holds seven digits, so
 * "030/1234567" stays one number — and an extension ("ext. 890", "x890", "#890") rides as RFC 3966's
 * ";ext=". Every digit of the field was the dial string: "+1 (555) 123-4567 ext. 890" dialled
 * +15551234567890 and "+91 … / +91 …" linked to "+91…+91…" (R5-HUNT12-PHONE-TEL-LINK-MERGES-EXTENSION).
 */
function telHref(value) {
  const parts = value.split(/[/,;|]|\bor\b/i);
  let number = parts[0];
  let i = 1;
  for (; i < parts.length && digitCount(number) < 7; i += 1) number += parts[i];
  // An extension set off by a comma ("(555) 123-4567, ext. 890") is this number's, not a second
  // number; one in brackets ("(ext. 12)") is read as one too. Before, the first lost its extension
  // and the second had its digits glued onto the number (R5-HUNT12-REVIEW-TEL-EXT-BRACKET-COMMA).
  if (i < parts.length && EXT_AFTER.test(parts[i])) number += ` ${parts[i]}`;
  const ext = number.match(/(\d[\s.)\]-]*)[([]?\s*(?:ext(?:ension)?\.?|x|#)[\s:]*(\d+)/i);
  const main = ext ? number.slice(0, ext.index + ext[1].length) : number;
  const plus = /^\D*\+/.test(main);
  // "+44 (0) 20 7946 0958": the bracketed 0 is the trunk prefix dialled only from inside the country,
  // never after its code — +4402079460958 is no number (R5-HUNT12-REVIEW-TEL-TRUNK-ZERO).
  const digits = (plus ? main.replace(/\(\s*0\s*\)/g, '') : main).replace(/\D/g, '');
  if (digits.length < 3) return null;
  return `tel:${plus ? '+' : ''}${digits}${ext ? `;ext=${ext[2]}` : ''}`;
}

/**
 * Where a contact line should link to, or null. E-mail → mailto:, phone → tel: (telHref), website /
 * LinkedIn / GitHub → the "Link URL" override when it gives a safe link, else the value itself
 * (https:// added to a bare domain). A Link URL of only "https://" or "www." took the value's link
 * away (R5-HUNT12-LINK-URL-PLACEHOLDER-KILLS-CONTACT-LINK). Location is never a link.
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
 * A website / LinkedIn / GitHub's "Link URL" override, trimmed, when it is a link the PDF follows
 * (safeHref), else ''. One that is not ("https://" or "www." alone, a javascript: address) is no
 * override: the value links and prints as if the box were empty, in every export
 * (R5-HUNT12-LINK-URL-PLACEHOLDER-KILLS-CONTACT-LINK).
 */
export function linkOverride(key, personal) {
  const url = LINK_FIELDS.has(key) ? String(personal?.[`${key}Url`] || '').trim() : '';
  return url && safeHref(url) ? url : '';
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
