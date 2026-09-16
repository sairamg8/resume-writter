import { safeHref } from '@/utils/richText';

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

/**
 * Where a contact line should link to, or null. E-mail → mailto:, phone → tel:, website /
 * LinkedIn / GitHub → the "Link URL" override when set, else the value itself (https:// added
 * to a bare domain). Location is never a link.
 */
export function contactHref(key, personal) {
  const value = String(personal?.[key] || '').trim();
  if (!value) return null;
  if (key === 'email') return safeHref(/^mailto:/i.test(value) ? value : `mailto:${value}`);
  if (key === 'phone') {
    const dial = value.replace(/[^\d+]/g, '');
    return dial.replace(/\D/g, '').length >= 3 ? `tel:${dial}` : null;
  }
  if (key === 'location') return null;
  return safeHref(String(personal?.[`${key}Url`] || '').trim() || value);
}

/**
 * The contact lines to print: [{ key, value, href }]. `value` is the "Display label" when the
 * field has one (website, LinkedIn, GitHub), else the value. `hidden` defaults to the résumé's
 * hidden fields; the cover letter passes its own.
 */
export function contactItems(personal, hidden = personal?.hiddenFields || []) {
  return CONTACT_KEYS
    .filter((key) => String(personal?.[key] || '').trim() && !hidden.includes(key))
    .map((key) => {
      const raw = String(personal[key]).trim();
      const label = String(personal[`${key}Label`] || '').trim();
      return { key, value: label || (LINK_FIELDS.has(key) ? displayUrl(raw) : raw), href: contactHref(key, personal) };
    });
}

/** A URL as a résumé prints it: "https://www.linkedin.com/in/me/" → "linkedin.com/in/me". */
export function displayUrl(url) {
  return String(url || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
}
