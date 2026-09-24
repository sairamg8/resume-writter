// The size a résumé's header prints its contact values at, pt: the one place the PDF's headers and
// the Word export read it from, so the two cannot drift again (R2-067: Word printed the contacts at
// 9 pt at every Design → Typography → Base, while the PDF followed Base). Plain JS, no react-pdf:
// the Word export imports it.
import { templateId } from '@/constants/templates';

const baseOf = (settings) => settings?.fontSizeBase || 11;

/** PdfContactRow's values — Classic, Minimal, Executive, Timeline, Banner, Academic, the letterhead: half a point under Base, never under 8 pt. */
export const rowContactPt = (settings) => Math.max(8, baseOf(settings) - 0.5);

/** Modern's banner row: 1.5 pt under Base. */
export const bannerContactPt = (settings) => baseOf(settings) - 1.5;

/** The two-column Sidebar's dark column prints each value at its 9 pt, whatever Base (the column's own text size). */
export const SIDE_CONTACT_PT = 9;

/**
 * The header's contact size on `template`'s page: Modern's banner, the Sidebar's column, else the
 * contact row. The Sidebar's Single · ATS-safe layout prints Classic's page, and Classic's row.
 */
export function headerContactPt(settings, template) {
  const t = templateId(template);
  if (t === 'modern') return bannerContactPt(settings);
  if (t === 'sidebar' && !settings?.sidebarSingleColumn) return SIDE_CONTACT_PT;
  return rowContactPt(settings);
}
