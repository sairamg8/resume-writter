/**
 * Which faces a résumé's text needs besides the chosen font's Latin face: the Unicode ranges of
 * the Fontsource subsets and of the scripts no bundled face draws, and the Noto font for each.
 * Pure data and classification — pdfFontLoader.js registers and loads what this names.
 *
 * Two passes (pdfFontLoader's resolvePdfFonts):
 * 1. By range, before anything is loaded (needsOf): the chosen font's own subsets (latin-ext …
 *    japanese, arabic), bundled Noto Sans subsets, and the symbol fonts.
 * 2. By glyph, after loading (scriptCandidates): a character no loaded face draws — 王, محمد, 🚀,
 *    or ✅ that Noto Sans Symbols 2 lacks — brings in the Noto font of its script, one at a time,
 *    until every such character is drawn or no candidate is left. Without it the character fell
 *    through every face to react-pdf's last resort, Helvetica, whose WinAnsi encoding printed
 *    mojibake: pdf.js read '王小明' as "‹q¬'f" (R2-010).
 */

// Google Fonts subset ranges (shared by every Fontsource font). Latin is the primary face.
export const SUBSETS = {
  'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
  cyrillic: 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116',
  'cyrillic-ext': 'U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F',
  greek: 'U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF',
  'greek-ext': 'U+1F00-1FFF',
  vietnamese: 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB',
  devanagari: 'U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20A8,U+20B9,U+20F0,U+25CC,U+A830-A839,U+A8E0-A8FF,U+11B00-11B09',
};
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
export const SYMBOL_FONTS = [
  { family: 'Noto Sans Math', pkg: 'noto-sans-math', subset: 'math', ranges: 'U+2190-22FF,U+27C0-27FF,U+2900-2AFF,U+1D400-1D7FF' },
  { family: 'Noto Sans Symbols 2', pkg: 'noto-sans-symbols-2', subset: 'symbols', ranges: 'U+2300-23FF,U+25A0-27BF,U+2B00-2BFF' },
];

const HAN = 'U+2E80-2FDF,U+3000-303F,U+3100-312F,U+31A0-31EF,U+3200-33FF,U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF,U+FE30-FE4F,U+FF00-FF64,U+FFE0-FFEF,U+20000-323AF';
const KANA = 'U+3040-30FF,U+31F0-31FF,U+FF65-FF9F';
const HANGUL = 'U+1100-11FF,U+3130-318F,U+A960-A97F,U+AC00-D7FF';

/**
 * Scripts no bundled face draws: the Fontsource subset that has them, the font that has that
 * subset (Noto Sans <name>, or the family given), the block ranges that ask for it, and (CJK) the
 * `hint` — characters only that language writes — that puts its font first. Every entry is a real
 * Fontsource package with that subset (checked against each package's metadata.json, 2026-09-23).
 * A chosen font with the subset draws the script itself (Noto Sans JP's japanese); otherwise this
 * font does.
 *
 * Arabic is IBM Plex Sans Arabic, not Noto: Noto Sans Arabic (and Naskh, and Kufi) draws a letter
 * as a dotless skeleton plus a separate dot glyph, and ب ت ث ن ي share one skeleton. A PDF maps
 * each glyph to one text, so its text layer — copy-paste, and every ATS — read 'أحمد' as 'أجمد'
 * with control characters for the dots. IBM Plex Sans Arabic draws every letter form whole.
 */
export const SCRIPT_FONTS = [
  ['arabic', 'IBM Plex Sans Arabic', 'U+0600-06FF,U+0750-077F,U+0870-08FF,U+FB50-FDFF,U+FE70-FEFF'],
  ['hebrew', 'Hebrew', 'U+0590-05FF,U+FB1D-FB4F'],
  ['thai', 'Thai', 'U+0E00-0E7F'],
  ['lao', 'Lao', 'U+0E80-0EFF'],
  ['khmer', 'Khmer', 'U+1780-17FF,U+19E0-19FF'],
  ['myanmar', 'Myanmar', 'U+1000-109F,U+A9E0-A9FF,U+AA60-AA7F'],
  ['bengali', 'Bengali', 'U+0980-09FF'],
  ['gurmukhi', 'Gurmukhi', 'U+0A00-0A7F'],
  ['gujarati', 'Gujarati', 'U+0A80-0AFF'],
  ['oriya', 'Oriya', 'U+0B00-0B7F'],
  ['tamil', 'Tamil', 'U+0B80-0BFF,U+11FC0-11FFF'],
  ['telugu', 'Telugu', 'U+0C00-0C7F'],
  ['kannada', 'Kannada', 'U+0C80-0CFF'],
  ['malayalam', 'Malayalam', 'U+0D00-0D7F'],
  ['sinhala', 'Sinhala', 'U+0D80-0DFF,U+111E0-111FF'],
  ['armenian', 'Armenian', 'U+0530-058F,U+FB13-FB17'],
  ['georgian', 'Georgian', 'U+10A0-10FF,U+1C90-1CBF,U+2D00-2D2F'],
  ['ethiopic', 'Ethiopic', 'U+1200-139F,U+2D80-2DDF,U+AB00-AB2F'],
  // Han is shared: Chinese first, unless kana or hangul say the text is Japanese or Korean.
  ['chinese-simplified', 'SC', `${HAN}`],
  ['chinese-traditional', 'TC', `${HAN}`],
  ['japanese', 'JP', `${KANA},${HAN}`, KANA],
  ['korean', 'KR', `${HANGUL},${HAN}`, HANGUL],
].map(([subset, name, ranges, hint]) => {
  const family = name.includes(' ') ? name : `Noto Sans ${name}`;
  return { subset, family, pkg: family.toLowerCase().replace(/ /g, '-'), ranges: parseRanges(ranges), hint: hint ? parseRanges(hint) : null };
});

/** Emoji (and the symbols Noto Sans Symbols 2 lacks, such as ✅): the monochrome Noto Emoji, last. */
SCRIPT_FONTS.push({
  subset: 'emoji', family: 'Noto Emoji', pkg: 'noto-emoji', hint: null,
  ranges: parseRanges('U+2000-2BFF,U+3030,U+303D,U+3297,U+3299,U+FE0F,U+1F000-1FAFF,U+E0020-E007F'),
});

function parseRanges(s) {
  return s.split(',').map((r) => {
    const [a, b] = r.replace('U+', '').split('-');
    return [parseInt(a, 16), parseInt(b || a, 16)];
  });
}
const inRanges = (cp, ranges) => ranges.some(([a, b]) => cp >= a && cp <= b);
const LATIN_RANGES = parseRanges(LATIN);
const SUBSET_RANGES = Object.entries(SUBSETS).map(([subset, r]) => [subset, parseRanges(r)]);
const SYMBOL_RANGES = SYMBOL_FONTS.map((f) => [f, parseRanges(f.ranges)]);
// The symbol fonts as pass-2 candidates, first: an arrow the range put in Latin (↑) still has
// Noto Sans Math. `name` is the family pass 1 registers them under, so one file is one family.
const SYMBOL_CANDIDATES = SYMBOL_RANGES.map(([f, ranges]) => ({ ...f, name: f.family, ranges, hint: null }));

/**
 * Characters the Latin subset's range claims (U+2000-206F) that a face may still not draw — Noto
 * Sans's Latin file has no ‐ ‑ ‒ ― and none of the typographic spaces but U+2002 and U+2009 — and
 * the character drawn in their place: a hyphen as '-', a dash as the nearest dash, a space as the
 * space. prepareFonts gives a face these only where it lacks the character itself, so its .notdef
 * glyph (nothing, or a '/' under pdf.js) never prints; the text layer then reads the stand-in (R2-045).
 */
export const STAND_INS = new Map([
  [0x2010, 0x2d], [0x2011, 0x2d], [0x2012, 0x2013], [0x2015, 0x2014], [0x2212, 0x2d],
  ...[0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x202f, 0x205f].map((cp) => [cp, 0x20]),
]);

/**
 * The arrows ← ↑ → ↓ and the arrowhead of the same direction the bundled Noto Sans draws (its
 * Latin Extended file's modifier letters ˂ ˄ ˃ ˅), for a PDF made offline (RES-R2-045). Online they
 * come from Noto Sans Math, a web font; offline no face drew them and each printed as .notdef, an
 * empty box. prepareFonts gives these only to a face of its own (ARROWS in pdfFontLoader.js), added
 * last and only when no other face draws the arrow, so an arrow Noto Sans Math draws never changes.
 */
export const ARROW_STAND_INS = new Map([[0x2190, 0x2c2], [0x2191, 0x2c4], [0x2192, 0x2c3], [0x2193, 0x2c5]]);

// Characters that draw nothing (joiners, direction marks, separators): never a reason to load a font.
const INVISIBLE = /[\p{Cf}\p{Zl}\p{Zp}]/u;

/**
 * The distinct code points of `text` a loaded face must draw, for pass 2: every visible character
 * past ASCII. The Latin range is not skipped — it is the Google subset's range, not what a file
 * holds: Noto Sans's Latin file has no ↑ ↓ ∕, which the range claims (R2-045).
 */
export function glyphCodePoints(text) {
  const out = [];
  for (const ch of new Set(text)) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x80 && !(inRanges(cp, LATIN_RANGES) && INVISIBLE.test(ch))) out.push(cp);
  }
  return out;
}

/** The distinct code points of `text` outside the Latin face: what fallbacks are for. */
export function extraCodePoints(text) {
  const out = [];
  for (const ch of new Set(text)) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x80 && !inRanges(cp, LATIN_RANGES)) out.push(cp);
  }
  return out;
}

/**
 * Pass 1, by range: the Fontsource subsets `text` touches (SUBSETS keys), the symbol fonts, and the
 * subsets among `primarySubsets` (the chosen font's) that draw its scripts — in that order.
 */
export function needsOf(text, primarySubsets = []) {
  const subsets = new Set();
  const symbols = new Set();
  const own = new Set();
  for (const cp of extraCodePoints(text)) {
    const subset = SUBSET_RANGES.find(([, ranges]) => inRanges(cp, ranges));
    if (subset) { subsets.add(subset[0]); continue; }
    const symbol = SYMBOL_RANGES.find(([, ranges]) => inRanges(cp, ranges));
    if (symbol) symbols.add(symbol[0]);
    const script = SCRIPT_FONTS.find((s) => primarySubsets.includes(s.subset) && inRanges(cp, s.ranges));
    if (script) own.add(script.subset);
  }
  return {
    subsets: Object.keys(SUBSETS).filter((s) => subsets.has(s)),
    symbols: SYMBOL_FONTS.filter((f) => symbols.has(f)),
    own: SCRIPT_FONTS.map((s) => s.subset).filter((s) => own.has(s)),
  };
}

/**
 * Pass 2, by glyph: the Noto script fonts that may draw `missing` (code points no loaded face
 * has), in the order to try them — a CJK font whose hint appears in `text` first, then the table's
 * order. The caller loads one, drops what it draws from `missing`, and skips a candidate none of
 * whose ranges holds a character still missing.
 */
export function scriptCandidates(missing, text) {
  const cps = extraCodePoints(text);
  const hinted = (s) => (s.hint && cps.some((cp) => inRanges(cp, s.hint)) ? 0 : 1);
  return [...SYMBOL_CANDIDATES, ...SCRIPT_FONTS]
    .filter((s) => missing.some((cp) => inRanges(cp, s.ranges)))
    .map((s, i) => [s, i])
    .sort(([a, i], [b, j]) => hinted(a) - hinted(b) || i - j)
    .map(([s]) => s);
}

/** Does `font` (a SCRIPT_FONTS entry) claim `cp` by range? */
export const scriptClaims = (font, cp) => inRanges(cp, font.ranges);

/**
 * Presentation forms: code points for the contextual shapes of Arabic letters and for pointed
 * Hebrew. A font's cmap maps them to the glyphs shaping picks for the plain letters, so a glyph
 * first created from one would carry the presentation form into the PDF's text layer instead of
 * the letter typed. prepareFonts leaves them out when it seeds a font's glyph cache. U+FEFF, the
 * last code point of the block, is the zero-width no-break space, not a letter form: it is seeded.
 */
export const isPresentationForm = (cp) => (cp >= 0xFB1D && cp <= 0xFDFF) || (cp >= 0xFE70 && cp <= 0xFEFC);
