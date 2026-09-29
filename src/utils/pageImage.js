// Page 1 of a résumé (or its cover letter) as a small picture: the same react-pdf document the preview
// and Export PDF build, painted by pdf.js into a canvas and kept as a JPEG data URL. The template
// gallery's cards (A1) and the dashboard's résumé cards (C1) show it. Loaded on demand only: it pulls
// in react-pdf and pdf.js, which the dashboard does not load at start. Built where every PDF is
// (pdfBuild: in the Web Worker, R2-142), so a gallery filling up never freezes the editor.
import { buildCoverLetterPdf, buildResumePdf } from './pdfBuild.js';
import { loadPdfjs } from './pdfjsLoader.js';
import { buildNote } from './fontFallback.js';
import { imageRetryPendingFor } from './printableImage.js';
import { markIncomplete } from './pageImageStore.js';

/**
 * Whether the build of `resume` printed without what it asks for: its font (Noto Sans in its place, or
 * a face borrowing another's data) or an image whose fetch failed for a passing reason. The picture is
 * shown but not kept, so a later visit paints it again (R5-HUNT6-CARD-PICTURE-KEPT-DEGRADED).
 */
function printedIncomplete(resume, blob) {
  const note = buildNote(blob);
  if (note?.fallback || note?.borrowed) return true;
  const photos = [resume?.personal?.photo, resume?.coverLetter?.clPhoto];
  const icons = Object.values(resume?.settings?.customContactIcons || {});
  const pending = (src, kind) => typeof src === 'string' && src !== '' && imageRetryPendingFor(src, { kind });
  return photos.some((src) => pending(src, 'photo')) || icons.some((src) => pending(src, 'icon'));
}

/** Page 1 of `resume` (`letter`: of its cover letter), `width` px wide, as a data URL. */
export async function pageImage(resume, { width = 240, letter = false } = {}) {
  // reportFont: false — a picture of some other résumé or template must not change the font notice
  // above the editor's preview, which speaks of the open résumé only (R4-PDF-01).
  const quiet = { reportFont: false };
  const [blob, pdfjs] = await Promise.all([letter ? buildCoverLetterPdf(resume, quiet) : buildResumePdf(resume, quiet), loadPdfjs()]);
  const data = new Uint8Array(await blob.arrayBuffer());
  const pdf = await pdfjs.lib.getDocument({ data, worker: pdfjs.worker, isEvalSupported: false }).promise;
  const canvas = document.createElement('canvas');
  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport, canvas }).promise;
    const url = canvas.toDataURL('image/jpeg', 0.82);
    markIncomplete(url, printedIncomplete(resume, blob));
    return url;
  } finally {
    // Its pixels freed now, not when collected: iOS Safari caps a page's canvas memory (R2-170).
    canvas.width = 0;
    canvas.height = 0;
    pdf.loadingTask?.destroy();
  }
}
