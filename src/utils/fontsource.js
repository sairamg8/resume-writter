/**
 * Fontsource (fonts from Google Fonts, served by jsDelivr): package metadata and URLs.
 * Shared by the PDF font loader and the design panel's font picker, and free of react-pdf so
 * the picker can use it without loading the PDF engine.
 */

export const FONTSOURCE_CDN = 'https://cdn.jsdelivr.net/npm/@fontsource';

/** Fontsource package id for a font name: "Playfair Display" → "playfair-display". */
export const fontsourceId = (name) => String(name || '').trim().toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const metadata = new Map(); // pkg → Promise<metadata | null>

/** A package's metadata.json ({ family, weights, styles, subsets, … }), or null if there is none. */
export function fetchMetadata(pkg) {
  if (!metadata.has(pkg)) {
    metadata.set(pkg, fetch(`${FONTSOURCE_CDN}/${pkg}@5/metadata.json`, { credentials: 'omit', signal: AbortSignal.timeout(8000) })
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => (m && Array.isArray(m.weights) && Array.isArray(m.styles) ? m : null))
      .catch(() => {
        metadata.delete(pkg); // offline: ask again next time
        return null;
      }));
  }
  return metadata.get(pkg);
}

/** Is `name` a font the PDF can use? { ok, family (canonical name), pkg }. */
export async function checkFont(name) {
  const pkg = fontsourceId(name);
  const meta = pkg ? await fetchMetadata(pkg) : null;
  return meta ? { ok: true, family: meta.family || String(name).trim(), pkg } : { ok: false, family: null, pkg };
}

/** URL of one static face: subset latin, weight 400, style normal by default. */
export function faceUrl(pkg, { subset = 'latin', weight = 400, style = 'normal', format = 'woff' } = {}) {
  return `${FONTSOURCE_CDN}/${pkg}@5/files/${pkg}-${subset}-${weight}-${style}.${format}`;
}
