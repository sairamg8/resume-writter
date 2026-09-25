import { withPrintablePhotos } from '@/utils/printableImage';
import { setFontFallback } from '@/utils/fontFallback';
import { downloadBlob } from '@/utils/download';

/**
 * Where the app's PDFs are built: the preview, Export PDF, 1-Page Fit and the ATS tab's parser view
 * all ask here (R2-142, PERF-6). A build lays out every page and writes the file — hundreds of
 * milliseconds on a long résumé — and on the main thread the editor froze for all of it: keys
 * typed while the preview rebuilt appeared late. Now it runs in a Web Worker (pdfWorker.js), with
 * the same renderResumePdf and renderCoverLetterPdf, so the file is the same whichever thread
 * wrote it, and the preview is still the download.
 *
 * Where no Worker can be started (Node, where the tests render; a browser that refuses module
 * workers) or the worker fails to load, the build runs on the main thread as before — a build
 * already sent to a worker that dies is run there too, so none is lost.
 *
 * Photos are made printable here first (withPrintablePhotos): converting a WebP needs a canvas,
 * which a worker may not have, and the copy is kept for the session on this side.
 */

let workerPromise = null; // Promise<worker | null>
let createWorker = () => import('./pdfWorker.js?worker').then(({ default: PdfWorker }) => new PdfWorker());
let broken = false;       // the worker failed to start or died: every build runs on the main thread
const pending = new Map(); // id → { job, resolve, reject }
let nextId = 0;
let lastBuild = 0;         // the id of the latest build asked for: only it sets the font fallback

const mainThread = () => import('@/utils/pdfExportReactPDF');

/** A job run on the main thread, as the worker would run it (pdfWorkerJobs.js). */
async function runHere({ kind, resume, options }) {
  const m = await mainThread();
  if (kind === 'warm') return m.warmPdfExport(resume);
  return kind === 'letter' ? m.renderCoverLetterPdf(resume, options) : m.renderResumePdf(resume);
}

/** The worker stopped (failed to load, or died): run what it held here, and every build from now. */
function giveUp(worker) {
  broken = true;
  workerPromise = null;
  try { worker?.terminate?.(); } catch { /* already gone */ }
  const held = [...pending.values()];
  pending.clear();
  for (const { job, resolve, reject } of held) runHere(job).then(resolve, reject);
}

function onReply({ data }) {
  const entry = pending.get(data?.id);
  if (!entry) return;
  pending.delete(data.id);
  if (data.error !== undefined) { entry.reject(new Error(data.error)); return; }
  if (entry.job.kind === 'warm') { entry.resolve(); return; }
  // As resolvePdfFonts does on the main thread: a slow build for a font since changed must not name it.
  if (data.id === lastBuild) setFontFallback(data.fallback);
  entry.resolve(new Blob([data.bytes], { type: 'application/pdf' }));
}

function worker() {
  if (broken || (typeof Worker === 'undefined' && !createWorker.forTest)) return null;
  if (!workerPromise) {
    workerPromise = createWorker().then((w) => {
      w.onmessage = onReply;
      w.onerror = (e) => { e?.preventDefault?.(); giveUp(w); };
      w.onmessageerror = () => giveUp(w);
      return w;
    }).catch(() => { broken = true; workerPromise = null; return null; });
  }
  return workerPromise;
}

async function run(job) {
  const w = await worker();
  if (!w) return runHere(job);
  return new Promise((resolve, reject) => {
    pending.set(job.id, { job, resolve, reject });
    try {
      w.postMessage(job);
    } catch {
      // A résumé the structured clone cannot copy: build it here, as before.
      pending.delete(job.id);
      runHere(job).then(resolve, reject);
    }
  });
}

async function build(kind, resume, options) {
  const id = ++nextId;
  lastBuild = id;
  const printable = await withPrintablePhotos(resume);
  return run({ id, kind, resume: printable, options });
}

/** The résumé's PDF, as Export PDF downloads it and the preview paints it (renderResumePdf). */
export const buildResumePdf = (resume) => build('resume', resume);

/** The cover letter's PDF (renderCoverLetterPdf); `{ preview: true }` adds the empty letter's hint. */
export const buildCoverLetterPdf = (resume, options = {}) => build('letter', resume, options);

/** Load the fonts and template `resume` prints with, where its PDFs are built (warmPdfExport). */
export async function warmPdfBuild(resume) {
  return run({ id: ++nextId, kind: 'warm', resume: await withPrintablePhotos(resume) });
}

/** Build and download the résumé's PDF (exportToPDFReact). */
export async function exportResumePdf(resume, filename = 'resume.pdf') {
  const blob = await buildResumePdf(resume);
  downloadBlob(blob, filename);
  return blob;
}

/** Build and download the cover letter's PDF (exportCoverLetterPDFReact). */
export async function exportCoverLetterPdf(resume, filename = 'cover-letter.pdf') {
  const blob = await buildCoverLetterPdf(resume);
  downloadBlob(blob, filename);
  return blob;
}

/**
 * For tests: `create()` returns a Worker-like object ({ postMessage, onmessage, onerror, terminate })
 * that stands in for pdfWorker.js; null goes back to the real worker (none in Node).
 */
export function _setPdfWorkerForTest(create) {
  for (const { job, resolve, reject } of pending.values()) runHere(job).then(resolve, reject);
  pending.clear();
  workerPromise = null;
  broken = false;
  createWorker = create
    ? Object.assign(async () => create(), { forTest: true })
    : () => import('./pdfWorker.js?worker').then(({ default: PdfWorker }) => new PdfWorker());
}
