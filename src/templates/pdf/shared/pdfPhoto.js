import { pxToPt } from './pdfUnits';
import { readableOn, solid } from './pdfColors';

/**
 * Each photo variant's numbers, in its own unit: the résumé templates' in CSS px on a 210 mm A4
 * page (converted to pt), the cover letter's in pt — one table and one code path, so a ring or
 * shape fix reaches every photo (the letter kept its own copy — R3-5).
 *   classic  Classic, Minimal, Executive; Sidebar scales it to its column
 *   modern   Modern's banner
 *   cover    the cover letter
 * Per variant:
 *   sizes    width of Small / Medium / Large
 *   ring     the ring's width, pt
 *   rounded  corner radius of "Rounded"; square: of "Square"
 */
const VARIANTS = {
  classic: { unit: 'px', sizes: { sm: 130, md: 165, lg: 200 }, ring: 1.125, rounded: 10, square: 3 },
  modern:  { unit: 'px', sizes: { sm: 42, md: 54, lg: 68 }, ring: 1.5, rounded: 8, square: 3 },
  cover:   { unit: 'pt', sizes: { sm: 30, md: 38, lg: 48 }, ring: 1.5, rounded: 5, square: 1 },
};

/**
 * The photo's box and ring, for <PdfPhoto>. The ring colour is opaque (react-pdf strokes a
 * translucent border colour wrongly — see pdfColors.js): the "thin" rings are white over the
 * background they sit on, Modern's accent banner or the Sidebar panel.
 *
 * @param {object} settings resolved resume settings
 * @param {string} accent ring colour of the "accent" option
 * @param {'classic'|'modern'|'cover'} variant
 * @param {object} [opts]
 * @param {boolean} [opts.lightBorder] the photo sits on the dark Sidebar panel: an accent ring
 *   that would not show there (the default #374151 on navy is 1.4:1) takes the least-lightened
 *   tint that reaches 3:1, the WCAG figure for a graphic (R3-3)
 */
export function getPdfPhotoStyle(settings, accent, variant = 'classic', opts = {}) {
  const sh = settings?.photoShape || 'circle';
  const sz = settings?.photoSize || 'md';
  const br = settings?.photoBorder || 'accent';
  const ph = settings?.photoHeight || 'match';
  const v = VARIANTS[variant] || VARIANTS.classic;
  const toPt = v.unit === 'px' ? pxToPt : (n) => n;
  const wUnits = v.sizes[sz] || v.sizes.md;
  const w = toPt(wUnits);
  const hUnits = sh === 'circle'
    ? wUnits
    : ph === 'tall' ? Math.round(wUnits * 1.4)
      : ph === 'taller' ? Math.round(wUnits * 1.8)
        : wUnits;
  const h = toPt(hUnits);

  let borderWidth = 0;
  let borderColor = 'transparent';
  if (br === 'thin') {
    borderWidth = v.ring;
    borderColor = opts.lightBorder ? solid('rgba(255,255,255,0.25)', 1, settings?.sidebarBg)
      : variant === 'modern' ? solid('rgba(255,255,255,0.5)', 1, settings?.accentColor)
        : '#e5e7eb';
  } else if (br !== 'none') {
    borderWidth = v.ring;
    borderColor = opts.lightBorder ? readableOn(solid(accent), settings?.sidebarBg || '#1e293b', 3) : solid(accent);
  }

  return {
    width: w,
    height: h,
    borderRadius: sh === 'rounded' ? toPt(v.rounded) : sh === 'square' ? toPt(v.square) : w / 2,
    borderWidth,
    borderColor,
    objectFit: 'cover',
  };
}
