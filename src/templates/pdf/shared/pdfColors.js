/**
 * Colours for react-pdf.
 *
 * Fills (backgroundColor, text color) may be translucent: react-pdf turns "#rrggbbaa" into a
 * colour plus fill opacity. Borders may not: react-pdf hands border colours to its PDF writer
 * unparsed, and that reads "#2563eb30" as the number 0x2563eb30 — the stroke came out yellow
 * or pink. So a translucent border colour is blended onto its background first (`solid`).
 *
 * Both helpers also accept what users and imported files contain — "#abc", "rgb(…)",
 * "rgba(…)", 8-digit hex — where the old `accent + '30'` produced invalid colours (drawn black).
 */

const hex2 = (n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');

/** [r, g, b, a] (0–255, alpha 0–1) of a hex or rgb()/rgba() colour, else null. */
export function parseColor(color) {
  const c = String(color || '').trim().toLowerCase();
  let m = /^#([0-9a-f]{3,4})$/.exec(c);
  if (m) {
    const [r, g, b, a = 'f'] = m[1].split('');
    return [parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16), parseInt(a + a, 16) / 255];
  }
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(c);
  if (m) {
    const n = parseInt(m[1], 16);
    return [n >> 16, (n >> 8) & 255, n & 255, m[2] ? parseInt(m[2], 16) / 255 : 1];
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(c);
  if (m) {
    const alpha = m[4] === undefined ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]));
    return [+m[1], +m[2], +m[3], Math.max(0, Math.min(1, alpha))];
  }
  return null;
}

/**
 * An opaque "#rrggbb" for borders: `color` at `alpha` (times its own alpha) over `background`.
 * Colours it cannot read (e.g. names) pass through unchanged.
 */
export function solid(color, alpha = 1, background = '#ffffff') {
  const c = parseColor(color);
  if (!c) return color;
  const bg = parseColor(background) || [255, 255, 255, 1];
  const a = c[3] * alpha;
  return `#${[0, 1, 2].map((i) => hex2(c[i] * a + bg[i] * (1 - a))).join('')}`;
}

/**
 * Body and secondary text in the user's Text colour: `text` blended toward the white page,
 * opaque, so it prints and copies out like any other text, and a custom Text colour reaches
 * every run. At the default Text colour (#111111, what every new résumé stores) the body is
 * exactly the #333333 the sections used to hard-code, and the secondary shades have the old
 * greys' lightness in neutral grey instead of their slate tint (R2-5):
 *   body   #333333               descriptions, bullets, the summary
 *   sub    #545454 (was #4b5563) subtitles, skills, issuers, proficiency, contacts, grey dates
 *   meta   #707070 (was #6b7280) technologies, relationship, phone, list markers
 *   muted  #a0a0a0 (was #9ca3af) locations, credential IDs, light dates
 * A résumé that stores no Text colour (an import, older data) takes its template's default,
 * and that colour's tint: Modern's slate prints slate greys.
 */
export function textShades(text) {
  return { body: solid(text, 0.857), sub: solid(text, 0.72), meta: solid(text, 0.6), muted: solid(text, 0.4) };
}

/**
 * The Bar "|" and Bullet "•" contact marks' colours on the white page: the light greys the
 * contact line has always drawn them in, a step lighter than its values (PdfContactRow). The
 * Word exports print their marks in the same (contactSeparator); a band has its own
 * (letterheadLook's marks).
 */
export const PAGE_MARKS = { bar: '#cccccc', bullet: '#bbbbbb' };

/**
 * The `opacity` to give a Text drawn in `color`: react-pdf's opacity replaces the colour's own
 * alpha instead of multiplying it, so a translucent colour's alpha is multiplied in here, as CSS
 * opacity would (FIDB-11, R5-9).
 */
export function opacityFor(color, opacity) {
  return opacity * (parseColor(color)?.[3] ?? 1);
}

/** `color` at `alpha` as "#rrggbbaa", for fills. Unreadable colours pass through unchanged. */
export function tint(color, alpha = 1) {
  const c = parseColor(color);
  if (!c) return color;
  const a = c[3] * alpha;
  return `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}${a >= 1 ? '' : hex2(a * 255)}`;
}

/** WCAG relative luminance (0–1) of an opaque [r, g, b]. */
function luminance([r, g, b]) {
  const lin = (v) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Whether light text is what reads on `background` (luminance below 0.18, where white and black
 * contrast equally, both ≥ 4.58:1): the side readableOn lightens toward. Readable colours only.
 */
const takesLightText = (background) => luminance(parseColor(solid(background))) < 0.18;

/**
 * WCAG contrast ratio (1–21) of `color` drawn on `background` (a translucent colour is blended
 * onto it first); null when either colour cannot be read.
 */
export function contrast(color, background = '#ffffff') {
  const bg = parseColor(solid(background));
  const fg = bg && parseColor(solid(color, 1, background));
  if (!bg || !fg) return null;
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * `color` when it reads on `background` (contrast ≥ `min`; 4.5 is WCAG AA for body text), else
 * the least-lightened tint of it that does — mixed toward white on a dark background, toward
 * black on a light one — as "#rrggbb". Colours it cannot read pass through unchanged.
 */
export function readableOn(color, background, min = 4.5) {
  const current = contrast(color, background);
  if (current == null || current >= min) return color;
  const base = solid(color, 1, background);
  const toward = takesLightText(background) ? '#ffffff' : '#000000';
  for (let step = 1; step < 50; step += 1) {
    const mixed = solid(toward, step / 50, base);
    if (contrast(mixed, background) >= min) return mixed;
  }
  return toward;
}

const SIDEBAR_NAVY = '#1e293b';

/**
 * The Sidebar column's colours on its background `bg` (Design → Sidebar Background). Each text
 * colour is the navy palette's wherever it reads on `bg` — on the default navy all four do, so
 * the column looks as it always has — else the least-shifted tint that does (readableOn): a
 * light background gets dark text instead of text that vanishes, a blue or green one gets
 * lighter dates (R2-2).
 *   strong  #e2e8f0  names, degrees, languages, the column's default text
 *   value   #cbd5e1  descriptions, bullets, skills, contact values, links
 *   label   #94a3b8  section titles, contact labels and icons, institutions, issuers
 *   meta    #64748b  dates, GPA, proficiency, IDs, relationship, phone, skill categories
 *   fill    #334155  chips, skill-bar tracks, the rule under titles: one step off the background
 *   chip             chip text, readable on `fill`, in the column's ink (light or dark)
 * The fill steps toward the text's pole (lighter on a dark column) unless that step crosses to
 * the other side of readableOn's threshold — a mid-tone such as the default accent #2563eb —
 * where chip text would take the opposite ink from the rest of the column; there it steps the
 * other way (R7-8).
 */
export function sidebarShades(bg = SIDEBAR_NAVY) {
  const base = parseColor(solid(bg)) ? solid(bg) : SIDEBAR_NAVY;
  const dark = takesLightText(base);
  const step = (pole) => solid(pole, dark ? 0.1 : 0.07, base);
  const toward = step(dark ? '#ffffff' : '#000000');
  const fill = base === SIDEBAR_NAVY ? '#334155'
    : (takesLightText(toward) === dark ? toward : step(dark ? '#000000' : '#ffffff'));
  const value = readableOn('#cbd5e1', base, 4.5);
  return {
    strong: readableOn('#e2e8f0', base, 7),
    value,
    label: readableOn('#94a3b8', base, 4.5),
    meta: readableOn('#64748b', base, 3),
    fill,
    chip: readableOn(value, fill, 4.5),
  };
}
