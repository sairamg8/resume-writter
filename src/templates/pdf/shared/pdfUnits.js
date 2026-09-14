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

/** Tailwind `mb-5` = 1.25rem = 20px at default root — used by classic/minimal/executive headers. */
export const HEADER_MARGIN_BOTTOM_PT = pxToPt(20); // 15

/** Tailwind `pb-4` = 1rem = 16px when header border is shown. */
export const HEADER_BORDER_PAD_PT = pxToPt(16); // 12

/** Modern accent band: px-6 py-5 → 24px / 20px */
export const MODERN_HEADER_PAD_X_PT = pxToPt(24); // 18
export const MODERN_HEADER_PAD_Y_PT = pxToPt(20); // 15

/** Default section / item gaps from ATS_DEFAULTS (CSS px). */
export const DEFAULT_SECTION_GAP_PX = 16;
export const DEFAULT_ITEM_GAP_PX = 12;

/**
 * A section's Spacing preset (Tight / Normal / Spacious). Only the proportions count: they
 * scale Design → "Between Items" (see getEffectiveSpacing).
 */
export const SECTION_SPACING_PX = { compact: 4, normal: 8, relaxed: 14 };
