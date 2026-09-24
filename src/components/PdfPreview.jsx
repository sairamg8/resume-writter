import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { previewBox } from '@/constants/pageSize';

/**
 * The editor preview IS the exported PDF: `render(input)` builds the same react-pdf document
 * that Export PDF downloads, and pdf.js paints its pages. One renderer, so preview and PDF
 * cannot drift apart.
 *
 * - Re-renders `DEBOUNCE_MS` after the last change to `input` — also before the first page
 *   appears and after a failed build; the previous pages stay on screen (double-buffered) until
 *   the new ones are painted, so typing never flashes blank.
 * - A finished render is shown when it is newer than the pages on screen, even while a newer
 *   change is still waiting or building (steady typing would otherwise freeze the preview); only
 *   one older than the pages on screen is dropped.
 * - `active` false (the column is hidden: "Editor only", or a phone's Edit tab) builds and paints
 *   nothing: the preview only notes it is behind (status 'paused') and builds once, with the latest
 *   input, when it is shown again. Shown again with nothing changed, it keeps what it has.
 * - Page text goes into a visually hidden element (`textId`) for screen readers and tests.
 */

const GUTTER_PX = 48;    // breathing room either side of the page
const DEBOUNCE_MS = 350;

/** Free a pdf.js document (PDFDocumentProxy has no destroy(); its loading task does). */
const release = (pdf) => { pdf?.loadingTask?.destroy(); };

let pdfjsPromise = null;
function loadPdfjs() {
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

/** For tests/pdf/90-preview-*: a stand-in `{ lib, worker }` for pdf.js, or null to load the real one again. */
export function _setPdfjsForTest(pdfjs) {
  pdfjsPromise = pdfjs ? Promise.resolve(pdfjs) : null;
}

/**
 * Reading-order text of one page, for screen readers and tests: runs that sit apart get a
 * space, and line ends become spaces too (a wrapped sentence reads as one sentence).
 */
function pageText(content) {
  let out = '';
  let prev = null;
  for (const item of content.items) {
    if (typeof item.str !== 'string') continue;
    if (prev) {
      const sameLine = !prev.hasEOL && Math.abs(item.transform[5] - prev.transform[5]) < 1;
      const gap = item.transform[4] - (prev.transform[4] + prev.width);
      if ((!sameLine || gap > 0.5) && !/\s$/.test(out) && !/^\s/.test(item.str)) out += ' ';
    }
    out += item.str;
    prev = item;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Paint every page into a fresh canvas at `cssWidth` (device-pixel sharp). */
async function paint(pages, cssWidth) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  return Promise.all(pages.map(async ({ page, width, height }) => {
    const scale = (cssWidth * dpr) / width;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    await page.render({ canvasContext: canvas.getContext('2d'), viewport, canvas }).promise;
    return { canvas, cssHeight: (cssWidth * height) / width };
  }));
}

function PageCanvas({ canvas, width, height, label }) {
  const ref = useRef(null);
  useLayoutEffect(() => { ref.current?.replaceChildren(canvas); }, [canvas]);
  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      className="mx-auto bg-white shadow-2xl shrink-0"
      style={{ width, height }}
    />
  );
}

export function PdfPreview({ render, input, zoom = 1, textId, title = 'Résumé', active = true }) {
  const [view, setView] = useState(null); // { pages, painted: [{ canvas, cssHeight }], cssWidth }
  const [status, setStatus] = useState(active ? 'rendering' : 'paused');
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0); // bumped by every change that asks for a build
  const shownGen = useRef(0);   // the generation of the pages on screen
  const built = useRef(null); // { input, render, retry } of the last build that started
  const wasActive = useRef(active);
  const docRef = useRef(null);
  const rootRef = useRef(null);
  const box = previewBox(input?.settings || input);
  const [available, setAvailable] = useState(() => box.widthPx + GUTTER_PX);
  // 100 % = fit the column (never wider than true page size); the zoom buttons scale from there.
  const fitWidth = Math.max(240, Math.min(box.widthPx, available - GUTTER_PX));
  const cssWidth = Math.round(fitWidth * zoom);
  const widthRef = useRef(cssWidth);
  widthRef.current = cssWidth;

  // Build + paint a new document whenever the input changes — only while the preview can be seen.
  useEffect(() => {
    const revealed = active && !wasActive.current;
    wasActive.current = active;
    const last = built.current;
    if (last && last.input === input && last.render === render && last.retry === retry) return undefined;
    if (!active) { setStatus('paused'); return undefined; }
    const gen = ++generation.current;
    setStatus('rendering');
    // Every change after the first build has STARTED waits for a pause in typing — not only once a
    // build has succeeded: a cold open (fonts and template still loading) or a failed build would
    // otherwise start one full build per keystroke (R2-017). At once: the first build, a Retry, and
    // a preview just shown (nobody is typing into it).
    const retried = last && last.retry !== retry;
    const delay = last && !revealed && !retried ? DEBOUNCE_MS : 0;
    const timer = setTimeout(async () => {
      built.current = { input, render, retry };
      try {
        const [blob, pdfjs] = await Promise.all([render(input), loadPdfjs()]);
        if (gen < shownGen.current) return;
        const data = new Uint8Array(await blob.arrayBuffer());
        const pdf = await pdfjs.lib.getDocument({ data, worker: pdfjs.worker, isEvalSupported: false }).promise;
        const pages = [];
        for (let i = 1; i <= pdf.numPages; i += 1) {
          const page = await pdf.getPage(i);
          const [, , width, height] = page.view;
          pages.push({ page, width, height, text: pageText(await page.getTextContent()) });
        }
        const width = widthRef.current;
        const painted = await paint(pages, width);
        if (gen < shownGen.current) { release(pdf); return; }
        release(docRef.current);
        docRef.current = pdf;
        shownGen.current = gen;
        setView({ pages, painted, cssWidth: width });
        // Older than the latest change: its pages go up, but the latest build still owns the status.
        if (gen !== generation.current) return;
        setError(null);
        setStatus('ready');
      } catch (e) {
        if (gen !== generation.current) return;
        console.error('Preview render failed:', e);
        setError(e);
        setStatus('error');
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [input, render, retry, active]);

  // Repaint the current document when the zoom (or the column's width) changes — not while hidden,
  // where the column measures 0 and the pages would be painted at the 240 px floor for nobody.
  useEffect(() => {
    if (!active || !view || view.cssWidth === cssWidth) return undefined;
    let cancelled = false;
    paint(view.pages, cssWidth).then((painted) => {
      if (!cancelled) setView((v) => (v && v.pages === view.pages ? { ...v, painted, cssWidth } : v));
    }).catch(() => { /* the next render repaints */ });
    return () => { cancelled = true; };
  }, [active, cssWidth, view]);

  useEffect(() => () => { release(docRef.current); }, []);

  // Track the scroll column's width so the page always fits it at 100 %.
  useLayoutEffect(() => {
    const host = rootRef.current?.parentElement;
    if (!host) return undefined;
    const measure = () => setAvailable(host.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  const count = view?.pages.length || 0;

  return (
    <div
      ref={rootRef}
      className="w-full flex flex-col gap-6 shrink-0"
      data-preview-status={status}
      data-preview-pages={count}
    >
      {status === 'error' && (
        <div role="alert" className="mx-auto max-w-md text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
          <span className="flex-1">Preview failed to render{error?.message ? ` (${error.message})` : ''}.</span>
          <button onClick={() => setRetry((n) => n + 1)} className="font-semibold hover:text-red-900">Retry</button>
        </div>
      )}

      {!view && status !== 'error' && (
        <div
          className="mx-auto bg-white shadow-2xl shrink-0 flex items-center justify-center text-xs text-gray-400"
          style={{ width: cssWidth, height: Math.round(cssWidth * box.ratio) }}
        >
          Rendering preview…
        </div>
      )}

      {view && (
        <div className={`flex flex-col gap-6 transition-opacity ${status === 'rendering' ? 'opacity-90' : ''}`}>
          {view.painted.map((p, i) => (
            <PageCanvas
              key={i}
              canvas={p.canvas}
              width={view.cssWidth}
              height={p.cssHeight}
              label={`${title} page ${i + 1} of ${count}`}
            />
          ))}
        </div>
      )}

      {status === 'rendering' && view && (
        <span className="fixed bottom-4 right-4 text-[11px] text-gray-500 bg-white/90 border border-gray-200 rounded-full px-3 py-1 shadow-sm">
          Updating preview…
        </span>
      )}

      <div id={textId} className="sr-only">
        {view?.pages.map((p, i) => (
          <section key={i} aria-label={`${title} page ${i + 1}`}>{p.text}</section>
        ))}
      </div>
    </div>
  );
}
