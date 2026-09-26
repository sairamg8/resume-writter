/**
 * Fontsource (fonts from Google Fonts, served by jsDelivr): package metadata and URLs.
 * Shared by the PDF font loader and the design panel's font picker, and free of react-pdf so
 * the picker can use it without loading the PDF engine.
 */

export const FONTSOURCE_CDN = 'https://cdn.jsdelivr.net/npm/@fontsource';

/** Fontsource package id for a font name: "Playfair Display" → "playfair-display". */
export const fontsourceId = (name) => String(name || '').trim().toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const metadata = new Map(); // pkg → Promise<{ meta: metadata | null, transient: boolean }>

/**
 * The lookup behind fetchMetadata: { meta, transient }. `transient` is a failure that says nothing
 * about the font (offline, a timeout, a 429 or 5xx); it is not cached, so the next call asks again.
 */
function lookup(pkg) {
  if (!metadata.has(pkg)) {
    const transient = () => {
      metadata.delete(pkg); // ask again next time
      return { meta: null, transient: true };
    };
    metadata.set(pkg, fetch(`${FONTSOURCE_CDN}/${pkg}@5/metadata.json`, { credentials: 'omit', signal: AbortSignal.timeout(8000) })
      .then((r) => {
        if (r.ok) return r.json().then((m) => ({ meta: m && Array.isArray(m.weights) && Array.isArray(m.styles) ? m : null, transient: false }));
        // Only a 404 means there is no such package. A 429 or 5xx is the CDN having a bad moment:
        // forget it, so the next build asks again instead of printing the fallback all session.
        return r.status === 404 ? { meta: null, transient: false } : transient();
      })
      .catch(transient)); // offline, or it timed out
  }
  return metadata.get(pkg);
}

/** A package's metadata.json ({ family, weights, styles, subsets, … }), or null if there is none. */
export function fetchMetadata(pkg) {
  return lookup(pkg).then((r) => r.meta);
}

/**
 * Is `name` a font the PDF can use? { ok, family (canonical name), pkg }, and when not, `offline`:
 * true when the check itself failed (no connection, or the CDN not answering), so the name may well
 * be right — false when there is no such font.
 */
export async function checkFont(name) {
  const pkg = fontsourceId(name);
  if (!pkg) return { ok: false, family: null, pkg, offline: false };
  const { meta, transient } = await lookup(pkg);
  if (meta) return { ok: true, family: meta.family || String(name).trim(), pkg };
  const offline = transient || (typeof navigator !== 'undefined' && navigator.onLine === false);
  return { ok: false, family: null, pkg, offline };
}

/** URL of one static face: subset latin, weight 400, style normal by default. */
export function faceUrl(pkg, { subset = 'latin', weight = 400, style = 'normal', format = 'woff' } = {}) {
  return `${FONTSOURCE_CDN}/${pkg}@5/files/${pkg}-${subset}-${weight}-${style}.${format}`;
}
