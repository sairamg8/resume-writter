// Page 1 of a résumé (or its cover letter) as a small picture: the same react-pdf document the preview
// and Export PDF build, painted by pdf.js into a canvas and kept as a JPEG data URL. The template
// gallery's cards (A1) and the dashboard's résumé cards (C1) show it. Loaded on demand only: it pulls
// in react-pdf and pdf.js, which the dashboard does not load at start. Built where every PDF is
// (pdfBuild: in the Web Worker, R2-142), so a gallery filling up never freezes the editor.
import { buildCoverLetterPdf, buildResumePdf } from './pdfBuild.js';
import { loadPdfjs } from './pdfjsLoader.js';

/** Page 1 of `resume` (`letter`: of its cover letter), `width` px wide, as a data URL. */
export async function pageImage(resume, { width = 240, letter = false } = {}) {
  const [blob, pdfjs] = await Promise.all([letter ? buildCoverLetterPdf(resume) : buildResumePdf(resume), loadPdfjs()]);
  const data = new Uint8Array(await blob.arrayBuffer());
  const pdf = await pdfjs.lib.getDocument({ data, worker: pdfjs.worker, isEvalSupported: false }).promise;
  const canvas = document.createElement('canvas');
  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport, canvas }).promise;
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    // Its pixels freed now, not when collected: iOS Safari caps a page's canvas memory (R2-170).
    canvas.width = 0;
    canvas.height = 0;
    pdf.loadingTask?.destroy();
  }
}
