import { Font } from '@react-pdf/renderer';
import { decodeEntities } from '@/utils/richText';
import { FONTSOURCE_CDN as CDN, fetchMetadata, fontsourceId } from '@/utils/fontsource';
import { glyphCodePoints, isPresentationForm, needsOf, scriptCandidates, scriptClaims, STAND_INS } from './pdfFontCoverage';

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
 *   other symbols from Noto Sans Symbols 2. A script no bundled face draws — CJK, Korean, Arabic,
 *   Hebrew, Thai, Indic … — comes from the chosen font's own subset when it has one (Noto Sans JP's
 *   japanese), else from that script's Noto font; emoji from Noto Emoji (pdfFontCoverage.js, R2-010).
 */

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

// Every Noto Sans face that ships with the app, by "<subset>-<weight>-<style>".
const NOTO_FILES = Object.fromEntries(Object.entries(
  import.meta.glob('/node_modules/@fontsource/noto-sans/files/noto-sans-*-{400,500,700}-{normal,italic}.woff', {
    query: '?url', import: 'default', eager: true,
  }),
).map(([path, url]) => [path.match(/noto-sans-(.+)\.woff$/)[1], url]));

// react-pdf in Node (the tests) reads a relative URL as a file path; the origin is captured
// when this module loads.
const ORIGIN = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
const absolute = (url) => (/^https?:/.test(url) ? url : `${ORIGIN}${url}`);

/**
 * A long token's break mark: a part with no characters that textkit still counts as a part.
 * textkit (@react-pdf/textkit 6.3, wrapWords and getNodes) turns a part that trims to "" into a
 * zero-width glue, and puts a hyphen penalty in front of it only when the part is truthy — an
 * object, not the falsy ''. So the mark adds nothing to the text, and the penalty in front of it
 * keeps the optimal line breaker off the mark (a glue after a penalty is no break there): a URL
 * that fits on the next line moves there whole, and only its best-fit pass — for a token longer
 * than its line — breaks at a mark, with no hyphen (every Text forbids the penalty itself, R4-10).
 * It answers what textkit asks of a part: replaceAll (soft-hyphen removal), trim, length, and
 * '' when joined into the string. 20-long-urls pins all of it, through pdf.js and pdftotext.
 */
export const BREAK_MARK = Object.freeze({ length: 0, trim: () => '', replaceAll() { return this; }, toString: () => '' });

/** Where a long token may break: after each of / . - _ @ ? & = # (a String.split separator). */
export const BREAK_AFTER = /(?<=[/.\-_@?&=#])/;

/**
 * A hyphenation callback that never hyphenates, but lets a long unbroken token — a URL, an
 * e-mail address — break after / . - _ @ ? & = # (or every `max` characters) instead of running
 * off the page, at BREAK_MARK. The mark used to be U+FEFF, which fontkit draws as a zero-width
 * space glyph: pdf.js — and so pdf-parse and other ATS pipelines — read every one as a space,
 * "github. com/ jordan- rivera- sample/". Now a URL reads as typed wherever it sits on one line.
 * Tokens up to `max` characters are left whole.
 */
export function breakLongWords(max) {
  return (word) => {
    if (word.length <= max) return [word];
    const parts = word.split(BREAK_AFTER).flatMap((p) => p.match(new RegExp(`.{1,${max}}`, 'gsu')) || [p]);
    return parts.flatMap((p, i) => (i ? [BREAK_MARK, p] : [p]));
  };
}

let hyphenationSet = false;
/** Words are never hyphenated — résumé text should read as typed. Very long tokens may break. */
export function ensureNoHyphenation() {
  if (hyphenationSet) return;
  Font.registerHyphenationCallback(breakLongWords(48));
  hyphenationSet = true;
}

// Weights the templates use: regular, medium (the job title in inline headers) and bold.
const WEIGHTS = [400, 500, 700];

/** Register a family from faceUrl(weight, style) for every weight in WEIGHTS × normal/italic. */
function registerFaces(family, faceUrl) {
  const fonts = [];
  for (const fontStyle of ['normal', 'italic']) {
    for (const fontWeight of WEIGHTS) fonts.push({ src: absolute(faceUrl(fontWeight, fontStyle)), fontWeight, fontStyle });
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

/** Fallback families, by range, for the characters in `text` that the primary (latin) face lacks. */
async function fallbacksFor(text, primary) {
  const { subsets, symbols, own } = needsOf(text, primary?.meta.subsets || []);
  const families = [];
  for (const subset of subsets) {
    if (primary?.meta.subsets?.includes(subset)) {
      families.push(registerCdn(`${primary.family} ${subset}`, primary.pkg, primary.meta, subset, { fallback: true }));
    }
    if (NOTO_FILES[`${subset}-400-normal`]) families.push(registerNoto(subset));
  }
  // The chosen font's own script subsets: Noto Sans JP draws Japanese in Noto Sans JP.
  for (const subset of own) families.push(registerCdn(`${primary.family} ${subset}`, primary.pkg, primary.meta, subset, { fallback: true }));
  for (const font of symbols) {
    const meta = await fetchMetadata(font.pkg);
    if (meta) families.push(registerCdn(font.family, font.pkg, meta, font.subset, { fallback: true }));
  }
  return families;
}

/** The code points in `cps` that no loaded face of `families` draws. */
function undrawn(cps, families) {
  const store = Font.getRegisteredFonts();
  const faces = families.map((f) => (store[f]?.sources || []).find((s) => s.data)?.data).filter(Boolean);
  return cps.filter((cp) => !faces.some((font) => typeof font.hasGlyphForCodePoint === 'function' && font.hasGlyphForCodePoint(cp)));
}

/**
 * Pass 2, by glyph: for the characters no face of `usable` draws, the Noto font of their script,
 * loaded one at a time until each is drawn or no candidate is left (pdfFontCoverage.js). A family
 * is named for its package and subset — "Noto Sans JP japanese" — as a chosen font's own subset is,
 * so the two never register different files under one name.
 */
async function scriptFallbacks(text, usable) {
  let missing = undrawn(glyphCodePoints(text), usable);
  const added = [];
  for (const font of missing.length ? scriptCandidates(missing, text) : []) {
    if (!missing.some((cp) => scriptClaims(font, cp))) continue;
    const meta = await fetchMetadata(font.pkg);
    // A symbol font is taken as pass 1 takes it: Noto Sans Math's metadata lists no 'math' subset,
    // though its math files are there.
    if (!meta || (!font.name && !meta.subsets?.includes(font.subset))) continue;
    const [family] = await prepareFonts([registerCdn(font.name || `${font.family} ${font.subset}`, font.pkg, meta, font.subset, { fallback: true })]);
    if (!family) continue; // offline, or blocked: the characters stay undrawn, the PDF still renders
    if (usable.includes(family) || added.includes(family)) continue;
    added.push(family);
    missing = undrawn(missing, [family]);
    if (!missing.length) break;
  }
  return added;
}

/**
 * The fontFamily for a PDF of `text` in the chosen font: the family name, or a fallback list
 * [chosen, …fallbacks]. Fonts are loaded and primed before it returns. A font that cannot be
 * loaded (offline, or not a Fontsource font) is replaced by Noto Sans rather than failing.
 */
export async function resolvePdfFonts(settings, text = '') {
  ensureNoHyphenation();
  const primary = await chosenFont(settings);
  const families = [primary ? primary.family : 'NotoSans', ...(await fallbacksFor(text, primary))];
  let usable = await prepareFonts(families);
  // The chosen font could not be loaded at all (offline, blocked): Noto Sans takes its place.
  if (primary && usable[0] !== primary.family) usable = await prepareFonts(['NotoSans', ...usable]);
  usable = [...usable, ...(await scriptFallbacks(text, usable))];
  return { fontFamily: usable.length > 1 ? usable : usable[0] };
}

const primedFonts = new WeakSet();

/**
 * What every layout asks of a font that asks nothing (textkit passes no features): ligatures off.
 * A ligature glyph — "ff", "fi", "ffi", "ffl" — is one glyph for two or three letters, and it is
 * in the PDF's ToUnicode only if the glyph object fontkit cached for it carries those letters.
 * That cache keeps the first request, and other lookups create glyphs with no characters, so in a
 * long session a ligature could reach the PDF with no entry at all: "staff" was read as "sta\x1f"
 * by pdf.js and "sta\ufffd" by MuPDF, and react-pdf's own tracker has the same report for "ff" and
 * "fi" in registered fonts (#915, #3009). Without ligatures every glyph is one character, and
 * kerning is untouched.
 */
const noLigatures = () => ({ liga: false, clig: false }); // a new object each call: fontkit adds features to it

/**
 * Poppler's `pdftotext -raw` drops the U+0020 glyphs and re-derives words from the visual gap, merging
 * two words across a gap of ~0.201 em or less (Poppler 26.01) — "Builtthecheckoutflow". Of the picker,
 * Lato (0.193 em), Source Sans 3 and Literata (0.200 em) ship a space under it; IBM Plex Sans (0.236)
 * and every wider font (Roboto 0.248, Noto Sans 0.260, Inter 0.281) do not. widenNarrowSpace() lifts a
 * too-narrow space to MIN_SPACE_EM in the laid-out run (the glyph still maps to U+0020; under 0.3 pt at
 * 10 pt; the run's xAdvance, not the metric, so kerning cannot undo it). That is before line breaking:
 * a line react-pdf closes up to fit, or a negative letterSpacing, narrows gaps after it. The textkit
 * patch (.yarn/patches/@react-pdf-textkit-*.patch, ATS-4) floors every laid-out word gap at its
 * KEEP_SPACE_EM, taken from the letters so breaks and widths hold. Keep the two equal.
 */
const MIN_SPACE_EM = 0.22;

/**
 * Wrap font.layout so a run's space glyphs advance at least MIN_SPACE_EM, without touching any other
 * glyph. Returns the wrapper; when the font's space already clears the bar it returns `layout`
 * unchanged, so nothing is measured per run.
 */
function widenNarrowSpace(font, layout) {
  const space = typeof font.glyphForCodePoint === 'function' ? font.glyphForCodePoint(0x20) : null;
  const minAdvance = MIN_SPACE_EM * (font.unitsPerEm || 1000);
  if (!space || space.advanceWidth >= minAdvance) return layout;
  return (string, features, ...rest) => {
    const run = layout(string, features, ...rest);
    if (run && run.glyphs && run.positions) {
      for (let i = 0; i < run.glyphs.length; i += 1) {
        const pos = run.positions[i];
        if (run.glyphs[i] && run.glyphs[i].id === space.id && pos && pos.xAdvance < minAdvance) pos.xAdvance = minAdvance;
      }
    }
    return run;
  };
}

/**
 * Draw a character the face lacks with its stand-in (STAND_INS: ‐ as '-', U+202F as ' '), when the
 * face has that. It answers through the face's cmap, so textkit picks this face for the character,
 * layout draws the stand-in's glyph, and that glyph — seeded from the cmap first — keeps the
 * stand-in's text in the PDF's ToUnicode.
 */
function addStandIns(font) {
  const cmap = font._cmapProcessor;
  if (!cmap || typeof cmap.lookup !== 'function') return;
  const lookup = cmap.lookup.bind(cmap);
  cmap.lookup = (codePoint, variationSelector) => {
    const glyph = lookup(codePoint, variationSelector);
    if (glyph || variationSelector || !STAND_INS.has(codePoint)) return glyph;
    return lookup(STAND_INS.get(codePoint));
  };
}

/**
 * Load every registered face of `families` and get their fontkit fonts ready to render;
 * returns the families that can be used, in order. Call before every render.
 *
 * 1. Seed fontkit's glyph cache from each cmap. fontkit caches one glyph object per glyph id,
 *    carrying the characters of the FIRST request. Embedding a composite glyph requests its
 *    components with no characters — the middle dot "·" is drawn from the period's outline,
 *    "é" from "e" — so a later "." got an empty ToUnicode entry: the PDF looked right, but
 *    copy-paste and ATS parsers read "me@example.com" as "me@examplecom".
 * 2. Give each fallback font its own PostScript name. Every subset file of a typeface carries
 *    the same name ("NotoSans-Regular"), and the PDF writer reuses an embedded font by name,
 *    so Cyrillic glyph ids were written into the Latin font ("Привет" printed as "Пeивеg").
 * 3. Lay every face out with ligatures off (noLigatures), so no glyph stands for several letters.
 * 4. Widen a too-narrow space in the laid-out run (widenNarrowSpace), so `pdftotext -raw` reads the
 *    narrow-space fonts' words apart instead of glued.
 * 5. Draw a dash or space the face lacks with its stand-in (addStandIns), after the seeding in 1.
 */
export async function prepareFonts(families) {
  const store = Font.getRegisteredFonts();
  const usable = [];
  for (const family of families) {
    const sources = store[family]?.sources || [];
    const loaded = await Promise.all(sources.map((source) => source.load().then(() => true, () => false)));
    if (!loaded.some(Boolean)) continue; // nothing of this family loads: leave it out of the chain
    // A face that failed (a CDN hiccup) borrows the nearest loaded face of the family, or
    // react-pdf would retry it during layout and fail the whole PDF.
    sources.forEach((source, i) => {
      if (loaded[i]) return;
      const donor = sources
        .filter((_, j) => loaded[j])
        .sort((a, b) => (a.fontStyle !== source.fontStyle) - (b.fontStyle !== source.fontStyle)
          || Math.abs(a.fontWeight - source.fontWeight) - Math.abs(b.fontWeight - source.fontWeight))[0];
      source.data = donor.data;
      source.loadResultPromise = Promise.resolve();
    });
    for (const { data: font } of sources) {
      if (!font || primedFonts.has(font) || typeof font.glyphForCodePoint !== 'function') continue;
      for (const codePoint of font.characterSet || []) if (!isPresentationForm(codePoint)) font.glyphForCodePoint(codePoint);
      addStandIns(font);
      if (typeof font.layout === 'function') {
        const base = font.layout.bind(font);
        const noLig = (string, features, ...rest) => base(string, features ?? noLigatures(), ...rest);
        font.layout = widenNarrowSpace(font, noLig);
      }
      if (fallbackFamilies.has(family)) {
        const name = `${font.postscriptName}-${family.replace(/[^A-Za-z0-9]+/g, '')}`;
        Object.defineProperty(font, 'postscriptName', { value: name, configurable: true });
      }
      primedFonts.add(font);
    }
    usable.push(family);
  }
  return usable;
}
