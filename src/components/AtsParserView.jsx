import { useEffect, useRef, useState } from 'react';
import { ScanText, ChevronDown, Copy, Check, XCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { copyText } from '@/utils/clipboard';
import { printedJobs } from '@/utils/atsChecker';
import { jobFields, parserText, readPdfLines } from '@/utils/parserText';

/**
 * "What a parser reads" (R2-141): the text of the résumé's own PDF, as pdf.js reads it — the text
 * an applicant-tracking system starts from — so the ATS tab shows what a parser sees, not what the
 * checker assumes. Closed at first: it builds the PDF only while it is open, as Export PDF builds
 * it, and reads it again after a pause in typing, as the preview does. Copy puts that text on the
 * clipboard.
 */

/** The résumé's PDF, the one Export PDF downloads and the preview paints. */
const renderResume = (resume) => import('@/utils/pdfExportReactPDF').then((m) => m.renderResumePdf(resume));

let pdfjsPromise = null;
/**
 * pdf.js as the preview loads it (PdfPreview.jsx): the legacy build — the default one calls APIs
 * browsers older than ~2025 lack — on a worker of its own, started once and kept for every read.
 */
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return { lib, worker: new lib.PDFWorker() };
    }).catch((e) => { pdfjsPromise = null; throw e; });
  }
  return pdfjsPromise;
}

/** For tests: `{ lib, worker }` for pdf.js (the worker may be left out), or null to load the real one again. */
export function _setPdfjsForTest(pdfjs) {
  pdfjsPromise = pdfjs ? Promise.resolve(pdfjs) : null;
}

/** The per-job check's fields, in the order a job's header gives them. */
const JOB_FIELDS = [['title', 'Title'], ['company', 'Company'], ['dates', 'Dates'], ['location', 'Location']];

/** How each outcome of jobFields shows: its mark, colour and what it means. */
const FIELD_LOOK = {
  own: { Icon: CheckCircle2, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', says: 'a field of its own: a parser files it' },
  joined: { Icon: AlertTriangle, tone: 'text-amber-800 bg-amber-50 border-amber-200', says: 'on one run with other text: a parser has to split it out' },
  missing: { Icon: XCircle, tone: 'text-red-700 bg-red-50 border-red-200', says: 'not found in the text as it is typed' },
};

/** A change waits this long for the typing to pause before the PDF is read again (PdfPreview's). */
const WAIT_MS = 350;

/**
 * `resume`: the one the ATS tab checks. `columnsWarned`: the layout check warns of text set side by
 * side (the two-column Sidebar, Grids 2), which pdf.js reads in its drawing order and a parser that
 * reads by position does not — said beside the text, so it is not read as the whole story.
 */
export function AtsParserView({ resume, columnsWarned = false }) {
  const [open, setOpen] = useState(false);
  // What was read: `status` 'idle' | 'reading' | 'ready' | 'error'; the pages, and the résumé they were
  // read from (`of`), stay while a newer read runs.
  const [read, setRead] = useState({ status: 'idle', pages: null, of: null, error: null });
  const [retry, setRetry] = useState(0);
  // Copy's outcome, shown on the button for a moment: 'done', 'failed' or null.
  const [copied, setCopied] = useState(null);
  const readFor = useRef(null); // { resume, retry } of the last read that started
  const wanted = useRef(0); // bumped by every change that asks for a read
  const shownGen = useRef(0); // the change whose read is on screen
  const copyTimer = useRef(null); // clears Copy's outcome; cleared itself when the view goes
  useEffect(() => () => clearTimeout(copyTimer.current), []);

  useEffect(() => {
    if (!open || !resume) return undefined;
    const last = readFor.current;
    if (last && last.resume === resume && last.retry === retry) return undefined;
    const gen = ++wanted.current;
    setRead((r) => ({ ...r, status: 'reading' }));
    // The first read at once, and a Retry; a change once the typing pauses.
    const delay = last && last.retry === retry ? WAIT_MS : 0;
    const timer = setTimeout(async () => {
      readFor.current = { resume, retry };
      try {
        const [blob, pdfjs] = await Promise.all([renderResume(resume), loadPdfjs()]);
        const pages = await readPdfLines(new Uint8Array(await blob.arrayBuffer()), pdfjs);
        // A read older than the one on screen is dropped; one newer goes up even while a later
        // change still waits, so steady typing never freezes the text (as the preview, R2-017).
        if (gen < shownGen.current) return;
        shownGen.current = gen;
        setRead({ status: gen === wanted.current ? 'ready' : 'reading', pages, of: resume, error: null });
      } catch (error) {
        if (gen === wanted.current) setRead((r) => ({ ...r, status: 'error', error }));
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [open, resume, retry]);

  const text = parserText(read.pages);
  // The jobs of the résumé that was read, not of one typed since: the check is of that PDF's text.
  const jobs = read.pages ? printedJobs(read.of) : [];
  const checks = read.pages ? jobFields(read.pages, jobs) : [];

  function handleCopy() {
    copyText(text).then(() => 'done', () => 'failed').then((outcome) => {
      setCopied(outcome);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 2500);
    });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700 shrink-0"><ScanText size={16} /></span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-gray-900">What a parser reads</span>
            <span className="block text-xs text-gray-500">The text in this résumé&apos;s PDF, as pdf.js reads it</span>
          </span>
        </span>
        <ChevronDown size={15} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-3">
          <p className="text-[11px] text-gray-600">
            What an applicant-tracking system starts from: every line pdf.js reads from the PDF, in the order it reads
            them. Text the page sets apart on one line, such as a date at the line&apos;s end, shows three spaces apart:
            a parser reads it as a field of its own.
          </p>
          {columnsWarned && (
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
              pdf.js reads text set side by side in the order it is drawn. A parser that reads the page by position, as
              Poppler does, mixes their lines: see ATS Layout &amp; Parser Safety below.
            </p>
          )}
          {read.status === 'error' && (
            <div role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
              <span className="flex-1">Could not read the PDF{read.error?.message ? ` (${read.error.message})` : ''}.</span>
              <button onClick={() => setRetry((n) => n + 1)} className="font-semibold hover:text-red-900">Retry</button>
            </div>
          )}
          {!read.pages && read.status !== 'error' && <p className="text-xs text-gray-400">Reading the PDF…</p>}
          {read.pages && (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-gray-500" data-parser-status={read.status}>
                  {read.status === 'reading' ? 'Updating…' : `${read.pages.length} page${read.pages.length === 1 ? '' : 's'} read`}
                </span>
                <button
                  onClick={handleCopy}
                  title={copied === 'failed' ? 'The browser did not allow copying to the clipboard. Select the text and copy it (Ctrl+C / ⌘C).' : 'Copy what a parser reads'}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-xl shadow-sm transition-all"
                >
                  {copied === 'done' && <><Check size={13} className="text-emerald-600" /> Copied</>}
                  {copied === 'failed' && <><XCircle size={13} className="text-red-600" /> Copy failed</>}
                  {!copied && <><Copy size={13} /> Copy</>}
                </button>
              </div>
              {jobs.length > 0 && (
                <div className="space-y-1.5" data-parser-jobs>
                  <p className="text-[11px] font-semibold text-gray-700">Each job, as a parser files it</p>
                  {jobs.map((job, i) => (
                    <div key={job.id || i} className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="font-medium text-gray-800 mr-1">{[job.role, job.company].filter(Boolean).join(' · ') || `Job ${i + 1}`}</span>
                      {JOB_FIELDS.filter(([key]) => checks[i]?.[key]).map(([key, label]) => {
                        const { Icon, tone, says } = FIELD_LOOK[checks[i][key]];
                        return (
                          <span key={key} data-field={key} data-outcome={checks[i][key]} title={`${label}: ${says}`}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${tone}`}>
                            <Icon size={11} /> {label}
                          </span>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
              <pre
                aria-label="The text a parser reads"
                className="max-h-96 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed font-mono text-gray-800 bg-gray-50 border border-gray-200 rounded-xl p-3"
              >
                {text}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
