import { pxToPt } from './pdfUnits';

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
 * @param {object} settings resume.settings
 * @param {string} accent border accent color
 * @param {'classic'|'modern'} variant
 * @param {object} [opts]
 * @param {boolean} [opts.lightBorder] use light thin border (sidebar dark bg)
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
    borderColor = opts.lightBorder ? 'rgba(255,255,255,0.25)' : (variant === 'modern' ? 'rgba(255,255,255,0.5)' : '#e5e7eb');
  } else if (br !== 'none') {
    borderWidth = variant === 'modern' ? 1.5 : 1.125;
    borderColor = accent;
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
