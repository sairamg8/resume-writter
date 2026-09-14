import { Font } from '@react-pdf/renderer';
import { decodeEntities } from '@/utils/richText';

/**
 * Fonts for the PDF (which is also the editor preview).
 *
 * - Noto Sans, the default, ships with the app (@fontsource/noto-sans), so the default PDF
 *   needs no network.
 * - The picker's other fonts and any custom Google Font come from Fontsource on jsDelivr.
 *   They are registered from the package's metadata.json, so only faces that exist are
 *   registered: a font without bold or italic no longer breaks the render (a missing face
 *   borrows the nearest one), and a name that is not a Fontsource font falls back to Noto Sans.
 * - Characters the chosen font lacks are drawn by a fallback font, added only when the text
 *   needs it: the same font's latin-ext / cyrillic / greek / vietnamese subset when it has one,
 *   else Noto Sans's (bundled; devanagari too); arrows and maths from Noto Sans Math; ✓ ★ ☎ and
 *   other symbols from Noto Sans Symbols 2.
 */

const CDN = 'https://cdn.jsdelivr.net/npm/@fontsource';

/** settings.font id → Fontsource package. Georgia is not a web font: Gelasio is its metric twin. */
export const FONT_MAP = {
  notosans:    { pkg: 'noto-sans',      family: 'NotoSans', local: true },
  inter:       { pkg: 'inter',          family: 'Inter' },
  opensans:    { pkg: 'open-sans',      family: 'Open Sans' },
  firasans:    { pkg: 'fira-sans',      family: 'Fira Sans' },
  ibmplexsans: { pkg: 'ibm-plex-sans',  family: 'IBM Plex Sans' },
  asap:        { pkg: 'asap',           family: 'Asap' },
  roboto:      { pkg: 'roboto',         family: 'Roboto' },
  lato:        { pkg: 'lato',           family: 'Lato' },
  sourcesans:  { pkg: 'source-sans-3',  family: 'Source Sans 3' },
  georgia:     { pkg: 'gelasio',        family: 'Gelasio' },
  sourceserif: { pkg: 'source-serif-4', family: 'Source Serif 4' },
  ptserif:     { pkg: 'pt-serif',       family: 'PT Serif' },
  literata:    { pkg: 'literata',       family: 'Literata' },
};

// Google Fonts subset ranges (shared by every Fontsource font). Latin is the primary face.
const SUBSETS = {
  'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
  cyrillic: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116',
  'cyrillic-ext': 'U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F',
  greek: 'U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF',
  'greek-ext': 'U+1F00-1FFF',
  vietnamese: 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB',
  devanagari: 'U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20A8,U+20B9,U+20F0,U+25CC,U+A830-A839,U+A8E0-A8FF,U+11B00-11B09',
};
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const SYMBOL_FONTS = [
  { family: 'Noto Sans Math', pkg: 'noto-sans-math', subset: 'math', ranges: 'U+2190-22FF,U+27C0-27FF,U+2900-2AFF' },
  { family: 'Noto Sans Symbols 2', pkg: 'noto-sans-symbols-2', subset: 'symbols', ranges: 'U+2300-23FF,U+25A0-27BF,U+2B00-2BFF' },
];

const parseRanges = (s) => s.split(',').map((r) => {
  const [a, b] = r.replace('U+', '').split('-');
  return [parseInt(a, 16), parseInt(b || a, 16)];
});
const inRanges = (cp, ranges) => ranges.some(([a, b]) => cp >= a && cp <= b);
const LATIN_RANGES = parseRanges(LATIN);
const SUBSET_RANGES = Object.entries(SUBSETS).map(([subset, r]) => [subset, parseRanges(r)]);
const SYMBOL_RANGES = SYMBOL_FONTS.map((f) => [f, parseRanges(f.ranges)]);

// Every Noto Sans face that ships with the app, by "<subset>-<weight>-<style>".
const NOTO_FILES = Object.fromEntries(Object.entries(
  import.meta.glob('/node_modules/@fontsource/noto-sans/files/noto-sans-*-{400,700}-{normal,italic}.woff', {
    query: '?url', import: 'default', eager: true,
  }),
).map(([path, url]) => [path.match(/noto-sans-(.+)\.woff$/)[1], url]));

// react-pdf in Node (the tests) reads a relative URL as a file path; the origin is captured
// when this module loads.
const ORIGIN = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
const absolute = (url) => (/^https?:/.test(url) ? url : `${ORIGIN}${url}`);

let hyphenationSet = false;
/** Words are never hyphenated — résumé text should read as typed. */
export function ensureNoHyphenation() {
  if (hyphenationSet) return;
  Font.registerHyphenationCallback((word) => [word]);
  hyphenationSet = true;
}

/** Register a family whose faces are known: { '400-normal': url, … } for weights 400/700 × normal/italic. */
function registerFaces(family, faceUrl) {
  const fonts = [];
  for (const fontStyle of ['normal', 'italic']) {
    for (const fontWeight of [400, 700]) fonts.push({ src: absolute(faceUrl(fontWeight, fontStyle)), fontWeight, fontStyle });
  }
  Font.register({ family, fonts });
}

function registerNoto(subset) {
  const family = subset === 'latin' ? 'NotoSans' : `NotoSans ${subset}`;
  if (!registeredFamilies.has(family)) {
    registerFaces(family, (w, s) => NOTO_FILES[`${subset}-${w}-${s}`]);
    registeredFamilies.add(family);
    if (subset !== 'latin') fallbackFamilies.add(family);
  }
  return family;
}

const registeredFamilies = new Set();
// Families that only ever back up another font (a subset or a symbol font). See prepareFonts.
const fallbackFamilies = new Set();
registerNoto('latin');
ensureNoHyphenation();

// ── Fontsource (CDN) fonts ───────────────────────────────────────────────────

const metadata = new Map(); // pkg → Promise<metadata | null>

/** A Fontsource package's metadata.json, or null when the package does not exist / is offline. */
function fetchMetadata(pkg) {
  if (!metadata.has(pkg)) {
    metadata.set(pkg, fetch(`${CDN}/${pkg}@5/metadata.json`, { credentials: 'omit' })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => (m && Array.isArray(m.weights) && Array.isArray(m.styles) ? m : null))
      .catch(() => {
        metadata.delete(pkg); // offline: try again next render
        return null;
      }));
  }
  return metadata.get(pkg);
}

const nearest = (weights, target) => weights.reduce((best, w) => (Math.abs(w - target) < Math.abs(best - target) ? w : best));

/** Register `family` from Fontsource `pkg` and `subset`, using only faces the package has. */
function registerCdn(family, pkg, meta, subset, { fallback = false } = {}) {
  if (fallback) fallbackFamilies.add(family);
  if (registeredFamilies.has(family)) return family;
  const hasItalic = meta.styles.includes('italic');
  registerFaces(family, (weight, style) => {
    const w = nearest(meta.weights, weight);
    const s = style === 'italic' && hasItalic ? 'italic' : 'normal';
    return `${CDN}/${pkg}@5/files/${pkg}-${subset}-${w}-${s}.woff`;
  });
  registeredFamilies.add(family);
  return family;
}

/** Fontsource package id for a font name: "Playfair Display" → "playfair-display". */
export const fontsourceId = (name) => String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Is `name` a font the PDF can use? Resolves { ok, family } — used before saving a custom font. */
export async function checkFont(name) {
  const pkg = fontsourceId(name);
  const meta = pkg ? await fetchMetadata(pkg) : null;
  return meta ? { ok: true, family: meta.family || name } : { ok: false, family: null };
}

/** The chosen font: { family, pkg, meta } for a Fontsource font, null for bundled Noto Sans. */
async function chosenFont(settings) {
  const custom = String(settings?.customFont || '').trim();
  const config = custom ? { pkg: fontsourceId(custom) } : (FONT_MAP[settings?.font] || FONT_MAP.notosans);
  if (config.local) return null;
  const meta = await fetchMetadata(config.pkg);
  if (!meta) return null;
  const subset = meta.subsets?.includes('latin') ? 'latin' : (meta.defSubset || 'latin');
  return { family: registerCdn(meta.family || config.family || custom, config.pkg, meta, subset), pkg: config.pkg, meta };
}

// ── Text coverage ────────────────────────────────────────────────────────────

/** Every character a résumé can print (photos and icons, being data URLs, contribute nothing). */
export function collectText(value) {
  const parts = [];
  const walk = (v) => {
    if (typeof v === 'string') { if (!v.startsWith('data:')) parts.push(v); return; }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(value);
  return decodeEntities(parts.join('\n'));
}

/** Fallback families for the characters in `text` that the primary (latin) face lacks. */
async function fallbacksFor(text, primary) {
  const subsets = new Set();
  const symbols = new Set();
  for (const ch of new Set(text)) {
    const cp = ch.codePointAt(0);
    if (cp < 0x80 || inRanges(cp, LATIN_RANGES)) continue;
    const subset = SUBSET_RANGES.find(([, ranges]) => inRanges(cp, ranges));
    if (subset) { subsets.add(subset[0]); continue; }
    const symbol = SYMBOL_RANGES.find(([, ranges]) => inRanges(cp, ranges));
    if (symbol) symbols.add(symbol[0]);
  }
  const families = [];
  for (const subset of Object.keys(SUBSETS)) {
    if (!subsets.has(subset)) continue;
    if (primary?.meta.subsets?.includes(subset)) {
      families.push(registerCdn(`${primary.family} ${subset}`, primary.pkg, primary.meta, subset, { fallback: true }));
    }
    if (NOTO_FILES[`${subset}-400-normal`]) families.push(registerNoto(subset));
  }
  for (const font of SYMBOL_FONTS) {
    if (!symbols.has(font)) continue;
    const meta = await fetchMetadata(font.pkg);
    if (meta) families.push(registerCdn(font.family, font.pkg, meta, font.subset, { fallback: true }));
  }
  return families;
}

/**
 * The fontFamily for a PDF of `text` in the chosen font: the family name, or a fallback list
 * [chosen, …fallbacks]. Fonts are loaded and primed before it returns. A font that cannot be
 * loaded (offline, or not a Fontsource font) is replaced by Noto Sans rather than failing.
 */
export async function resolvePdfFonts(settings, text = '') {
  ensureNoHyphenation();
  let primary = await chosenFont(settings);
  if (primary && !(await loads(primary.family))) primary = null;
  const families = [primary ? primary.family : 'NotoSans', ...(await fallbacksFor(text, primary))];
  const usable = [];
  for (const family of families) if (family === families[0] || await loads(family)) usable.push(family);
  await prepareFonts(usable);
  return { fontFamily: usable.length > 1 ? usable : usable[0] };
}

/** Does the family's regular face load? */
async function loads(family) {
  const source = Font.getRegisteredFonts()[family]?.sources.find((s) => s.fontWeight === 400 && s.fontStyle === 'normal');
  if (!source) return false;
  try {
    await source.load();
    return true;
  } catch {
    return false;
  }
}

const primedFonts = new WeakSet();

/**
 * Load every registered face of `families` and get their fontkit fonts ready to render.
 * Call before every render.
 *
 * 1. Seed fontkit's glyph cache from each cmap. fontkit caches one glyph object per glyph id,
 *    carrying the characters of the FIRST request. Embedding a composite glyph requests its
 *    components with no characters — the middle dot "·" is drawn from the period's outline,
 *    "é" from "e" — so a later "." got an empty ToUnicode entry: the PDF looked right, but
 *    copy-paste and ATS parsers read "me@example.com" as "me@examplecom".
 * 2. Give each fallback font its own PostScript name. Every subset file of a typeface carries
 *    the same name ("NotoSans-Regular"), and the PDF writer reuses an embedded font by name,
 *    so Cyrillic glyph ids were written into the Latin font ("Привет" printed as "Пeивеg").
 */
export async function prepareFonts(families) {
  const store = Font.getRegisteredFonts();
  const entries = families.flatMap((family) => (store[family]?.sources || []).map((source) => ({ family, source })));
  // A face that fails to load is left to react-pdf, which reports it when the face is used.
  await Promise.all(entries.map(({ source }) => source.load().catch(() => null)));
  for (const { family, source: { data: font } } of entries) {
    if (!font || typeof font.glyphForCodePoint !== 'function') continue;
    if (!primedFonts.has(font)) {
      for (const codePoint of font.characterSet || []) font.glyphForCodePoint(codePoint);
      if (fallbackFamilies.has(family)) {
        const name = `${font.postscriptName}-${family.replace(/[^A-Za-z0-9]+/g, '')}`;
        Object.defineProperty(font, 'postscriptName', { value: name, configurable: true });
      }
      primedFonts.add(font);
    }
  }
}
