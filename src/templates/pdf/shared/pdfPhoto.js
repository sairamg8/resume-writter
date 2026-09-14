import { pxToPt } from './pdfUnits';
import { solid } from './pdfColors';

/**
 * Photo sizes in CSS px on a 210mm A4 page (converted to pt below).
 *
 *   classic / executive / minimal / sidebar → 130 / 165 / 200 px
 *   modern                                  → 42 / 54 / 68 px
 */
const SIZES = {
  classic: { sm: 130, md: 165, lg: 200 },
  modern:  { sm: 42,  md: 54,  lg: 68 },
};

/**
 * The photo's box and ring, for <PdfPhoto>. The ring colour is opaque (react-pdf strokes a
 * translucent border colour wrongly — see pdfColors.js): the "thin" rings are white over the
 * background they sit on, Modern's accent banner or the Sidebar panel.
 *
 * @param {object} settings resolved resume settings
 * @param {string} accent ring colour of the "accent" option
 * @param {'classic'|'modern'} variant
 * @param {object} [opts]
 * @param {boolean} [opts.lightBorder] the photo sits on the dark Sidebar panel
 */
export function getPdfPhotoStyle(settings, accent, variant = 'classic', opts = {}) {
  const sh = settings?.photoShape || 'circle';
  const sz = settings?.photoSize || 'md';
  const br = settings?.photoBorder || 'accent';
  const ph = settings?.photoHeight || 'match';
  const table = SIZES[variant] || SIZES.classic;
  const wPx = table[sz] || table.md;
  const w = pxToPt(wPx);
  const hPx = sh === 'circle'
    ? wPx
    : ph === 'tall' ? Math.round(wPx * 1.4)
      : ph === 'taller' ? Math.round(wPx * 1.8)
        : wPx;
  const h = pxToPt(hPx);

  let borderWidth = 0;
  let borderColor = 'transparent';
  if (br === 'thin') {
    borderWidth = variant === 'modern' ? 1.5 : 1.125; // ~1.5–2px canvas
    borderColor = opts.lightBorder ? solid('rgba(255,255,255,0.25)', 1, settings?.sidebarBg)
      : variant === 'modern' ? solid('rgba(255,255,255,0.5)', 1, settings?.accentColor)
        : '#e5e7eb';
  } else if (br !== 'none') {
    borderWidth = variant === 'modern' ? 1.5 : 1.125;
    borderColor = solid(accent);
  }

  return {
    width: w,
    height: h,
    borderRadius: sh === 'rounded' ? pxToPt(variant === 'modern' ? 8 : 10) : sh === 'square' ? pxToPt(3) : w / 2,
    borderWidth,
    borderColor,
    objectFit: 'cover',
  };
}
