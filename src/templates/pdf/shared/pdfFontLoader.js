import { Font } from '@react-pdf/renderer';

// Maps font IDs (from settings.font) to @fontsource package names and react-pdf family names.
// Non-local entries are fetched from jsDelivr at export time — static woff (not variable/woff2).
const FONT_MAP = {
  notosans:    { pkg: 'noto-sans',      family: 'NotoSans',         local: true },
  inter:       { pkg: 'inter',          family: 'Inter' },
  opensans:    { pkg: 'open-sans',      family: 'Open Sans' },
  firasans:    { pkg: 'fira-sans',      family: 'Fira Sans' },
  ibmplexsans: { pkg: 'ibm-plex-sans',  family: 'IBM Plex Sans' },
  asap:        { pkg: 'asap',           family: 'Asap' },
  roboto:      { pkg: 'roboto',         family: 'Roboto' },
  lato:        { pkg: 'lato',           family: 'Lato' },
  sourcesans:  { pkg: 'source-sans-3',  family: 'Source Sans 3' },
  georgia:     { pkg: null,             family: 'Times-Roman' },
  sourceserif: { pkg: 'source-serif-4', family: 'Source Serif 4' },
  ptserif:     { pkg: 'pt-serif',       family: 'PT Serif' },
  literata:    { pkg: 'literata',       family: 'Literata' },
};

const CDN = 'https://cdn.jsdelivr.net/npm/@fontsource';
const registered = new Set();
const registerPromises = new Map();
let hyphenationDisabled = false;

/**
 * Disable hyphenation globally — faster layout and closer to the canvas
 * (browsers do not hyphenate resume body text by default).
 */
export function ensureNoHyphenation() {
  if (hyphenationDisabled) return;
  try {
    Font.registerHyphenationCallback((word) => [word]);
  } catch {
    // Older react-pdf versions may not expose this; ignore.
  }
  hyphenationDisabled = true;
}

function localFontUrl(file) {
  // Absolute URL so react-pdf can resolve fonts when generating off-document.
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/fonts/${file}`;
  }
  return `/fonts/${file}`;
}

// Register Noto Sans once at module load using local static woff files.
Font.register({
  family: 'NotoSans',
  fonts: [
    { src: localFontUrl('noto-sans-latin-400-normal.woff'), fontWeight: 400 },
    { src: localFontUrl('noto-sans-latin-700-normal.woff'), fontWeight: 700 },
    { src: localFontUrl('noto-sans-latin-400-italic.woff'), fontStyle: 'italic', fontWeight: 400 },
  ],
});
registered.add('NotoSans');
ensureNoHyphenation();

function registerFromCDN(family, pkg) {
  if (registered.has(family)) return;
  const base = `${CDN}/${pkg}@5/files/${pkg}-latin`;
  Font.register({
    family,
    fonts: [
      { src: `${base}-400-normal.woff`, fontWeight: 400 },
      { src: `${base}-700-normal.woff`, fontWeight: 700 },
      { src: `${base}-400-italic.woff`, fontStyle: 'italic', fontWeight: 400 },
    ],
  });
  registered.add(family);
}

/**
 * Prefetch CDN font files into the browser cache so the first export is faster.
 * Safe to call multiple times; no-ops for local/built-in fonts.
 */
export async function prefetchPdfFont(settings) {
  ensureNoHyphenation();
  const customFont = settings?.customFont;
  const fontId = settings?.font || 'notosans';

  let pkg;
  let family;
  if (customFont) {
    family = customFont;
    pkg = customFont.toLowerCase().replace(/\s+/g, '-');
  } else {
    const config = FONT_MAP[fontId] || FONT_MAP.notosans;
    if (!config.pkg || config.local) return config.family;
    family = config.family;
    pkg = config.pkg;
  }

  if (registered.has(family)) return family;
  if (registerPromises.has(family)) return registerPromises.get(family);

  const promise = (async () => {
    const base = `${CDN}/${pkg}@5/files/${pkg}-latin`;
    const urls = [
      `${base}-400-normal.woff`,
      `${base}-700-normal.woff`,
      `${base}-400-italic.woff`,
    ];
    // Warm HTTP cache; registration still uses the CDN URLs.
    await Promise.allSettled(urls.map((u) => fetch(u, { mode: 'cors', credentials: 'omit' })));
    registerFromCDN(family, pkg);
    return family;
  })();

  registerPromises.set(family, promise);
  try {
    return await promise;
  } finally {
    registerPromises.delete(family);
  }
}

/**
 * Resolves the font from resume settings, registers it with react-pdf if needed,
 * and returns the font family name to pass into the PDF Page style.
 */
export function registerPdfFont(settings) {
  ensureNoHyphenation();
  const customFont = settings?.customFont;
  const fontId = settings?.font || 'notosans';

  if (customFont) {
    if (!registered.has(customFont)) {
      const pkg = customFont.toLowerCase().replace(/\s+/g, '-');
      registerFromCDN(customFont, pkg);
    }
    return customFont;
  }

  const config = FONT_MAP[fontId] || FONT_MAP.notosans;
  if (!config.pkg) return config.family;
  if (!config.local) registerFromCDN(config.family, config.pkg);
  return config.family;
}

const primedFonts = new WeakSet();

/**
 * Load every registered face of `families` and seed fontkit's glyph cache from each cmap.
 * Call before every render.
 *
 * fontkit caches one glyph object per glyph id, carrying the characters of the FIRST request.
 * Embedding a composite glyph requests its components with no characters — the middle dot
 * "·" is drawn from the period's outline, "é" from "e" — so a later "." then gets an empty
 * ToUnicode entry: the PDF looks right, but copy-paste and ATS parsers read
 * "me@example.com" as "me@examplecom". Seeding the cache from the cmap first gives every
 * directly mapped glyph its real code point, whatever is embedded later.
 */
export async function prepareFonts(families) {
  const store = Font.getRegisteredFonts();
  const sources = families.flatMap((family) => store[family]?.sources || []);
  // A face that fails to load is left to react-pdf, which reports it when the face is used.
  await Promise.all(sources.map((source) => source.load().catch(() => null)));
  for (const { data: font } of sources) {
    if (!font || primedFonts.has(font) || typeof font.glyphForCodePoint !== 'function') continue;
    for (const codePoint of font.characterSet || []) font.glyphForCodePoint(codePoint);
    primedFonts.add(font);
  }
}
