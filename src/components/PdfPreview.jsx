import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * The editor preview IS the exported PDF: `render(input)` builds the same react-pdf document
 * that Export PDF downloads, and pdf.js paints its pages. One renderer, so preview and PDF
 * cannot drift apart.
 *
 * - Re-renders `DEBOUNCE_MS` after the last change to `input`; the previous pages stay on
 *   screen (double-buffered) until the new ones are painted, so typing never flashes blank.
 * - A stale render is dropped when a newer one has started.
 * - Page text goes into a visually hidden element (`textId`) for screen readers and tests.
 */

const A4_WIDTH_PX = 794; // 210 mm at 96 dpi — the preview's 100 % width
const DEBOUNCE_MS = 350;

let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    }).catch((e) => { pdfjsPromise = null; throw e; });
  }
  return pdfjsPromise;
}

/** Reading-order text of one page: a space where runs sit apart on a line, a newline between lines. */
function pageText(content) {
  let out = '';
  let prev = null;
  for (const item of content.items) {
    if (typeof item.str !== 'string') continue;
    if (prev && !prev.hasEOL) {
      const sameLine = Math.abs(item.transform[5] - prev.transform[5]) < 1;
      const gap = item.transform[4] - (prev.transform[4] + prev.width);
      if (!sameLine) out += '\n';
      else if (gap > 0.5 && !/\s$/.test(out) && !/^\s/.test(item.str)) out += ' ';
    }
    out += item.str;
    if (item.hasEOL) out += '\n';
    prev = item;
  }
  return out.trim();
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
      className="bg-white shadow-2xl shrink-0"
      style={{ width, height }}
    />
  );
}

export function PdfPreview({ render, input, zoom = 1, textId, title = 'Résumé' }) {
  const [view, setView] = useState(null); // { pages, painted: [{ canvas, cssHeight }], cssWidth }
  const [status, setStatus] = useState('rendering');
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const docRef = useRef(null);
  const cssWidth = Math.round(A4_WIDTH_PX * zoom);
  const widthRef = useRef(cssWidth);
  widthRef.current = cssWidth;

  // Build + paint a new document whenever the input changes.
  useEffect(() => {
    const gen = ++generation.current;
    setStatus('rendering');
    const delay = docRef.current ? DEBOUNCE_MS : 0;
    const timer = setTimeout(async () => {
      try {
        const [blob, pdfjs] = await Promise.all([render(input), loadPdfjs()]);
        if (gen !== generation.current) return;
        const data = new Uint8Array(await blob.arrayBuffer());
        const pdf = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
        const pages = [];
        for (let i = 1; i <= pdf.numPages; i += 1) {
          const page = await pdf.getPage(i);
          const [, , width, height] = page.view;
          pages.push({ page, width, height, text: pageText(await page.getTextContent()) });
        }
        const width = widthRef.current;
        const painted = await paint(pages, width);
        if (gen !== generation.current) { pdf.destroy(); return; }
        docRef.current?.destroy();
        docRef.current = pdf;
        setView({ pages, painted, cssWidth: width });
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
  }, [input, render, retry]);

  // Repaint the current document when the zoom changes.
  useEffect(() => {
    if (!view || view.cssWidth === cssWidth) return;
    let cancelled = false;
    paint(view.pages, cssWidth).then((painted) => {
      if (!cancelled) setView((v) => (v && v.pages === view.pages ? { ...v, painted, cssWidth } : v));
    }).catch(() => { /* the next render repaints */ });
    return () => { cancelled = true; };
  }, [cssWidth, view]);

  useEffect(() => () => { docRef.current?.destroy(); }, []);

  const count = view?.pages.length || 0;

  return (
    <div
      className="flex flex-col items-center gap-6 shrink-0"
      data-preview-status={status}
      data-preview-pages={count}
    >
      {status === 'error' && (
        <div role="alert" className="max-w-md text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
          <span className="flex-1">Preview failed to render{error?.message ? ` (${error.message})` : ''}.</span>
          <button onClick={() => setRetry((n) => n + 1)} className="font-semibold hover:text-red-900">Retry</button>
        </div>
      )}

      {!view && status !== 'error' && (
        <div
          className="bg-white shadow-2xl shrink-0 flex items-center justify-center text-xs text-gray-400"
          style={{ width: cssWidth, height: Math.round(cssWidth * 1.4142) }}
        >
          Rendering preview…
        </div>
      )}

      {view && (
        <div className={`flex flex-col items-center gap-6 transition-opacity ${status === 'rendering' ? 'opacity-90' : ''}`}>
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
