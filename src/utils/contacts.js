import { safeHref } from '@/utils/richText';

/** Contact fields in the order every export prints them. */
export const CONTACT_KEYS = ['email', 'phone', 'location', 'website', 'linkedin', 'github'];

/** Each contact field's name, where a template prints one (the Sidebar's labels). */
export const CONTACT_LABELS = { email: 'Email', phone: 'Phone', location: 'Location', website: 'Website', linkedin: 'LinkedIn', github: 'GitHub' };

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

const LINK_FIELDS = new Set(['website', 'linkedin', 'github']);

/** A URL as a résumé prints it: "https://www.linkedin.com/in/me/" → "linkedin.com/in/me". */
export function displayUrl(url) {
  return String(url || '').trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
}
