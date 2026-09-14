// Images people upload — the profile photo, the cover-letter photo, a contact field's own icon —
// as data URLs the PDF can draw. react-pdf decodes only PNG, JPEG and SVG (base64 data URLs):
// a WebP, GIF or AVIF upload showed in the editor but vanished from the preview and the export
// (review R1-1). So an upload in any other format the browser can decode is converted once, here.

const DRAWABLE_DATA_URL = /^data:image\/(png|jpe?g|svg\+xml|svg);base64,/i;

/**
 * True when the PDF can draw `src`: a PNG, JPEG or SVG data URL, or a plain URL (react-pdf
 * fetches those). False for other data URLs — a WebP or GIF saved before uploads were converted
 * — and for anything that is not a non-empty string.
 */
export function isDrawableImage(src) {
  if (typeof src !== 'string' || !src) return false;
  return src.startsWith('data:') ? DRAWABLE_DATA_URL.test(src) : true;
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
 * The uploaded image `file` as a data URL the PDF can draw. PNG, JPEG and SVG come back as they
 * are; any other format the browser decodes (WebP, GIF, AVIF, BMP …) is converted — to JPEG for
 * `kind: 'photo'`, to PNG for `kind: 'icon'`. Rejects with UNREADABLE_IMAGE when it is not an
 * image the browser can decode.
 */
export async function readImageFile(file, { kind = 'photo' } = {}) {
  if (!file || !file.type?.startsWith('image/')) throw new Error(UNREADABLE_IMAGE);
  const dataUrl = await readAsDataURL(file);
  if (isDrawableImage(dataUrl)) return dataUrl;
  try {
    return await reencode(file, kind === 'icon' ? { as: 'png', maxSide: 256 } : { as: 'jpeg', maxSide: 1024 });
  } catch {
    throw new Error(UNREADABLE_IMAGE);
  }
}
