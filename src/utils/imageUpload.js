// Images people upload — the profile photo, the cover-letter photo, a contact field's own icon —
// as data URLs the PDF can draw. react-pdf decodes only PNG, JPEG and SVG (base64 data URLs):
// a WebP, GIF or AVIF upload showed in the editor but vanished from the preview and the export
// (review R1-1). So an upload in any other format the browser can decode is converted once, here.
//
// react-pdf picks its decoder by the data URL's label, and the browser labels a file by its name,
// so the bytes decide what a file is, never the label: a WebP saved as "me.jpg" is converted too
// (R7-3).

/** A data URL as react-pdf reads one: `data:image/<label>;base64,<bytes>`. */
const IMAGE_DATA_URL = /^data:image\/([\w.+-]+);base64,/i;
/** The labels react-pdf decodes each type by, and the one an upload is stored with. */
const LABELS = { png: ['png'], jpeg: ['jpeg', 'jpg'], svg: ['svg+xml', 'svg'] };
const MIME = { png: 'image/png', jpeg: 'image/jpeg', svg: 'image/svg+xml' };
/** Enough of a file to tell its type: an SVG may open with an XML declaration, a comment, a DOCTYPE. */
const HEAD_BYTES = 4096;
/** An SVG document's start, past the prolog react-pdf's parser drops (declaration, DOCTYPE, comments). */
const SVG_START = /^(?:\s|<\?[^>]*>|<!DOCTYPE[^[>]*(?:\[[^\]]*\])?\s*>|<!--[\s\S]*?-->)*<svg[\s/>]/i;

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

/**
 * `file` decoded by the browser and re-encoded: PNG keeps transparency (icons); JPEG is far
 * smaller for a photo, drawn on white because JPEG has no transparency. Scaled down so its
 * longer side is at most `maxSide` px — the PDF prints a photo under 100 pt and an icon under 20.
 */
async function reencode(file, { as, maxSide }) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (as === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(as === 'jpeg' ? 'image/jpeg' : 'image/png', 0.9);
  } finally {
    bitmap.close?.();
  }
}

/**
 * The uploaded image `file` as a data URL the PDF can draw. What the file is comes from its bytes,
 * not its name: a PNG, JPEG or SVG comes back as it is, labelled as what it is; any other format
 * the browser decodes (WebP, GIF, AVIF, BMP …) is converted — to JPEG for `kind: 'photo'`, to PNG
 * for `kind: 'icon'`. Rejects with UNREADABLE_IMAGE when it is not an image the browser can decode.
 */
export async function readImageFile(file, { kind = 'photo' } = {}) {
  if (!file || !file.type?.startsWith('image/')) throw new Error(UNREADABLE_IMAGE);
  const type = sniff(await readHead(file));
  if (type) return labelled(await readAsDataURL(file), type);
  try {
    return await reencode(file, kind === 'icon' ? { as: 'png', maxSide: 256 } : { as: 'jpeg', maxSide: 1024 });
  } catch {
    throw new Error(UNREADABLE_IMAGE);
  }
}
