// A photo saved before uploads were converted (c7b1aa6) — a WebP, GIF or AVIF — shows in the
// editor, where the browser decodes it, but react-pdf cannot draw it: the preview and the PDF
// printed no photo, and nothing said why (R7-7). A photo stored as a URL or a path (an imported
// JSON Resume's basics.image) is fetched for its copy the same way (R2-093). The PDF prints a copy of it instead, converted as
// an upload of it is (readImageFile) and made once a session. The saved résumé keeps what it
// holds, so old data loads unchanged — unless it is larger than any upload stores, when the store
// keeps the same copy in its place (smallerPhotos.js). A photo this browser cannot decode either
// still prints none, and the editor says so (usePrintableImage).
import { KINDS, drawableImage, readImageFile } from './imageUpload.js';
import { photoOption } from '../constants/photoOptions.js';

/** Copies made (null: none could be), by saved data URL, oldest first. */
const made = new Map();
/** Copies being made, by saved data URL. */
const making = new Map();
/**
 * Keys in `made` as null only because the fetch of a URL failed for a passing reason (no network, a
 * timeout, a server error), each with the time it may be fetched again: the PDF prints none for now,
 * and a build from then on fetches it again. Failed while the browser is offline, the next build tries
 * it; any other passing failure (a timeout, a 5xx, a host that allows no cross-site read, which fetch
 * cannot tell from no network) waits a minute, or until the browser is back online, so a slow or
 * refusing host does not hold or re-download on every preview build.
 */
const retry = new Map();
const RETRY_AFTER_MS = 60_000;
const offlineNow = () => typeof navigator !== 'undefined' && navigator.onLine === false;
const due = (key) => retry.has(key) && Date.now() >= retry.get(key);
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('online', () => { for (const key of retry.keys()) retry.set(key, 0); });
}
/**
 * Whether an image printed as none only for a passing reason and will be fetched again (see `retry`):
 * the preview builds again when the browser is back online, so the photo comes back then rather than
 * on the next edit (R4-LO-18).
 */
export const imageRetryPending = () => retry.size > 0;
/** Copies kept: the résumé's photo and the letter's, and custom contact icons (and the store's, smallerPhotos.js). */
const KEEP = 64;
const listeners = new Set();

/** The bytes data URL `src` holds, as a Blob of its image type; null when it names none, or holds none. */
function blobOf(src) {
  const comma = src.indexOf(',');
  const [type, ...params] = src.slice('data:'.length, comma).toLowerCase().split(';');
  if (comma < 0 || !type.startsWith('image/')) return null;
  const payload = src.slice(comma + 1);
  let blob;
  try {
    if (params.includes('base64')) {
      const bin = atob(payload.replace(/[^\w+/=-]/g, '').replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      blob = new Blob([bytes], { type });
    } else {
      blob = new Blob([decodeURIComponent(payload)], { type }); // an SVG saved as text
    }
  } catch {
    return null;
  }
  return blob.size ? blob : null;
}

/** How long a photo stored as a URL may take to fetch before it prints as none. */
const FETCH_MS = 15_000;

/** What fetchedBlob returns for a fetch that failed for a passing reason: try again later. */
const TRY_AGAIN = Symbol('try again');

/**
 * The image at URL or path `src` (a JSON Resume file's basics.image), as a Blob; null when the server
 * says it is not there (a 4xx: a missing file, no access); TRY_AGAIN when the fetch failed for a reason
 * that may pass — no network, a timeout, a server error, a rate limit — or a server that allows no
 * cross-site read, which fetch cannot tell from no network (R2-093, R4-PDF-03).
 */
async function fetchedBlob(src) {
  try {
    const signal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(FETCH_MS) : undefined;
    const res = await fetch(src, { signal });
    if (res.ok) return await res.blob();
    return res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429 ? null : TRY_AGAIN;
  } catch {
    return TRY_AGAIN;
  }
}

/**
 * A copy of `src` (a data URL, or a URL fetched) the PDF can draw, made as an upload of it would be;
 * null when there is none; TRY_AGAIN when a URL could not be fetched just now (fetchedBlob).
 */
async function copyOf(src, { kind = 'photo' } = {}) {
  const blob = src.startsWith('data:') ? blobOf(src) : await fetchedBlob(src);
  if (blob === TRY_AGAIN) return TRY_AGAIN;
  if (!blob) return null;
  try {
    return drawableImage(await readImageFile(blob, { kind }));
  } catch {
    return null; // the browser cannot decode it (nor can Node, where the PDF tests render)
  }
}

/**
 * What the PDF prints for the saved image `src`, when that is known now: `src` itself when react-pdf
 * draws it (a PNG, JPEG or SVG data URL — see drawableImage), the copy made of it, or null when it
 * prints nothing (no image, or no copy could be made). Undefined while the copy of a data URL
 * react-pdf cannot draw, or of a plain URL or path (fetched), has not been made yet (printableImage
 * makes it).
 */
export function printableNow(src, { kind = 'photo' } = {}) {
  if (drawableImage(src)) return src;
  if (typeof src !== 'string' || !src) return null;
  const key = `${kind}:${src}`;
  return made.has(key) ? made.get(key) : undefined;
}

/** What the PDF prints for the saved image `src` (see printableNow), making its copy the first time. */
export function printableImage(src, { kind = 'photo' } = {}) {
  const now = printableNow(src, { kind });
  return now !== undefined && !due(`${kind}:${src}`) ? Promise.resolve(now) : imageCopy(src, { kind });
}

/**
 * The copy of the saved data URL `src` made as an upload of it is (null when none can be), made
 * once a session and shared by all who ask: the PDF's copy of a WebP (printableImage) and the
 * store's smaller photo in place of one saved at camera size (smallerPhotos.js). A URL whose fetch
 * failed for a passing reason is null for now and fetched again the next time it is asked for: it
 * printed no photo for the rest of the session, even back online (R4-PDF-03).
 */
export function imageCopy(src, { kind = 'photo' } = {}) {
  const key = `${kind}:${src}`;
  if (made.has(key) && !due(key)) return Promise.resolve(made.get(key));
  if (!making.has(key)) {
    making.set(key, copyOf(src, { kind }).then((result) => {
      const passing = result === TRY_AGAIN;
      const copy = passing ? null : result;
      if (passing) retry.set(key, offlineNow() ? 0 : Date.now() + RETRY_AFTER_MS);
      else retry.delete(key);
      made.delete(key); // set again below, as the newest
      made.set(key, copy);
      if (made.size > KEEP) {
        const oldest = made.keys().next().value;
        made.delete(oldest);
        retry.delete(oldest);
      }
      making.delete(key);
      listeners.forEach((fn) => fn());
      return copy;
    }));
  }
  return making.get(key);
}

/** Calls `fn` each time a copy has been made (or found impossible). Returns the unsubscribe function. */
export function onPrintableChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Photo → Tone Grayscale (R2-147): react-pdf draws an image as it is and has no filter, so the PDF
// prints a greyscale copy of the photo, drawn through a canvas — the browser's, or the one a test
// hands in (_setPhotoCanvasForTest). With none (Node, without a test's) the photo prints in colour:
// a missing copy never breaks the render.

/** The canvas the greyscale copies are drawn with: { createCanvas(w, h), loadImage(src) }, or null for the browser's. */
let photoCanvas = null;

/** Tests only: draw greyscale copies with `canvas` ({ createCanvas, loadImage }, e.g. @napi-rs/canvas); null restores the browser's. */
export function _setPhotoCanvasForTest(canvas) {
  photoCanvas = canvas;
  greyMade.clear();
}

/** The browser's canvas, as the test seam's shape; null where there is no DOM (Node). */
function browserCanvas() {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  return {
    createCanvas: (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h }),
    loadImage: (src) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    }),
  };
}

/** Greyscale copies made (null: none could be), by the data URL they were made of, oldest first. */
const greyMade = new Map();

/**
 * A greyscale copy of the data URL `src`: each pixel's luminance (0.299 R + 0.587 G + 0.114 B) in all
 * three channels, its alpha kept — a PNG when the photo is see-through anywhere, else a JPEG as an
 * upload stores one. An SVG is drawn at the size of its PNG copy (svgCopySize), not at its own: a
 * 100 × 100 SVG made a 100 × 100 raster, which printed soft in the PDF and in Word where the SVG in
 * colour prints sharp (RES-R2-126b). Null when there is no canvas, or it cannot read `src`.
 */
async function greyCopyOf(src) {
  const canvas = photoCanvas || browserCanvas();
  if (!canvas) return null;
  try {
    const svg = svgOf(src);
    const img = await canvas.loadImage(svg || src);
    const size = svg ? svgCopySize(img, svg) : { w: img.naturalWidth || img.width, h: img.naturalHeight || img.height };
    const { w, h } = size || {};
    if (!w || !h) return null;
    const c = canvas.createCanvas(w, h);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const pixels = ctx.getImageData(0, 0, w, h);
    const d = pixels.data;
    let seeThrough = false;
    for (let i = 0; i < d.length; i += 4) {
      const y = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
      d[i] = y;
      d[i + 1] = y;
      d[i + 2] = y;
      if (d[i + 3] < 255) seeThrough = true;
    }
    ctx.putImageData(pixels, 0, 0);
    const out = seeThrough ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.9);
    return drawableImage(out) ? out : null;
  } catch {
    return null;
  }
}

/** The greyscale copy of `src` (see greyCopyOf), made once a session; null when none can be. */
function greyCopy(src) {
  if (!greyMade.has(src)) {
    greyMade.set(src, greyCopyOf(src));
    if (greyMade.size > KEEP) greyMade.delete(greyMade.keys().next().value);
  }
  return greyMade.get(src);
}

/** `src` (what the PDF prints for a photo) as Photo → Tone sets it: its greyscale copy for Grayscale, when one can be made. */
async function toned(src, settings) {
  if (photoOption('photoTone', settings?.photoTone) !== 'grayscale' || typeof src !== 'string' || !src.startsWith('data:')) return src;
  return (await greyCopy(src)) || src;
}

// An SVG photo in Word (RES-R2-126): react-pdf draws an SVG as vectors, but a Word picture must be a
// PNG or a JPEG, and the .docx printed no photo where the PDF printed it. Word prints a PNG copy of it,
// drawn through the same canvas as the greyscale copies; with none (Node, without a test's) it still
// prints none, as before.

/** The longest side, px, of the PNG copy of an SVG photo: an upload's photo side (KINDS.photo), well over what Word prints. */
const SVG_COPY_SIDE = KINDS.photo.maxSide;

/**
 * The width / height the root <svg> of the base64 data URL `src` declares — by its viewBox, else by a
 * width and height in plain numbers or px — or null when it declares neither. A browser may load an
 * SVG with neither size attribute as 0 × 0 (Firefox does), and then only the viewBox tells its shape.
 */
function svgAspect(src) {
  let text;
  try {
    const b64 = src.slice(src.indexOf(',') + 1).replace(/[^\w+/-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
    text = atob(b64.slice(0, b64.length - (b64.length % 4)));
  } catch {
    return null;
  }
  const root = /<svg[\s/>][^>]*>?/i.exec(text)?.[0] || '';
  const n = '([+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[+-]?\\d+)?)';
  const box = new RegExp(`(?:^|\\s)viewBox\\s*=\\s*["']\\s*[^\\s,"']+[\\s,]+[^\\s,"']+[\\s,]+${n}[\\s,]+${n}`, 'i').exec(root);
  const attr = (name) => parseFloat(new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']\\s*${n}\\s*(?:px)?\\s*["']`, 'i').exec(root)?.[1]);
  const [w, h] = box ? [parseFloat(box[1]), parseFloat(box[2])] : [attr('width'), attr('height')];
  return w > 0 && h > 0 ? w / h : null;
}

/** What react-pdf draws of `src`: an SVG's bytes under whatever label they were saved with, labelled as an SVG; null when `src` holds no SVG. */
function svgOf(src) {
  const svg = drawableImage(src);
  return svg && /^data:image\/svg(?:\+xml)?;/i.test(svg) ? svg : null;
}

/**
 * The size, { w, h } px, a raster copy of the SVG `svg` is drawn at — loaded by the canvas as `img`:
 * its longer side SVG_COPY_SIDE and its shape the SVG's (its natural size, else its viewBox). Null when
 * neither tells its shape. The PNG copy Word prints (svgPhotoCopy) and the greyscale copy of Photo →
 * Tone Grayscale (greyCopyOf) are both drawn at it, so neither prints softer than the SVG in colour.
 */
function svgCopySize(img, svg) {
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  const aspect = nw > 0 && nh > 0 ? nw / nh : svgAspect(svg);
  if (!aspect) return null;
  return {
    w: Math.max(1, Math.round(aspect >= 1 ? SVG_COPY_SIDE : SVG_COPY_SIDE * aspect)),
    h: Math.max(1, Math.round(aspect >= 1 ? SVG_COPY_SIDE / aspect : SVG_COPY_SIDE)),
  };
}

/**
 * A PNG copy of the SVG photo `src` (a base64 data URL), its longer side SVG_COPY_SIDE px and its shape
 * the SVG's, for the Word export (wordExportPhoto.js); a PNG keeps what the SVG leaves see-through.
 * Null when `src` is no SVG, there is no canvas, or the canvas cannot draw it.
 */
export async function svgPhotoCopy(src) {
  const svg = svgOf(src);
  if (!svg) return null;
  const canvas = photoCanvas || browserCanvas();
  if (!canvas) return null;
  try {
    const img = await canvas.loadImage(svg);
    const size = svgCopySize(img, svg);
    if (!size) return null;
    const { w, h } = size;
    const c = canvas.createCanvas(w, h);
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    const out = c.toDataURL('image/png');
    return drawableImage(out)?.startsWith('data:image/png;') ? out : null;
  } catch {
    return null;
  }
}

/**
 * `resume` as its PDF prints it: the photo, the letter's own photo, and any custom contact icons
 * each replaced by the copy made of it (printableImage) when react-pdf cannot draw it. A photo or
 * icon no copy could be made of stays as it is — PdfPhoto prints nothing for it, and PdfContactIcon
 * falls back to the pack icon. Photo → Tone Grayscale prints both photos as greyscale copies: the
 * letter's photo takes the résumé's Shape, Size and Border too (getPdfPhotoStyle), so its Tone
 * (R2-147). The résumé itself is never changed; it comes back as it is when there is nothing to
 * replace.
 */
export async function withPrintablePhotos(resume) {
  const photo = resume?.personal?.photo;
  const own = resume?.coverLetter?.clPhoto;
  const customIcons = resume?.settings?.customContactIcons;

  const [photoCopy, ownCopy] = await Promise.all([
    toned((photo && await printableImage(photo, { kind: 'photo' })) || photo, resume?.settings),
    toned((own && await printableImage(own, { kind: 'photo' })) || own, resume?.settings),
  ]);

  let iconsCopy = customIcons;
  if (customIcons && typeof customIcons === 'object') {
    const entries = Object.entries(customIcons);
    if (entries.length > 0) {
      const converted = await Promise.all(
        entries.map(async ([field, src]) => {
          if (!src) return [field, src];
          const copy = await printableImage(src, { kind: 'icon' });
          return [field, copy || src];
        })
      );
      let changed = false;
      const next = {};
      for (const [field, src] of converted) {
        next[field] = src;
        if (src !== customIcons[field]) changed = true;
      }
      if (changed) iconsCopy = next;
    }
  }

  if (photoCopy === photo && ownCopy === own && iconsCopy === customIcons) return resume;
  return {
    ...resume,
    ...(photoCopy !== photo && { personal: { ...resume.personal, photo: photoCopy } }),
    ...(ownCopy !== own && { coverLetter: { ...resume.coverLetter, clPhoto: ownCopy } }),
    ...(iconsCopy !== customIcons && { settings: { ...resume.settings, customContactIcons: iconsCopy } }),
  };
}
