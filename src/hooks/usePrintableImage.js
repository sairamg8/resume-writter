import { useEffect, useSyncExternalStore } from 'react';
import { onPrintableChange, printableImage, printableNow } from '@/utils/printableImage';
import { letterResumePhoto } from '@/utils/coverLetter';

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
export const UNPRINTABLE_ICON = "This icon can't be printed; upload a PNG or JPEG";

/**
 * The letter's photo as the Cover Letter panel describes it: `hasPhoto` when the letter prints one
 * (its own, else the résumé's — CoverLetterHeaderPDF), and `note`, the line saying which, or why it
 * prints none. An own photo that cannot be printed no longer hides a résumé photo that can (R7-7).
 * A photo whose copy is still being made counts as one that prints, so nothing flickers. A résumé
 * photo hidden under Personal Info → Photo is none: the letter does not print it (R2-092).
 */
export function useLetterPhoto(cl, personal) {
  const own = cl?.clPhoto;
  const resume = letterResumePhoto(personal);
  const ownPrints = usePrintableImage(own);
  const resumePrints = usePrintableImage(resume);
  const ownFails = Boolean(own) && ownPrints === null;
  const resumeFails = Boolean(resume) && resumePrints === null;
  const hasPhoto = Boolean(own && !ownFails) || Boolean(resume && !resumeFails);
  let note;
  if (ownFails) {
    note = { warn: true, text: `This photo's format can't be printed${hasPhoto ? ', so the letter uses your résumé photo' : ''}. ${REUPLOAD}` };
  } else if (own) {
    note = { text: 'Using own photo' };
  } else if (resumeFails) {
    note = { warn: true, text: "Your résumé photo's format can't be printed. Upload a photo here, or again under Personal Info." };
  } else {
    note = { text: resume ? 'Using resume photo (faded = preview)' : personal?.photo ? 'Résumé photo hidden — upload one for the letter' : 'No photo — upload or add to resume' };
  }
  return { hasPhoto, note };
}

/** The Photo panel's line for a résumé photo that cannot be printed. */
export const UNPRINTABLE_PHOTO = `This photo's format can't be printed. ${REUPLOAD}`;
