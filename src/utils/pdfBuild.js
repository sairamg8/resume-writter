import { withPrintablePhotos } from '@/utils/printableImage';
import { faceFetched, noteBuild, setFacesBorrowed, setFontFallback } from '@/utils/fontFallback';
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
 * A build that never comes back must not hold every later one behind it: the worker runs its jobs
 * one at a time, and a font fetch that stalls (a captive portal, a CDN that takes the connection and
 * never answers) left the preview on "Updating preview…" with Export PDF, 1-Page Fit and the ATS view
 * dead behind it until the page was reloaded (R2-142). The job the worker is on gets BUILD_TIMEOUT_MS:
 * past it the worker is stopped, that build fails with a message (the preview offers Retry) and the
 * builds that waited behind it go to a fresh worker.
 *
 * Photos are made printable here first (withPrintablePhotos): converting a WebP needs a canvas,
 * which a worker may not have, and the copy is kept for the session on this side.
 */

let workerPromise = null; // Promise<worker | null>
let createWorker = () => import('./pdfWorker.js?worker').then(({ default: PdfWorker }) => new PdfWorker());
let broken = false;       // the worker failed to start or died: every build runs on the main thread
const pending = new Map(); // id → { job, resolve, reject }
let nextId = 0;
let lastBuild = 0;         // the id of the latest build asked for that reports its font: only it sets the font fallback
let proven = false;        // a build came back from the worker: from then on its errors are the résumé's
let liveWorker = null;     // the worker `pending` is waiting on
// Comfortably past a long résumé on a slow phone and the 10 s a stalled font is waited for (pdfFontLoader.js)
// before the name, heading and script fonts' own waits. A font that is only slow prints in Noto Sans meanwhile
// and the preview builds again when it lands: this limit is for a build that does not come back at all.
const BUILD_TIMEOUT_MS = 60_000;
let buildTimeoutMs = BUILD_TIMEOUT_MS;
let clock = null;          // { id, timer }: the job the worker is on, and how long it has left

const mainThread = () => import('@/utils/pdfExportReactPDF');

const stalledError = () => new Error(`building took more than ${Math.max(1, Math.round(buildTimeoutMs / 1000))} s — a font may not be reachable`);

/** A job run on the main thread, as the worker would run it (pdfWorkerJobs.js). */
async function buildHere({ kind, resume, options }) {
  const m = await mainThread();
  if (kind === 'warm') return m.warmPdfExport(resume);
  return kind === 'letter' ? m.renderCoverLetterPdf(resume, options) : m.renderResumePdf(resume, options);
}

/**
 * buildHere, with the same time limit as the worker's jobs. There is no thread to stop here: a build
 * that runs past it is left to finish unheard, and the build that waited for it goes on.
 */
function runHere(job) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(stalledError()), buildTimeoutMs);
    timer.unref?.();
    buildHere(job).then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/**
 * Time the job the worker is on: the oldest pending (it works in the order they were sent). One that
 * waits behind another is not timed yet — its wait is not its own.
 */
function watchHead() {
  const head = pending.keys().next().value;
  if (clock && clock.id === head) return;
  if (clock) clearTimeout(clock.timer);
  if (head === undefined) { clock = null; return; }
  const timer = setTimeout(() => stalled(head), buildTimeoutMs);
  timer.unref?.();
  clock = { id: head, timer };
}

/** The worker has been on job `id` too long: stop it, fail that build, and hand the ones behind it to a fresh worker. */
function stalled(id) {
  clock = null;
  const entry = pending.get(id);
  if (!entry) return;
  pending.delete(id);
  const behind = [...pending.values()];
  pending.clear();
  const stuck = liveWorker;
  liveWorker = null;
  workerPromise = null; // not `broken`: the next job starts a new worker, which can start
  try { stuck?.terminate?.(); } catch { /* already gone */ }
  entry.reject(stalledError());
  for (const { job, resolve, reject } of behind) run(job).then(resolve, reject);
}

/** The worker stopped (failed to load, or died): run what it held here, and every build from now. */
function giveUp(worker) {
  broken = true;
  workerPromise = null;
  liveWorker = null;
  try { worker?.terminate?.(); } catch { /* already gone */ }
  const held = [...pending.values()];
  pending.clear();
  watchHead();
  for (const { job, resolve, reject } of held) runHere(job).then(resolve, reject);
}

function onReply({ data }, w) {
  // Not a reply: the worker says a font face's own data arrived after its build (fontFallback.js).
  if (data?.faceFetched) { faceFetched(); return; }
  const entry = pending.get(data?.id);
  if (!entry) return;
  pending.delete(data.id);
  watchHead();
  if (data.error !== undefined) {
    // Before the worker has built anything, its error may be its own — a browser whose workers lack
    // something react-pdf needs — not the résumé's: the build runs here, and if it works here, every
    // build does from now (the worker path is proven on Chromium only). A warm-up is best effort.
    if (proven || entry.job.kind === 'warm') { entry.reject(new Error(data.error)); return; }
    runHere(entry.job).then((out) => { giveUp(w); entry.resolve(out); }, entry.reject);
    return;
  }
  if (entry.job.kind === 'warm') { entry.resolve(); return; }
  proven = true;
  // As resolvePdfFonts does on the main thread: a slow build for a font since changed must not name it,
  // and a page picture (reportFont: false) never speaks for the open résumé.
  if (entry.job.options?.reportFont !== false && data.id === lastBuild) {
    setFontFallback(data.fallback);
    setFacesBorrowed(data.borrowed);
  }
  // What the build could not print as asked goes with its PDF: a page picture reads it (buildNote).
  entry.resolve(noteBuild(new Blob([data.bytes], { type: 'application/pdf' }), data));
}

function worker() {
  if (broken || (typeof Worker === 'undefined' && !createWorker.forTest)) return null;
  if (!workerPromise) {
    workerPromise = createWorker().then((w) => {
      liveWorker = w;
      w.onmessage = (e) => onReply(e, w);
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
      watchHead();
    } catch {
      // A résumé the structured clone cannot copy: build it here, as before.
      pending.delete(job.id);
      watchHead();
      runHere(job).then(resolve, reject);
    }
  });
}

async function build(kind, resume, options) {
  const id = ++nextId;
  // A page picture (pageImage: the gallery, dashboard cards, /new) is not the latest build of the
  // open résumé: the preview's reply queued behind it must still set the notice (R4-PDF-01).
  if (options?.reportFont !== false) lastBuild = id;
  const printable = await withPrintablePhotos(resume);
  return run({ id, kind, resume: printable, options });
}

/**
 * The résumé's PDF, as Export PDF downloads it and the preview paints it (renderResumePdf).
 * `{ reportFont: false }` for a page picture: the editor's font notice is left as it was.
 */
export const buildResumePdf = (resume, options) => build('resume', resume, options);

/** The cover letter's PDF (renderCoverLetterPdf); `{ preview: true }` adds the empty letter's hint, `reportFont` as above. */
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
 * that stands in for pdfWorker.js; null goes back to the real worker (none in Node). `timeoutMs`
 * stands in for BUILD_TIMEOUT_MS.
 */
export function _setPdfWorkerForTest(create, { timeoutMs } = {}) {
  for (const { job, resolve, reject } of pending.values()) runHere(job).then(resolve, reject);
  pending.clear();
  watchHead();
  workerPromise = null;
  liveWorker = null;
  broken = false;
  proven = false;
  buildTimeoutMs = timeoutMs ?? BUILD_TIMEOUT_MS;
  createWorker = create
    ? Object.assign(async () => create(), { forTest: true })
    : () => import('./pdfWorker.js?worker').then(({ default: PdfWorker }) => new PdfWorker());
}
