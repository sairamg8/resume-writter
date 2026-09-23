import { pxToPt } from './pdfUnits';
import { contrast, readableOn, solid } from './pdfColors';

/** The least a Thin ring shows on its ground: Classic's Thin, #e5e7eb, on the white page (1.24:1). */
const THIN_MIN = contrast('#e5e7eb', '#ffffff');

/**
 * Below this, the white Accent ring on an accent banner has vanished: on a pastel such as
 * #fde68a it is 1.25:1, no more than a Thin ring. Above it — a mid-tone such as green #22c55e,
 * 2.28:1, or sky #0ea5e9, 2.77:1 — it stays white, like the banner's name and contacts (V2W2b-0).
 */
const BANNER_RING_MIN = 1.5;

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
 * On those two grounds every ring is checked against the ground (VM3-4), and one that does not
 * show takes the least-shifted tint that does (readableOn). On the Sidebar panel the Accent ring
 * is the accent, held to 3:1 — the WCAG figure for a graphic — as the Sidebar job title is
 * lightened (FIDB-42): Blue #2563eb rings the navy panel in #2e69ec. On an accent banner it is
 * white, the colour of the banner's text, and moves only where it would vanish, below
 * BANNER_RING_MIN (V2W2b-0): 3:1 there turned it dark grey on every mid-tone accent. A Thin ring
 * shows at least as much as Classic's Thin on white (THIN_MIN). Every preset ground already
 * clears all three, so only custom colours change: a light panel, a pastel banner. On the white
 * page the accent is printed as picked, like every other accent-coloured line there.
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
const VALID_PHOTO_SHAPES = new Set(['circle', 'rounded', 'square']);
const VALID_PHOTO_SIZES = new Set(['sm', 'md', 'lg']);
const VALID_PHOTO_BORDERS = new Set(['none', 'thin', 'accent']);
const VALID_PHOTO_HEIGHTS = new Set(['match', 'tall', 'taller']);

export function getPdfPhotoStyle(settings, accent, variant = 'classic', opts = {}) {
  const sh = VALID_PHOTO_SHAPES.has(settings?.photoShape) ? settings.photoShape : 'circle';
  const sz = VALID_PHOTO_SIZES.has(settings?.photoSize) ? settings.photoSize : 'md';
  const br = VALID_PHOTO_BORDERS.has(settings?.photoBorder) ? settings.photoBorder : 'accent';
  const ph = VALID_PHOTO_HEIGHTS.has(settings?.photoHeight) ? settings.photoHeight : 'match';
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
    borderColor = !ground ? solid(accent)
      : readableOn(solid(accent), ground, opts.lightBorder ? 3 : BANNER_RING_MIN);
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
