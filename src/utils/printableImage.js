// A photo saved before uploads were converted (c7b1aa6) — a WebP, GIF or AVIF — shows in the
// editor, where the browser decodes it, but react-pdf cannot draw it: the preview and the PDF
// printed no photo, and nothing said why (R7-7). A photo stored as a URL or a path (an imported
// JSON Resume's basics.image) is fetched for its copy the same way (R2-093). The PDF prints a copy of it instead, converted as
// an upload of it is (readImageFile) and made once a session. The saved résumé keeps what it
// holds, so old data loads unchanged — unless it is larger than any upload stores, when the store
// keeps the same copy in its place (smallerPhotos.js). A photo this browser cannot decode either
// still prints none, and the editor says so (usePrintableImage).
import { drawableImage, readImageFile } from './imageUpload.js';
import { photoOption } from '../constants/photoOptions.js';

/** Copies made (null: none could be), by saved data URL, oldest first. */
const made = new Map();
/** Copies being made, by saved data URL. */
const making = new Map();
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

/**
 * The image at URL or path `src` (a JSON Resume file's basics.image), as a Blob; null when it cannot
 * be fetched — a missing file, a server that allows no cross-site read, no network (R2-093).
 */
async function fetchedBlob(src) {
  try {
    const signal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(FETCH_MS) : undefined;
    const res = await fetch(src, { signal });
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  }
}

/** A copy of `src` (a data URL, or a URL fetched) the PDF can draw, made as an upload of it would be; null when there is none. */
async function copyOf(src, { kind = 'photo' } = {}) {
  const blob = src.startsWith('data:') ? blobOf(src) : await fetchedBlob(src);
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
  return now !== undefined ? Promise.resolve(now) : imageCopy(src, { kind });
}

/**
 * The copy of the saved data URL `src` made as an upload of it is (null when none can be), made
 * once a session and shared by all who ask: the PDF's copy of a WebP (printableImage) and the
 * store's smaller photo in place of one saved at camera size (smallerPhotos.js).
 */
export function imageCopy(src, { kind = 'photo' } = {}) {
  const key = `${kind}:${src}`;
  if (made.has(key)) return Promise.resolve(made.get(key));
  if (!making.has(key)) {
    making.set(key, copyOf(src, { kind }).then((copy) => {
      made.set(key, copy);
      if (made.size > KEEP) made.delete(made.keys().next().value);
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
 * upload stores one. Null when there is no canvas, or it cannot read `src`.
 */
async function greyCopyOf(src) {
  const canvas = photoCanvas || browserCanvas();
  if (!canvas) return null;
  try {
    const img = await canvas.loadImage(src);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
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
