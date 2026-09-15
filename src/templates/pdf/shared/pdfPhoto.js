import { pxToPt } from './pdfUnits';
import { contrast, readableOn, solid } from './pdfColors';

/** The least a Thin ring shows on its ground: Classic's Thin, #e5e7eb, on the white page (1.24:1). */
const THIN_MIN = contrast('#e5e7eb', '#ffffff');

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
 * On those two grounds every ring is checked against the ground (VM3-4): an Accent ring below
 * 3:1 — the WCAG figure for a graphic — takes the least-shifted tint that reaches it (readableOn),
 * and a Thin ring one that shows at least as much as Classic's Thin on white (THIN_MIN). That
 * includes an accent the user picked: Blue #2563eb rings the navy panel in #2e69ec, as the
 * Sidebar job title is lightened (FIDB-42). Every preset ground already clears both, so only
 * custom colours change: a light panel, a light banner. On the white page the accent is printed
 * as picked, like every other accent-coloured line there.
 *
 * @param {object} settings resolved resume settings
 * @param {string} accent ring colour of the "accent" option
 * @param {'classic'|'modern'|'cover'} variant
 * @param {object} [opts]
 * @param {boolean} [opts.lightBorder] the photo sits on the Sidebar panel: the default accent
 *   #374151 on navy is 1.4:1 before its tint (R3-3)
 * @param {boolean} [opts.onBanner] the photo sits on an accent banner (Modern's, or the cover
 *   letter's in the Modern look): "thin" is Modern's half-white ring over the accent (FIDB-51)
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

  // The coloured ground the photo sits on: the Sidebar panel, an accent banner, else none (white).
  const ground = opts.lightBorder ? settings?.sidebarBg || '#1e293b'
    : variant === 'modern' || opts.onBanner ? settings?.accentColor || '#2563eb'
      : null;
  let borderWidth = 0;
  let borderColor = 'transparent';
  if (br === 'thin') {
    borderWidth = v.ring;
    borderColor = !ground ? '#e5e7eb'
      : readableOn(solid(`rgba(255,255,255,${opts.lightBorder ? 0.25 : 0.5})`, 1, ground), ground, THIN_MIN);
  } else if (br !== 'none') {
    borderWidth = v.ring;
    borderColor = ground ? readableOn(solid(accent), ground, 3) : solid(accent);
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
