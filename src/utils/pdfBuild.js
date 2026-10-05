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
 * A worker that stops answering is let go too (R2-142, PERF-6): dying is not the only way to fail, a
 * worker the browser froze or killed without an error event never replies and left the preview on
 * "Rendering preview…" for good. The job it is working on has a budget (pdfBuildTimeoutMs, 20 s and
 * more for a long résumé, twice that before its first reply while the engine and fonts still load);
 * one unanswered is given up on: the worker is terminated, and a late reply from it is ignored.
 * A worker that never replied at all may never have started, so its jobs run on the main thread, as
 * after a failed start; one that had built before was working on this résumé, so that build fails
 * with a retryable error (a hang in layout would only freeze the page on the main thread) and the jobs
 * queued behind it go to a fresh worker.
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
const gone = new WeakSet(); // workers let go (dead, or silent past their budget): whatever they still send is ignored

// The watchdog's clock. The worker builds its jobs in the order it got them, so one timer runs, on the
// oldest job it holds: a job waiting behind others is not late, and every reply restarts it for the next.
const realTimers = { set: (fn, ms) => { const t = setTimeout(fn, ms); t?.unref?.(); return t; }, clear: (t) => clearTimeout(t) };
let timers = realTimers;
let watchdog = null;

/** What a build gets to answer in before its worker is given up on (pdfBuildTimeoutMs adds to it). */
export const PDF_WORKER_TIMEOUT_MS = 20_000;
const PER_ENTRY_MS = 250;   // more for every entry of a résumé, so a long one on a slow phone is not cut off
const MAX_ENTRIES = 200;    // the most entries counted

/**
 * How long the worker gets to answer `job`: PDF_WORKER_TIMEOUT_MS and PER_ENTRY_MS for each entry of
 * the résumé it prints; twice the base while `cold` (before its first reply, when it is still loading
 * the PDF engine, the template and the fonts over the network).
 */
export function pdfBuildTimeoutMs(job, cold = false) {
  let entries = 0;
  if (job?.kind !== 'letter' && Array.isArray(job?.resume?.sections)) {
    for (const s of job.resume.sections) entries += Array.isArray(s?.items) ? s.items.length : 0;
  }
  return (cold ? 2 : 1) * PDF_WORKER_TIMEOUT_MS + Math.min(entries, MAX_ENTRIES) * PER_ENTRY_MS;
}

const mainThread = () => import('@/utils/pdfExportReactPDF');

/** A job run on the main thread, as the worker would run it (pdfWorkerJobs.js). */
async function runHere({ kind, resume, options }) {
  const m = await mainThread();
  if (kind === 'warm') return m.warmPdfExport(resume);
  return kind === 'letter' ? m.renderCoverLetterPdf(resume, options) : m.renderResumePdf(resume, options);
}

function stopWatch() {
  if (watchdog !== null) timers.clear(watchdog);
  watchdog = null;
}

/** Start the clock on the job the worker is working on now: the oldest it holds. None held, none runs. */
function watch(w) {
  stopWatch();
  const head = pending.values().next().value;
  if (head) watchdog = timers.set(() => stalled(w), pdfBuildTimeoutMs(head.job, !proven));
}

/** Let `w` go: stop it, and ignore whatever it still sends (a killed worker's late reply included). */
function retire(w) {
  stopWatch();
  if (!w) return;
  gone.add(w);
  try { w.terminate?.(); } catch { /* already gone */ }
}

/** The worker stopped (failed to load, or died): run what it held here, and every build from now. */
function giveUp(worker) {
  if (worker && gone.has(worker)) return; // let go already, and its jobs sent where they were going
  broken = true;
  workerPromise = null;
  retire(worker);
  const held = [...pending.values()];
  pending.clear();
  for (const { job, resolve, reject } of held) runHere(job).then(resolve, reject);
}

/** The worker did not answer the job it is working on within its budget (pdfBuildTimeoutMs). */
function stalled(w) {
  watchdog = null;
  if (gone.has(w)) return;
  const held = [...pending.values()];
  pending.clear();
  workerPromise = null;
  retire(w);
  if (!proven) {
    // It never answered anything: it may never have started (its script blocked, a browser that
    // half supports module workers). Built here, as after a failed start, and every build from now.
    broken = true;
    for (const { job, resolve, reject } of held) runHere(job).then(resolve, reject);
    return;
  }
  // It has built before, so it was working on this résumé: running it on the main thread could freeze
  // the page for as long. That build fails, retryable; the jobs queued behind it start on a fresh worker.
  const [hung, ...queued] = held;
  hung?.reject(Object.assign(new Error('The PDF took too long to build'), { code: 'PDF_BUILD_TIMEOUT' }));
  for (const { job, resolve, reject } of queued) run(job).then(resolve, reject);
}

function onReply({ data }, w) {
  if (gone.has(w)) return; // let go: what a terminated or replaced worker still sends counts for nothing
  // Not a reply: the worker says a font face's own data arrived after its build (fontFallback.js).
  if (data?.faceFetched) { faceFetched(); return; }
  const entry = pending.get(data?.id);
  if (!entry) return;
  pending.delete(data.id);
  // Each way out below moves the clock on to the job the worker starts next (watch).
  if (data.error !== undefined) {
    watch(w);
    // Before the worker has built anything, its error may be its own — a browser whose workers lack
    // something react-pdf needs — not the résumé's: the build runs here, and if it works here, every
    // build does from now (the worker path is proven on Chromium only). A warm-up is best effort.
    if (proven || entry.job.kind === 'warm') { entry.reject(new Error(data.error)); return; }
    runHere(entry.job).then((out) => { giveUp(w); entry.resolve(out); }, entry.reject);
    return;
  }
  if (entry.job.kind === 'warm') { watch(w); entry.resolve(); return; }
  proven = true;
  watch(w);
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
    } catch {
      // A résumé the structured clone cannot copy: build it here, as before.
      pending.delete(job.id);
      runHere(job).then(resolve, reject);
      return;
    }
    // The only job it holds starts its clock now; one queued behind others is timed when it is next.
    if (pending.size === 1) watch(w);
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
 * that stands in for pdfWorker.js; null goes back to the real worker (none in Node). `timers`
 * ({ set(fn, ms) → handle, clear(handle) }) stands in for the watchdog's clock, so a test fires the
 * timeout when it means to instead of waiting 20 s.
 */
export function _setPdfWorkerForTest(create, { timers: clock } = {}) {
  stopWatch();
  timers = clock || realTimers;
  for (const { job, resolve, reject } of pending.values()) runHere(job).then(resolve, reject);
  pending.clear();
  workerPromise = null;
  broken = false;
  proven = false;
  createWorker = create
    ? Object.assign(async () => create(), { forTest: true })
    : () => import('./pdfWorker.js?worker').then(({ default: PdfWorker }) => new PdfWorker());
}
