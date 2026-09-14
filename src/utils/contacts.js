import { safeHref } from '@/utils/richText';

/** Contact fields in the order every export prints them. */
export const CONTACT_KEYS = ['email', 'phone', 'location', 'website', 'linkedin', 'github'];

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
    .map((key) => ({
      key,
      value: String(personal[`${key}Label`] || '').trim() || String(personal[key]).trim(),
      href: contactHref(key, personal),
    }));
}
