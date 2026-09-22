// Header spacing (header_spacing_spec.md): the settings keys, their ranges, and how a stored
// value — else the template's own (TEMPLATES' `headerGaps`) — becomes the PDF's points. Plain
// data and functions (no react-pdf): resolveTemplateSettings reads it for every PDF.
import { templateHeaderGaps } from '@/constants/templates';
import { CSS_PX_TO_PT } from '@/templates/pdf/shared/pdfUnits';

/**
 * Every header-spacing setting, stored in CSS px like Between Sections, with the range a stored
 * value is clamped to. headerPadY/X and headerRuleGap stop at 40 px (30 pt): the Word border
 * space they are to map to allows 31 pt. contactsSideGap is the cover letter's own (contacts
 * beside the name). Only headerInlineGap is in ATS_DEFAULTS (8 px, the templates' own 6 pt): a
 * new résumé stores no other, so each follows the template it prints with.
 */
export const HEADER_GAPS = {
  nameTitleGap:     { min: 0, max: 40 },
  headerInlineGap:  { min: 2, max: 48 },
  titleContactsGap: { min: 0, max: 40 },
  contactGapX:      { min: 0, max: 40 },
  contactGapY:      { min: 0, max: 24 },
  iconTextGap:      { min: 0, max: 16 },
  photoTextGap:     { min: 0, max: 48 },
  summaryGap:       { min: 0, max: 48 },
  headerGapBelow:   { min: 0, max: 80 },
  headerRuleGap:    { min: 0, max: 40 },
  headerPadY:       { min: 0, max: 40 },
  headerPadX:       { min: 0, max: 40 },
  contactsSideGap:  { min: 0, max: 48 },
};
export const HEADER_GAP_KEYS = Object.keys(HEADER_GAPS);

/**
 * A stored header gap in px, clamped to its range; null when unset or not a finite number —
 * imported JSON can carry anything, and a gap that is not a number prints as unset.
 */
export function storedGapPx(settings, key) {
  const v = settings?.[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const { min, max } = HEADER_GAPS[key];
  return Math.min(max, Math.max(min, v));
}

/**
 * The gap `key` the résumé set, in pt; null when it set none. For what follows a set value but keeps
 * its own spacing otherwise: the cover letter's letterhead (header_spacing_spec D5) and Word (D6).
 */
export function setGapPt(settings, key) {
  const px = storedGapPx(settings, key);
  return px == null ? null : px * CSS_PX_TO_PT;
}

/**
 * The template's own `key` gap in pt, or null where the template has none. A map is by Contact
 * Layout, read as PdfContactRow lays it out (any value but Single and 2 Grid is Justify); a
 * function takes Between Sections in pt.
 */
export function templateGapPt(template, key, { contactLayout = 'justify', sectionGapPt = 12 } = {}) {
  const d = templateHeaderGaps(template)[key];
  if (d == null) return null;
  if (typeof d === 'function') return d(sectionGapPt);
  if (typeof d === 'object') return d[contactLayout === 'single' || contactLayout === '2grid' ? contactLayout : 'justify'] ?? null;
  return d;
}

/**
 * Every header gap the template prints, in pt: the stored px × 0.75, else the template's own;
 * null for a gap the template does not have (a stored value is ignored there). headerInlineGap is
 * left out: resolveTemplateSettings has always resolved it itself (8 px when unset).
 */
export function headerGapsPt(settings, template, ctx) {
  const out = {};
  for (const key of HEADER_GAP_KEYS) {
    if (key === 'headerInlineGap') continue;
    const def = templateGapPt(template, key, ctx);
    const px = storedGapPx(settings, key);
    out[key] = def == null ? null : px == null ? def : px * CSS_PX_TO_PT;
  }
  return out;
}
