import { useEffect, useSyncExternalStore } from 'react';
import { onPrintableChange, printableImage, printableNow } from '@/utils/printableImage';

/**
 * What the PDF prints for the saved image `src` (printableNow): the image, the copy made of a WebP
 * or GIF saved before uploads were converted, or null when it prints none — undefined while that
 * copy is being made. So the editor can say when a photo it shows will not print (R7-7); the copy
 * it starts is the one the preview then prints.
 *
 * The same reader serves a server render (31-contact-fields renders the panels): it reads the copies
 * made so far, and no copy is started there — useEffect does that, in the browser.
 */
export function usePrintableImage(src, { kind = 'photo' } = {}) {
  const read = () => printableNow(src, { kind });
  const now = useSyncExternalStore(onPrintableChange, read, read);
  useEffect(() => {
    if (now === undefined) printableImage(src, { kind });
  }, [src, now, kind]);
  return now;
}

const REUPLOAD = 'Upload it again as a PNG or JPEG.';
const UPLOAD_ITSELF = 'Upload the image itself.';
/** A photo stored as a URL or path (an imported JSON Resume's basics.image), not as an image's data (R2-093). */
const isLink = (src) => typeof src === 'string' && !src.startsWith('data:');
export const UNPRINTABLE_ICON = "This icon can't be printed; upload a PNG or JPEG";

/**
 * The letter's photo as the Cover Letter panel describes it: `hasPhoto` when the letter prints one
 * (its own, else the résumé's — CoverLetterHeaderPDF), and `note`, the line saying which, or why it
 * prints none. An own photo that cannot be printed no longer hides a résumé photo that can (R7-7).
 * A photo whose copy is still being made counts as one that prints, so nothing flickers.
 */
export function useLetterPhoto(cl, personal) {
  const own = cl?.clPhoto;
  const resume = personal?.photo;
  const ownPrints = usePrintableImage(own);
  const resumePrints = usePrintableImage(resume);
  const ownFails = Boolean(own) && ownPrints === null;
  const resumeFails = Boolean(resume) && resumePrints === null;
  const hasPhoto = Boolean(own && !ownFails) || Boolean(resume && !resumeFails);
  let note;
  if (ownFails) {
    const instead = hasPhoto ? ', so the letter uses your résumé photo' : '';
    note = { warn: true, text: isLink(own) ? `This photo is a link that could not be loaded${instead}. ${UPLOAD_ITSELF}` : `This photo's format can't be printed${instead}. ${REUPLOAD}` };
  } else if (own) {
    note = { text: 'Using own photo' };
  } else if (resumeFails) {
    const why = isLink(resume) ? 'Your résumé photo is a link that could not be loaded.' : "Your résumé photo's format can't be printed.";
    note = { warn: true, text: `${why} Upload a photo here, or again under Personal Info.` };
  } else {
    note = { text: resume ? 'Using resume photo (faded = preview)' : 'No photo — upload or add to resume' };
  }
  return { hasPhoto, note };
}

/** The Photo panel's line for a résumé photo that cannot be printed. */
export const UNPRINTABLE_PHOTO = `This photo's format can't be printed. ${REUPLOAD}`;
/** Its line for a photo stored as a link (an imported JSON Resume's basics.image) that could not be loaded (R2-093). */
export const UNLOADABLE_PHOTO = `This photo is a link that could not be loaded, so it is not printed. ${UPLOAD_ITSELF}`;
