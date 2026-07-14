import { Font } from '@react-pdf/renderer';

// Maps font IDs (from settings.font) to @fontsource package names and react-pdf family names.
// All non-local entries are fetched from jsDelivr at export time — static woff2 (not variable).
const FONT_MAP = {
  notosans:    { pkg: 'noto-sans',      family: 'NotoSans',         local: true },
  inter:       { pkg: 'inter',          family: 'Inter' },
  opensans:    { pkg: 'open-sans',      family: 'Open Sans' },
  firasans:    { pkg: 'fira-sans',      family: 'Fira Sans' },
  ibmplexsans: { pkg: 'ibm-plex-sans', family: 'IBM Plex Sans' },
  asap:        { pkg: 'asap',           family: 'Asap' },
  roboto:      { pkg: 'roboto',         family: 'Roboto' },
  lato:        { pkg: 'lato',           family: 'Lato' },
  sourcesans:  { pkg: 'source-sans-3',  family: 'Source Sans 3' },
  georgia:     { pkg: null,             family: 'Times-Roman' },   // built-in PDF font, no fetch
  sourceserif: { pkg: 'source-serif-4', family: 'Source Serif 4' },
  ptserif:     { pkg: 'pt-serif',       family: 'PT Serif' },
  literata:    { pkg: 'literata',       family: 'Literata' },
};

const CDN = 'https://cdn.jsdelivr.net/npm/@fontsource';
const registered = new Set();

// Register Noto Sans once at module load using local static woff files (avoids CDN dependency).
// Using woff (zlib) not woff2 (Brotli) — @react-pdf/fontkit's Brotli decompressor is unreliable.
Font.register({
  family: 'NotoSans',
  fonts: [
    { src: '/fonts/noto-sans-latin-400-normal.woff', fontWeight: 400 },
    { src: '/fonts/noto-sans-latin-700-normal.woff', fontWeight: 700 },
    { src: '/fonts/noto-sans-latin-400-italic.woff', fontStyle: 'italic', fontWeight: 400 },
  ],
});
registered.add('NotoSans');

function registerFromCDN(family, pkg) {
  if (registered.has(family)) return;
  // Use .woff (zlib) instead of .woff2 (Brotli) — fontkit decompresses woff reliably.
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
 * Resolves the font from resume settings, registers it with react-pdf if needed,
 * and returns the font family name to pass into the PDF Page style.
 *
 * If the font cannot be fetched (e.g. unknown custom font not on fontsource),
 * react-pdf silently falls back to Helvetica — still ATS-readable.
 */
export function registerPdfFont(settings) {
  const customFont = settings?.customFont;
  const fontId = settings?.font || 'notosans';

  // User-typed custom font (e.g. "Playfair Display")
  if (customFont) {
    if (!registered.has(customFont)) {
      const pkg = customFont.toLowerCase().replace(/\s+/g, '-');
      const base = `${CDN}/${pkg}@5/files/${pkg}-latin`;
      Font.register({
        family: customFont,
        fonts: [
          { src: `${base}-400-normal.woff`, fontWeight: 400 },
          { src: `${base}-700-normal.woff`, fontWeight: 700 },
          { src: `${base}-400-italic.woff`, fontStyle: 'italic', fontWeight: 400 },
        ],
      });
      registered.add(customFont);
    }
    return customFont;
  }

  const config = FONT_MAP[fontId] || FONT_MAP.notosans;

  // Georgia / system font → use built-in Times-Roman, no registration needed
  if (!config.pkg) return config.family;

  // NotoSans already registered above
  if (!config.local) {
    registerFromCDN(config.family, config.pkg);
  }

  return config.family;
}
