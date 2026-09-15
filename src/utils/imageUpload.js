// Images people upload — the profile photo, the cover-letter photo, a contact field's own icon —
// as data URLs the PDF can draw. react-pdf decodes only PNG, JPEG and SVG (base64 data URLs):
// a WebP, GIF or AVIF upload showed in the editor but vanished from the preview and the export
// (review R1-1). So an upload in any other format the browser can decode is converted once, here.
//
// react-pdf picks its decoder by the data URL's label, and the browser labels a file by its name,
// so the bytes decide what a file is, never the label: a WebP saved as "me.jpg" is converted too
// (R7-3). And every upload is scaled to what the PDF prints, whatever its format (R7-4): a phone
// photo kept whole outgrew the browser's storage and the 1 MiB of a cloud document.

/** A data URL as react-pdf reads one: `data:image/<label>;base64,<bytes>`. */
const IMAGE_DATA_URL = /^data:image\/([\w.+-]+);base64,/i;
/** The labels react-pdf decodes each type by, and the one an upload is stored with. */
const LABELS = { png: ['png'], jpeg: ['jpeg', 'jpg'], svg: ['svg+xml', 'svg'] };
const MIME = { png: 'image/png', jpeg: 'image/jpeg', svg: 'image/svg+xml' };
/** Enough of a file to tell its type: an SVG may open with an XML declaration, a comment, a DOCTYPE. */
const HEAD_BYTES = 4096;
/**
 * An SVG document's start, past the prolog react-pdf's parser drops (declaration, DOCTYPE,
 * comments). Each part matches one way only — a comment never runs past its first "-->" — so a
 * prolog with no SVG after it fails at once instead of backtracking through every split of it.
 */
const SVG_START = /^(?:\s|<\?[^>]*>|<!DOCTYPE[^[>]*(?:\[[^\]]*\][^>]*)?>|<!--(?:[^-]|-(?!->))*-->)*<svg[\s/>]/i;

/** The type of image `head` holds — a file's first bytes, one character per byte: 'png', 'jpeg', 'svg' or null. */
function sniff(head) {
  if (head.startsWith('\x89PNG\r\n\x1a\n')) return 'png';
  if (head.startsWith('\xff\xd8\xff')) return 'jpeg';
  if (SVG_START.test(head.replace(/^\xef\xbb\xbf/, ''))) return 'svg';
  return null;
}

/** The first bytes of base64 `payload`, one character per byte ('' when it is not base64). */
function decodeHead(payload) {
  const b64 = payload.slice(0, (HEAD_BYTES / 3) * 4 + 64).replace(/[^\w+/-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
  try {
    return atob(b64.slice(0, b64.length - (b64.length % 4)));
  } catch {
    return '';
  }
}

/** `dataUrl` relabelled as `type` ('png', 'jpeg' or 'svg'). */
const labelled = (dataUrl, type) => `data:${MIME[type]};base64,${dataUrl.slice(dataUrl.indexOf(',') + 1)}`;

/**
 * `src` as the PDF can draw it, or null. react-pdf decodes a data URL by its label, so a PNG, JPEG
 * or SVG whose label names another type — saved from a file whose name said so, before uploads were
 * sniffed — comes back labelled by its bytes, and any other bytes (a WebP or GIF, whatever its
 * label says) give null. A plain URL comes back as it is: react-pdf fetches it and reads its bytes.
 */
export function drawableImage(src) {
  if (typeof src !== 'string' || !src) return null;
  if (!src.startsWith('data:')) return src;
  const label = IMAGE_DATA_URL.exec(src)?.[1].toLowerCase();
  const type = label && sniff(decodeHead(src.slice(src.indexOf(',') + 1)));
  if (!type) return null;
  return LABELS[type].includes(label) ? src : labelled(src, type);
}

/**
 * True when the PDF can draw `src` (see drawableImage): a PNG, JPEG or SVG data URL, or a plain
 * URL. False for other data URLs — a WebP or GIF saved before uploads were converted — and for
 * anything that is not a non-empty string.
 */
export function isDrawableImage(src) {
  return drawableImage(src) !== null;
}

export const UNREADABLE_IMAGE = 'That image could not be read. Please upload a PNG, JPEG, WebP or GIF file.';
const tooLarge = (maxBytes) => `That image is too large. Please upload one under ${maxBytes / 1000} KB.`;

/**
 * What each kind of upload is stored as: its format when it is converted, its longest side in px
 * and the most bytes it keeps. The PDF prints a photo under 100 pt (1024 px is over 700 dpi) and an
 * icon under 20 pt; two photos (the résumé's and the letter's) still leave most of a 1 MiB cloud
 * document for the text. 400 KB is the icon limit the editor has always stated.
 */
const KINDS = {
  photo: { as: 'jpeg', maxSide: 1024, maxBytes: 300_000 },
  icon: { as: 'png', maxSide: 256, maxBytes: 400_000 },
};
/** Below this side a raster fits any limit above, so the shrinking stops (a guard). */
const MIN_SIDE = 64;

function readAsDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function readHead(file) {
  return String.fromCharCode(...new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer()));
}

/** Bytes held by a base64 data URL. */
function dataUrlBytes(dataUrl) {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
}

/** True when a pixel of the canvas behind `ctx` is not fully opaque. */
function seeThrough(ctx, { width, height }) {
  const { data } = ctx.getImageData(0, 0, width, height);
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
}

/**
 * `bitmap` drawn into a canvas and encoded: an icon as PNG; a photo as JPEG, or as PNG when it has
 * see-through pixels (a cut-out keeps showing the banner or the side column behind it). Its longer
 * side is at most `maxSide` px, and a quarter shorter each time until it holds at most `maxBytes`.
 */
function encode(bitmap, { as, maxSide, maxBytes }) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const longest = Math.max(bitmap.width, bitmap.height);
  let mime = as === 'png' ? MIME.png : null;
  for (let side = Math.min(maxSide, longest); ; side = Math.floor(side * 0.75)) {
    canvas.width = Math.max(1, Math.round((bitmap.width * side) / longest)); // clears it, resets ctx
    canvas.height = Math.max(1, Math.round((bitmap.height * side) / longest));
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    mime ??= seeThrough(ctx, canvas) ? MIME.png : MIME.jpeg;
    if (mime === MIME.jpeg) {
      // JPEG has no transparency: an edge the scaling left see-through goes white, not black.
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const dataUrl = canvas.toDataURL(mime, 0.9);
    if (dataUrlBytes(dataUrl) <= maxBytes) return dataUrl;
    if (side <= MIN_SIDE) throw new Error(tooLarge(maxBytes));
  }
}

/**
 * The uploaded image `file` as a data URL the PDF can draw, for `kind` 'photo' or 'icon' (see
 * KINDS). What the file is comes from its bytes, not its name. A PNG or JPEG within the kind's
 * side and bytes is kept as it is, and so is an SVG within its bytes (drawn as vectors, it has no
 * side to scale); anything else the browser decodes (a bigger PNG or JPEG, WebP, GIF, AVIF, BMP …)
 * is scaled and converted. Rejects with UNREADABLE_IMAGE when it is not an image the browser can
 * decode, and with a "too large" message for an SVG over the kind's bytes.
 */
export async function readImageFile(file, { kind = 'photo' } = {}) {
  if (!file || !file.type?.startsWith('image/')) throw new Error(UNREADABLE_IMAGE);
  const limits = KINDS[kind] || KINDS.photo;
  const type = sniff(await readHead(file));
  if (type === 'svg') {
    if (file.size > limits.maxBytes) throw new Error(tooLarge(limits.maxBytes));
    return labelled(await readAsDataURL(file), type);
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(UNREADABLE_IMAGE);
  }
  try {
    const fits = Math.max(bitmap.width, bitmap.height) <= limits.maxSide && file.size <= limits.maxBytes;
    if (type && fits) return labelled(await readAsDataURL(file), type);
    return encode(bitmap, limits);
  } finally {
    bitmap.close?.();
  }
}
