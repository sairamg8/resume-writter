import { renderCoverLetterPdf, renderResumePdf, warmPdfExport } from '@/utils/pdfExportReactPDF';
import { facesBorrowed, fontFallback } from '@/utils/fontFallback';

/**
 * What the PDF worker (pdfWorker.js) does with one message from pdfBuild.js: build the résumé's or
 * the letter's PDF with the very functions the main thread uses (renderResumePdf,
 * renderCoverLetterPdf), or warm their fonts and template. Its reply carries the PDF's bytes, the
 * font the build could not load and whether a face borrows another's data (fontFallback.js lives on
 * the main thread, where the editor and the preview read them); a build that fails replies with its
 * error's message, as the main thread would have thrown it.
 * Jobs run one at a time (runJobs), so the fallback read after a build is that build's.
 */
export async function runJob({ id, kind, resume, options }) {
  try {
    if (kind === 'warm') {
      await warmPdfExport(resume);
      return { id };
    }
    const blob = kind === 'letter' ? await renderCoverLetterPdf(resume, options) : await renderResumePdf(resume, options);
    return { id, bytes: new Uint8Array(await blob.arrayBuffer()), fallback: fontFallback(), borrowed: facesBorrowed() };
  } catch (e) {
    return { id, error: e?.message || String(e) };
  }
}

/**
 * A queue that runs each job after the one before it and hands its reply to `reply`. A reply that
 * cannot be sent (postMessage throws) is answered with its error instead, so that build fails with
 * a message rather than waiting for good — and the queue goes on: one throw left `last` rejected,
 * and every later job was skipped with no reply, the preview and Export PDF waiting forever.
 */
export function runJobs(reply) {
  let last = Promise.resolve();
  return (job) => {
    last = last.then(() => runJob(job)).then(reply)
      .catch((e) => reply({ id: job?.id, error: e?.message || String(e) }))
      .catch(() => { /* not even the error could be sent: the next job still runs */ });
    return last;
  };
}
