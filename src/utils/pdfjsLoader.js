// pdf.js, loaded once for the whole app: the editor's preview (PdfPreview) and the page pictures of
// the template gallery and the dashboard (pageImage.js) paint with the same library and one worker.

let pdfjsPromise = null;

/** `{ lib, worker }`: pdf.js and the one worker every document is read with. */
export function loadPdfjs() {
  if (!pdfjsPromise) {
    // The legacy build: pdf.js 6's default build calls ES2025 APIs (Uint8Array#toHex) that
    // browsers older than ~2025 lack, which would leave those users with no preview at all.
    pdfjsPromise = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      // One worker for every render: a document given a caller-owned worker leaves it running
      // when its loading task is destroyed, so re-renders skip worker start-up.
      return { lib, worker: new lib.PDFWorker() };
    }).catch((e) => { pdfjsPromise = null; throw e; });
  }
  return pdfjsPromise;
}

/** For tests: a stand-in `{ lib, worker }` for pdf.js, or null to load the real one again. */
export function setPdfjsForTest(pdfjs) {
  pdfjsPromise = pdfjs ? Promise.resolve(pdfjs) : null;
}
