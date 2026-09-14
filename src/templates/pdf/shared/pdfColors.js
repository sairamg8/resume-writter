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
 * opaque, so it prints and copies out like any other text. At the default Text colour
 * (#111111) the shades are the greys the sections used to hard-code — a résumé in the default
 * colour looks as before — and a custom Text colour reaches every run.
 *   body   #333333    descriptions, bullets, the summary
 *   sub    ≈ #4b5563  subtitles, skills, issuers, proficiency, contacts, grey dates
 *   meta   ≈ #6b7280  technologies, relationship, phone, list markers
 *   muted  ≈ #9ca3af  locations, credential IDs, light dates
 */
export function textShades(text) {
  return { body: solid(text, 0.857), sub: solid(text, 0.72), meta: solid(text, 0.6), muted: solid(text, 0.4) };
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
  const toward = luminance(parseColor(solid(background))) < 0.18 ? '#ffffff' : '#000000';
  for (let step = 1; step < 50; step += 1) {
    const mixed = solid(toward, step / 50, base);
    if (contrast(mixed, background) >= min) return mixed;
  }
  return toward;
}
