// A photo saved at camera size stays that size (ONB-10). Every build before a4a1f85 stored a PNG
// or JPEG upload whole — a phone photo at 2 MB and more — and nothing made a saved one smaller: it
// kept most of the browser's storage, put its résumé over the 1 MiB of a cloud document (held back
// from the sync, cloudSyncHeld.js) and was embedded whole by every render, until the user uploaded
// it again. Uploads are scaled since (readImageFile, R7-4); a photo saved before is now replaced,
// once, by the copy an upload of it would store (imageCopy), when the store loads it or takes it
// in — an import, a restore, the cloud sync (useSmallerPhotos). normalizeResume cannot do it:
// decoding an image takes a promise. Like normalizeResume, this leaves `updatedAt` as it is: it is
// not an edit, so it never wins a sync merge over another device's newer copy. A photo no copy can
// be made of (one this browser cannot decode, an SVG over the limit) is left as it is.
import { KINDS } from './imageUpload.js';
import { imageCopy } from './printableImage.js';

/** Where a résumé keeps a photo: its own, and the cover letter's. */
const PHOTOS = [['personal', 'photo'], ['coverLetter', 'clPhoto']];

/** The most base64 an upload stores a photo with: its most bytes (KINDS), 4 characters for 3. */
const MAX_PAYLOAD = Math.ceil(KINDS.photo.maxBytes / 3) * 4;

/** True when `src` is a data URL holding more than any photo an upload stores. */
const oversizedPhoto = (src) => typeof src === 'string' && src.startsWith('data:')
  && src.length - src.indexOf(',') - 1 > MAX_PAYLOAD;

/** The oversized photos `resumes` hold, each once (a duplicated résumé shares its original's). */
export function oversizedPhotos(resumes) {
  const found = new Set();
  for (const r of Array.isArray(resumes) ? resumes : []) {
    for (const [part, key] of PHOTOS) {
      if (oversizedPhoto(r?.[part]?.[key])) found.add(r[part][key]);
    }
  }
  return [...found];
}

/** The copy that takes the place of oversized photo `src` in the store; null when there is none. */
export async function smallerPhoto(src) {
  const copy = await imageCopy(src);
  return typeof copy === 'string' && copy.length < src.length ? copy : null;
}

/**
 * The store's `state` with every photo that is still `src` replaced by `copy`, `updatedAt` as it
 * was; the same state when none is — a photo replaced or removed meanwhile is the user's.
 */
export function withPhotoReplaced(state, src, copy) {
  let changed = false;
  const resumes = state.resumes.map((r) => {
    let out = r;
    for (const [part, key] of PHOTOS) {
      if (out?.[part]?.[key] === src) out = { ...out, [part]: { ...out[part], [key]: copy } };
    }
    changed ||= out !== r;
    return out;
  });
  return changed ? { ...state, resumes } : state;
}
