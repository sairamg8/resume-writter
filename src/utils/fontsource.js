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
 * Lookups that got no answer in time (LOOKUP_MS), each with when one may be asked again. A CDN that takes
 * the connection and says nothing cost every lookup the whole 8 s, and the PDF asks one per font — body,
 * Name Font, Heading Font: a build that waited for three in turn was past the PDF worker's budget
 * (pdfBuild.js) and failed, and Retry, on a fresh worker, the same way (R2-142). So such a failure is
 * remembered for a minute, or until the browser is back online, and a lookup meanwhile has it at once.
 * Every other failure is quick (offline fails at once, a 429 or 5xx answers) and is asked again next time.
 */
const silent = new Map();
const LOOKUP_MS = 8_000;
const SILENT_RETRY_MS = 60_000;

// globalThis: the PDF worker (pdfWorker.js) looks fonts up too, and a worker has no window.
if (typeof globalThis.addEventListener === 'function') {
  globalThis.addEventListener('online', () => {
    for (const pkg of silent.keys()) metadata.delete(pkg);
    silent.clear();
  });
}

/**
 * The lookup behind fetchMetadata: { meta, transient }. `transient` is a failure that says nothing
 * about the font (offline, a timeout, a 429 or 5xx); it is not cached, so the next call asks again —
 * but one that timed out only after a minute (`silent`), unless `fresh` asks again now (checkFont).
 */
function lookup(pkg, { fresh = false } = {}) {
  if (silent.has(pkg) && (fresh || Date.now() >= silent.get(pkg))) {
    silent.delete(pkg);
    metadata.delete(pkg);
  }
  if (!metadata.has(pkg)) {
    let entry = null;
    const transient = (error) => {
      if (error?.name === 'TimeoutError') silent.set(pkg, Date.now() + SILENT_RETRY_MS);
      else if (metadata.get(pkg) === entry) metadata.delete(pkg); // ask again next time
      return { meta: null, transient: true };
    };
    entry = fetch(`${FONTSOURCE_CDN}/${pkg}@5/metadata.json`, { credentials: 'omit', signal: AbortSignal.timeout(LOOKUP_MS) })
      .then((r) => {
        if (r.ok) return r.json().then((m) => ({ meta: m && Array.isArray(m.weights) && Array.isArray(m.styles) ? m : null, transient: false }));
        // Only a 404 means there is no such package. A 429 or 5xx is the CDN having a bad moment:
        // forget it, so the next build asks again instead of printing the fallback all session.
        return r.status === 404 ? { meta: null, transient: false } : transient();
      })
      .catch(transient); // offline, or it timed out
    metadata.set(pkg, entry);
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
  const { meta, transient } = await lookup(pkg, { fresh: true }); // asked for now: a minute-old silence is no answer
  if (meta) return { ok: true, family: meta.family || String(name).trim(), pkg };
  // Only a lookup that failed just now: a 404 remembered from earlier is an answer, offline or not.
  return { ok: false, family: null, pkg, offline: transient };
}

/** URL of one static face: subset latin, weight 400, style normal by default. */
export function faceUrl(pkg, { subset = 'latin', weight = 400, style = 'normal', format = 'woff' } = {}) {
  return `${FONTSOURCE_CDN}/${pkg}@5/files/${pkg}-${subset}-${weight}-${style}.${format}`;
}
