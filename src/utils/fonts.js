import { faceUrl, fontsourceId } from '@/utils/fontsource';

export { checkFont } from '@/utils/fontsource';

/**
 * The font picker. `name` is the family the preview registers; `pkg` is its Fontsource package —
 * the same files the PDF embeds (see templates/pdf/shared/pdfFontLoader.js).
 */
export const FONTS = [
  { id: 'notosans',    label: 'Noto Sans',      name: 'Noto Sans',      pkg: 'noto-sans',      category: 'sans-serif' },
  { id: 'inter',       label: 'Inter',          name: 'Inter',          pkg: 'inter',          category: 'sans-serif' },
  { id: 'opensans',    label: 'Open Sans',      name: 'Open Sans',      pkg: 'open-sans',      category: 'sans-serif' },
  { id: 'firasans',    label: 'Fira Sans',      name: 'Fira Sans',      pkg: 'fira-sans',      category: 'sans-serif' },
  { id: 'ibmplexsans', label: 'IBM Plex Sans',  name: 'IBM Plex Sans',  pkg: 'ibm-plex-sans',  category: 'sans-serif' },
  { id: 'asap',        label: 'Asap',           name: 'Asap',           pkg: 'asap',           category: 'sans-serif' },
  { id: 'roboto',      label: 'Roboto',         name: 'Roboto',         pkg: 'roboto',         category: 'sans-serif' },
  { id: 'lato',        label: 'Lato',           name: 'Lato',           pkg: 'lato',           category: 'sans-serif' },
  { id: 'sourcesans',  label: 'Source Sans 3',  name: 'Source Sans 3',  pkg: 'source-sans-3',  category: 'sans-serif' },
  // Georgia is not a web font; the PDF embeds Gelasio, its open, metric-compatible twin.
  { id: 'georgia',     label: 'Georgia',        name: 'Gelasio',        pkg: 'gelasio',        category: 'serif', title: 'Printed with Gelasio, an open font with Georgia’s proportions' },
  { id: 'sourceserif', label: 'Source Serif 4', name: 'Source Serif 4', pkg: 'source-serif-4', category: 'serif' },
  { id: 'ptserif',     label: 'PT Serif',       name: 'PT Serif',       pkg: 'pt-serif',       category: 'serif' },
  { id: 'literata',    label: 'Literata',       name: 'Literata',       pkg: 'literata',       category: 'serif' },
].map((f) => ({ ...f, family: `'${f.name}', ${f.category}` }));

const previewing = new Set();

/** Show `name` in its own face in the app, loaded from the files the PDF uses (no Google Fonts CSS). */
export function loadPreviewFont(name, pkg = fontsourceId(name)) {
  if (!name || !pkg || previewing.has(pkg) || typeof FontFace === 'undefined') return;
  previewing.add(pkg);
  new FontFace(name, `url(${faceUrl(pkg, { format: 'woff2' })}) format('woff2')`)
    .load()
    .then((face) => document.fonts.add(face))
    .catch(() => previewing.delete(pkg));
}

// Custom fonts are remembered per browser, apart from résumé data.
const CUSTOM_FONTS_KEY = 'cpwtcv_custom_fonts';

export function loadCustomFonts() {
  try {
    const list = JSON.parse(localStorage.getItem(CUSTOM_FONTS_KEY) || '[]');
    return Array.isArray(list) ? list.filter((n) => typeof n === 'string' && n.trim()) : [];
  } catch {
    return [];
  }
}

function storeCustomFonts(list) {
  try { localStorage.setItem(CUSTOM_FONTS_KEY, JSON.stringify(list)); } catch { /* storage full: the list just isn't remembered */ }
}

export function saveCustomFont(name) {
  if (!name) return;
  const list = loadCustomFonts();
  if (!list.includes(name)) storeCustomFonts([...list, name]);
}

export function removeCustomFont(name) {
  storeCustomFonts(loadCustomFonts().filter((f) => f !== name));
}
