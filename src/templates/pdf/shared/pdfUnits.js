/**
 * Canvas (HTML/CSS) ↔ react-pdf unit bridge.
 *
 * Canvas resume preview is laid out in CSS px/pt inside a 210mm-wide frame.
 * @react-pdf/renderer uses PDF points (1pt = 1/72").
 * At the CSS reference density (96dpi): 1px = 0.75pt.
 *
 * Always convert *spacing* values that come from the design panel (stored as CSS px)
 * through pxToPt(). Font sizes are already stored as the same numeric "pt" used on
 * canvas (fontSizeBase etc.) and must NOT be converted.
 */

export const CSS_PX_TO_PT = 0.75;

/** Convert a CSS-pixel design value to PDF points. */
export function pxToPt(px) {
  if (px == null || Number.isNaN(Number(px))) return 0;
  return Number(px) * CSS_PX_TO_PT;
}

/**
 * A millimetre (page margins are stored in mm), in PDF points. The page's own size is the résumé's
 * (A4 or US Letter): src/constants/pageSize.js.
 */
export const MM_TO_PT = 72 / 25.4;

/**
 * Tailwind `pb-4` = 1rem = 16px when header border is shown — for settings that carry no
 * `headerGaps`. The header's spacing is each template's `headerGaps` (src/constants/templates.js),
 * which the résumé's own settings override (resolveTemplateSettings).
 */
export const HEADER_BORDER_PAD_PT = pxToPt(16); // 12

/**
 * Modern accent band: px-6 py-5 → 24px / 20px — MODERN_HEADER_GAPS' headerPadX / headerPadY, and the
 * cover letter's Modern band where the settings carry no header gaps.
 */
export const MODERN_HEADER_PAD_X_PT = pxToPt(24); // 18
export const MODERN_HEADER_PAD_Y_PT = pxToPt(20); // 15

/**
 * Default section / item gaps from ATS_DEFAULTS (CSS px). Between Items is 8 px (6 pt): the
 * Normal preset's gap, which every résumé printed before the slider worked (FIDA-53, R2-1).
 */
export const DEFAULT_SECTION_GAP_PX = 16;
export const DEFAULT_ITEM_GAP_PX = 8;

/**
 * A section's Spacing preset (Tight / Normal / Spacious). Only the proportions count: they
 * scale Design → "Between Items" (see getEffectiveSpacing).
 */
export const SECTION_SPACING_PX = { compact: 4, normal: 8, relaxed: 14 };

/**
 * The largest letter-spacing, as a fraction of the font size, that text extraction still reads
 * as one word. pdf.js and Poppler's pdftotext — and the ATS parsers built on them — take a gap
 * of about 0.09 em between two letters for a word break, so wider tracking exported the Sidebar
 * labels as "C O N TA C T" and "EM AI L" (FIDB-68). 0.06 em leaves a margin for kerning in every
 * offered font; a 12 pt section heading keeps its 0.7 pt.
 */
export const MAX_TRACKING_EM = 0.06;

/** Letter-spacing in pt: the design's `pt`, capped at MAX_TRACKING_EM of `fontSize`. */
export const tracking = (fontSize, pt) => Math.min(pt, fontSize * MAX_TRACKING_EM);
