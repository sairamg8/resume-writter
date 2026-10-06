import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { previewBox } from '@/constants/pageSize';
import { facesBorrowed, fontFallback, onFaceFetched } from '@/utils/fontFallback';
import { imageRetryPending } from '@/utils/printableImage';
import { loadPdfjs, setPdfjsForTest } from '@/utils/pdfjsLoader';

/**
 * The editor preview IS the exported PDF: `render(input)` builds the same react-pdf document
 * that Export PDF downloads, and pdf.js paints its pages. One renderer, so preview and PDF
 * cannot drift apart.
 *
 * - Re-renders `DEBOUNCE_MS` after the last change to `input` — also before the first page
 *   appears and after a failed build; the previous pages stay on screen (double-buffered) until
 *   the new ones are painted, so typing never flashes blank. Typing that never pauses that long
 *   still re-renders, `MAX_WAIT_MS` after the first change no build has taken up.
 * - One build at a time: while one is on its way, the next — always the latest change's — waits
 *   for it and starts the moment it finishes, whatever pauses in typing came meanwhile. A build
 *   started per pause queued every stale version behind the running one in the PDF worker, which
 *   laid each of them out in turn: a 9-page résumé's preview lagged 10-20 s behind typing that
 *   paused every few keys (R2-142).
 * - A finished render is shown when it is newer than the pages on screen, even while a newer
 *   change is still waiting (steady typing would otherwise freeze the preview). Builds never
 *   overlap, so one cannot finish after a newer one is up; the guard that would drop it is defensive.
 * - `active` false (the column is hidden: "Editor only", or a phone's Edit tab) builds and paints
 *   nothing: the preview only notes it is behind (status 'paused') and builds once, with the latest
 *   input, when it is shown again. Shown again with nothing changed, it keeps what it has.
 * - Page text goes into a visually hidden element (`textId`) for screen readers and tests. It is read
 *   AFTER the pages are painted and on screen (pdf.js' getTextContent shares the worker with the
 *   paint, so asking first held the first paint back, R2-142 / PERF-5); the status turns 'ready'
 *   once it is in, so a reader of that element after 'ready' finds it filled.
 * - Canvases are reused (a pool per preview, filled by the ones that left the screen), not created
 *   per page per render; the pool keeps elements, never pixels (R2-170), and is dropped on unmount.
 * - Every call to pdf.js has a budget (R2-142, the twin of the PDF worker's watchdog in pdfBuild.js, PERF-6):
 *   one that never settles (its worker died or hung, a chunk that never loads) held a build for good, and
 *   with it the one-build-at-a-time slot, so the preview stayed on "Rendering preview…". A stage of a build
 *   (loading pdf.js, opening the PDF, reading its pages, painting them) that outstays its budget fails the
 *   build the way any other failure does — the alert, Retry, the next change builds — and whatever pdf.js
 *   settles late reaches nobody. The pages' text, read after they are up, is let go the same way: those
 *   pages' text is empty and the status is 'ready', as for a page whose text cannot be read.
 */

const GUTTER_PX = 48;    // breathing room either side of the page
const DEBOUNCE_MS = 350;
// Steady typing (a key every few hundred ms) never leaves a DEBOUNCE_MS pause: without a cap the
// preview stayed frozen until typing stopped (R2-142).
const MAX_WAIT_MS = 1200;

// What a stage of pdf.js work gets before the build is given up on (pdfjsTimeoutMs adds to it).
const PDFJS_TIMEOUT_MS = 20_000;
const PER_PAGE_MS = 1_000;  // more for every page, so a long résumé painted on a slow phone is not cut off
const MAX_PAGES = 100;      // the most pages counted
// A timer that rings this long after its time was not run because the page itself was asleep (a tab the
// browser froze in the background, a phone that put the browser away) and pdf.js' worker slept with it:
// its silence says nothing, so the stage gets its budget again from now (as pdfBuild.js does).
const ASLEEP_MS = 5_000;

/**
 * How long a stage of pdf.js work on a document of `pages` pages gets: PDFJS_TIMEOUT_MS and PER_PAGE_MS for
 * each page; twice the base while `cold` (before a document has opened in this session, when the library
 * and its worker are still loading over the network).
 */
export function pdfjsTimeoutMs(pages = 0, cold = false) {
  return (cold ? 2 : 1) * PDFJS_TIMEOUT_MS + Math.min(Math.max(pages, 0), MAX_PAGES) * PER_PAGE_MS;
}

const realClock = {
  set: (fn, ms) => { const t = setTimeout(fn, ms); t?.unref?.(); return t; },
  clear: (t) => clearTimeout(t),
  now: () => globalThis.performance?.now?.() ?? Date.now(),
};
let clock = realClock;
let proven = false; // a document has opened: from then on the library and its worker are loaded

/** For tests/pdf/174-*: `{ set(fn, ms) → handle, clear(handle), now() → ms }` stands in for the watchdog's timers; null goes back to the real ones. */
export function _setPreviewClockForTest(next) {
  clock = next || realClock;
  proven = false;
}

const tookTooLong = () => Object.assign(new Error('The preview took too long to draw'), { code: 'PREVIEW_TIMEOUT' });

/**
 * The clock on one run of pdf.js calls (a build's, a repaint's, a text read's). `stage(ms)` starts the
 * budget of the stage under way in place of the last one: a stage that answered in time restarts it for
 * the next. `race(promise)` is the promise, or a rejection once a stage outstays its budget; the call
 * itself cannot be stopped from here, and what it settles late is dropped. `stop()` ends the clock.
 */
function pdfjsWatch() {
  const ring = clock; // the clock this run started on, whatever a test sets meanwhile
  let timer = null;
  let expire = null;
  const expired = new Promise((_, reject) => { expire = reject; });
  expired.catch(() => {}); // a timeout nothing was waiting for is no unhandled rejection
  const watch = {
    timedOut: false,
    stage(ms) {
      watch.stop();
      if (watch.timedOut) return;
      const due = ring.now() + ms;
      timer = ring.set(() => {
        timer = null;
        if (ring.now() - due >= ASLEEP_MS) { watch.stage(ms); return; }
        watch.timedOut = true;
        expire(tookTooLong());
      }, ms);
    },
    stop() {
      if (timer !== null) ring.clear(timer);
      timer = null;
    },
    race: (promise) => Promise.race([promise, expired]),
  };
  return watch;
}

/** pdf.js loaded, or a rejection when that outlasts its budget (a chunk that never arrives). */
function loadPdfjsInTime() {
  const watch = pdfjsWatch();
  watch.stage(pdfjsTimeoutMs(0, !proven));
  return watch.race(loadPdfjs()).finally(() => watch.stop());
}

/** Free a pdf.js document (PDFDocumentProxy has no destroy(); its loading task does). */
const release = (pdf) => { pdf?.loadingTask?.destroy(); };

/**
 * A loading task whose document never came in time: destroyed, and a document it still delivers is
 * let go (pdf.js rejects a destroyed task's promise, but nothing here relies on that).
 */
function abandon(task) {
  if (!task) return;
  try { Promise.resolve(task.destroy?.()).catch(() => {}); } catch { /* already gone */ }
  task.promise?.then(release, () => {});
}

/**
 * Free canvases' pixels now rather than when the garbage collector gets to them: iOS Safari caps
 * a page's total canvas memory and fails the next paint past it (R2-170).
 */
const discard = (canvases) => { for (const c of canvases) { c.width = 0; c.height = 0; } };

// Idle canvases a preview keeps (0×0, so no pixels) to paint into again: about twice a long résumé's
// pages, since the pages on screen stay up while the next ones paint. Past it, one is let go.
const POOL_MAX = 8;

function newCanvas() {
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  return canvas;
}

/** For tests/pdf/90-preview-*: a stand-in `{ lib, worker }` for pdf.js, or null to load the real one again. */
export const _setPdfjsForTest = setPdfjsForTest;

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

/**
 * Paint every page into a canvas from `take()` at `cssWidth` (device-pixel sharp); `give(canvases)`
 * takes back the ones of a paint that failed. A failed paint waits for the other pages' paints to
 * end first: a canvas given back while pdf.js still draws into it would be painted into by the
 * next render as well. A paint that outstays its budget (`watch`, pdfjsWatch) is cancelled instead,
 * and its canvases are let go for good, never given back: pooled, one would be drawn into by a
 * paint that comes in late and by the next render at once.
 */
async function paint(pages, cssWidth, take, give, watch) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const canvases = [];
  const tasks = [];
  const drawn = Promise.allSettled(pages.map(async ({ page, width, height }) => {
    const scale = (cssWidth * dpr) / width;
    const viewport = page.getViewport({ scale });
    const canvas = take();
    canvases.push(canvas);
    // Sizing resets a reused canvas' context; pdf.js fills the page's white itself.
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const task = page.render({ canvasContext: canvas.getContext('2d'), viewport, canvas });
    tasks.push(task);
    await task.promise;
    return { canvas, cssHeight: (cssWidth * height) / width };
  }));
  let settled;
  try {
    settled = await watch.race(drawn);
  } catch (e) {
    for (const task of tasks) { try { task.cancel?.(); } catch { /* over already */ } }
    discard(canvases);
    throw e;
  }
  const failed = settled.find((s) => s.status === 'rejected');
  if (failed) { give(canvases); throw failed.reason; }
  return settled.map((s) => s.value);
}

/**
 * Reading-order text of every page, read after the paint. Never throws: the pages are on screen
 * already, so a page whose text cannot be read (its document was let go for a newer one, or pdf.js
 * did not answer within `watch`'s budget) is empty.
 */
async function pagesText(pages, watch) {
  return Promise.all(pages.map(async ({ page }) => {
    try { return pageText(await watch.race(page.getTextContent())); } catch { return ''; }
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
  const [view, setView] = useState(null); // { pages, painted: [{ canvas, cssHeight }], cssWidth, gen }
  const [texts, setTexts] = useState(null); // { gen, list }: the text of the pages of view `gen`, read after they were painted
  const [status, setStatusState] = useState(active ? 'rendering' : 'paused');
  // The status last set. A change of `input` asks for 'rendering' on every keystroke. React skips setting a
  // state to the value it holds only when the component has no update waiting on either copy of its fiber,
  // and in a burst of keys - no time to render between them - it has one each time (the last set): 50 keys
  // and React gave up with error #185 and dropped the next one (R2-142). Only a change is asked for.
  const statusAsked = useRef(active ? 'rendering' : 'paused');
  function setStatus(next) {
    if (statusAsked.current === next) return;
    statusAsked.current = next;
    setStatusState(next);
  }
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0); // bumped by every change that asks for a build
  const shownGen = useRef(0);   // the generation of the pages on screen
  const built = useRef(null); // { input, render, retry, gen } of the last build that started
  const ended = useRef(null);   // { gen, status, error }: how the last build to end did ('ready' once its text is in, or 'error')
  const waiting = useRef(null); // when the first change no build has taken up yet arrived
  const building = useRef(0);   // builds started and not finished: never more than one
  const queued = useRef(null);  // the latest change's build, waiting for the one on its way to finish
  const wasActive = useRef(active);
  const docRef = useRef(null);
  const mounted = useRef(true);
  const rootRef = useRef(null);
  const onScreen = useRef([]); // the canvases of the pages on screen
  const pool = useRef([]);      // idle canvases (0×0), painted into again by the next render
  const handed = useRef(null);  // the last view given to setView: on screen, or about to be
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
    if (last && last.input === input && last.render === render && last.retry === retry) {
      waiting.current = null;
      // Back to what the last build was asked for: a change undone before its own build started (an Undo
      // that puts back that very résumé object: inputs match by reference, so a value typed back, a new
      // object, builds again), or made while hidden and undone. That build speaks for the status again —
      // how it ended, or, still on its way, 'rendering' until it does. It was left on 'rendering' (or
      // 'paused') for good, the "Updating preview…" chip up over pages that were current; a change that
      // waits for a running build (one build at a time) widened that window to the whole build.
      if (generation.current !== last.gen) {
        generation.current = last.gen;
        const done = ended.current?.gen === last.gen ? ended.current : null;
        setError(done?.error ?? null);
        setStatus(done ? done.status : 'rendering');
      }
      return undefined;
    }
    // Hidden: build nothing, only note the preview is behind. The change is a generation of its own, so a
    // build still on its way, when it ends, neither reports 'ready' over 'paused' nor shows its error.
    if (!active) { waiting.current = null; generation.current += 1; setStatus('paused'); return undefined; }
    const gen = ++generation.current;
    setStatus('rendering');
    // Every change after the first build has STARTED waits for a pause in typing — not only once a
    // build has succeeded: a cold open (fonts and template still loading) or a failed build would
    // otherwise start one full build per keystroke (R2-017). At once: the first build, a Retry, and
    // a preview just shown (nobody is typing into it).
    // Typing that goes on with no pause is built MAX_WAIT_MS after its first change — unless a build
    // is still on its way: its pages go up first, and the change after it starts the next (below), so
    // a build slower than MAX_WAIT_MS never piles up more of them.
    const now = Date.now();
    if (waiting.current === null) waiting.current = now;
    const due = building.current ? DEBOUNCE_MS : Math.max(0, waiting.current + MAX_WAIT_MS - now);
    const retried = last && last.retry !== retry;
    const delay = last && !revealed && !retried ? Math.min(DEBOUNCE_MS, due) : 0;
    const run = async () => {
      waiting.current = null;
      building.current += 1;
      built.current = { input, render, retry, gen };
      let pdf = null;
      let task = null;
      // The budget of what pdf.js is asked for below (the PDF's own build is pdfBuild.js's: its watchdog).
      const watch = pdfjsWatch();
      // Unmounted meanwhile (Cover Letter clicked mid-render). `gen < shownGen` is defensive: builds run one at a time.
      const unwanted = () => !mounted.current || gen < shownGen.current;
      try {
        const [blob, pdfjs] = await Promise.all([render(input), loadPdfjsInTime()]);
        if (unwanted()) return;
        const data = new Uint8Array(await blob.arrayBuffer());
        watch.stage(pdfjsTimeoutMs(0, !proven));
        task = pdfjs.lib.getDocument({ data, worker: pdfjs.worker, isEvalSupported: false });
        pdf = await watch.race(task.promise);
        proven = true;
        watch.stage(pdfjsTimeoutMs(pdf.numPages));
        const pages = await watch.race(Promise.all(Array.from({ length: pdf.numPages }, async (_, i) => {
          const page = await pdf.getPage(i + 1);
          const [, , width, height] = page.view;
          return { page, width, height };
        })));
        const width = widthRef.current;
        watch.stage(pdfjsTimeoutMs(pdf.numPages));
        const painted = await paint(pages, width, take, give, watch);
        if (unwanted()) { release(pdf); give(painted.map((p) => p.canvas)); return; }
        release(docRef.current);
        docRef.current = pdf;
        shownGen.current = gen;
        show({ pages, painted, cssWidth: width, gen });
        // The pages are up: only now is their text asked for (not awaited: the build is over).
        readText(pages, gen);
      } catch (e) {
        // Opened, then a page or the paint failed: nothing else holds it. Never opened (it failed, or
        // outstayed its budget): its loading task is let go, and a document it delivers late with it.
        if (pdf) release(pdf); else abandon(task);
        if (!mounted.current) return;
        ended.current = { gen, status: 'error', error: e };
        if (gen !== generation.current) return;
        console.error('Preview render failed:', e);
        setError(e);
        setStatus('error');
      } finally {
        watch.stop();
        building.current -= 1;
        // The change that waited for this build, if any (the latest one's: a newer change took the place
        // of an older): it builds now, from the input it has, while this build's page text may still be
        // read (readText drops it if the next pages go up first). Its pages go up over this build's.
        const next = queued.current;
        queued.current = null;
        next?.();
      }
    };
    const timer = setTimeout(() => {
      // One build at a time. A pause in typing while one is on its way used to start another at once:
      // the PDF worker runs them in turn, so each stale version of a long résumé was laid out before the
      // latest, and the preview trailed the typing by the sum of them (R2-142). The change waits instead;
      // a newer change, and the effect's cleanup, replace or drop it.
      if (building.current) queued.current = run;
      else run();
    }, delay);
    return () => {
      clearTimeout(timer);
      if (queued.current === run) queued.current = null;
    };
  }, [input, render, retry, active]);

  // Back online while the pages print in Noto Sans for a font that could not be loaded, in another
  // face for one of its faces that failed, or with no photo for one whose fetch failed: build again,
  // now with that font (R2-146), face (R4-LO-17) or photo (R4-LO-18). A build that needs nothing
  // from the web is left alone.
  useEffect(() => {
    const again = () => { if (fontFallback() || facesBorrowed() || imageRetryPending()) setRetry((n) => n + 1); };
    window.addEventListener('online', again);
    return () => window.removeEventListener('online', again);
  }, []);

  // A font face that failed arrived after the build that fetched it again stopped waiting for it:
  // build again, so it prints in its own face now rather than on the next edit (R4-LO-17).
  useEffect(() => onFaceFetched(() => setRetry((n) => n + 1)), []);

  // Repaint the current document when the zoom (or the column's width) changes — not while hidden,
  // where the column measures 0 and the pages would be painted at the 240 px floor for nobody.
  useEffect(() => {
    if (!active || !view || view.cssWidth === cssWidth) return undefined;
    let cancelled = false;
    const watch = pdfjsWatch();
    watch.stage(pdfjsTimeoutMs(view.pages.length));
    paint(view.pages, cssWidth, take, give, watch).then((painted) => {
      // Cancelled, or a newer render's pages were handed over while this painted: never shown.
      if (cancelled || handed.current !== view) give(painted.map((p) => p.canvas));
      else show({ ...view, painted, cssWidth });
    }).catch(() => { /* the next render repaints */ }).finally(() => watch.stop());
    return () => { cancelled = true; };
  }, [active, cssWidth, view]);

  // A canvas to paint into: an idle one from the pool, else a new one.
  function take() {
    return pool.current.pop() ?? newCanvas();
  }

  // Canvases that left the screen or never reached it: their pixels are freed at once (R2-170) and
  // the elements wait in the pool for the next render (PERF-5). An unmounted preview keeps none.
  function give(canvases) {
    discard(canvases);
    if (!mounted.current) return;
    for (const c of canvases) if (pool.current.length < POOL_MAX && !pool.current.includes(c)) pool.current.push(c);
  }

  // Put `next` up. A view handed over before it but not on screen yet (a zoom repaint the same moment
  // as a render) never will be: free its canvases.
  function show(next) {
    const unshown = handed.current && handed.current !== next ? handed.current.painted.map((p) => p.canvas) : [];
    give(unshown.filter((c) => !onScreen.current.includes(c)));
    handed.current = next;
    setView(next);
  }

  // The text of the pages of build `gen`, asked for once they are painted and on screen. Its status
  // is 'ready' when it is in; dropped when newer pages went up meanwhile (their document is gone).
  async function readText(pages, gen) {
    const watch = pdfjsWatch();
    watch.stage(pdfjsTimeoutMs(pages.length));
    const list = await pagesText(pages, watch).finally(() => watch.stop());
    if (!mounted.current || shownGen.current !== gen) return;
    setTexts({ gen, list });
    // Not over the record of a build that started after these pages went up and ended while the text was
    // still being read (it failed): an undo back to that build's input must find its error, not nothing,
    // and the status was left on 'rendering' with no build running.
    if (!(ended.current?.gen > gen)) ended.current = { gen, status: 'ready', error: null };
    // Older than the latest change: its pages are up, but the latest build still owns the status.
    if (gen !== generation.current) return;
    setError(null);
    setStatus('ready');
  }

  // Pages replaced (a newer render, a zoom repaint): free the canvases that left the screen. A
  // layout effect, so it runs after PageCanvas has put the new ones up and before the browser paints.
  useLayoutEffect(() => {
    const next = view ? view.painted.map((p) => p.canvas) : [];
    give(onScreen.current.filter((c) => !next.includes(c)));
    onScreen.current = next;
  }, [view]);

  useEffect(() => {
    mounted.current = true; // again after StrictMode's trial unmount
    return () => {
      mounted.current = false;
      release(docRef.current);
      docRef.current = null;
      discard(onScreen.current);
      onScreen.current = [];
      pool.current = []; // the idle canvases go with the preview
    };
  }, []);

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
        <div role="alert" data-testid="preview-error" className="cv-notice-bad mx-auto max-w-md text-xs px-3 py-2 flex items-start gap-2">
          <span className="flex-1 min-w-0 break-words">Preview failed to render{error?.message ? ` (${error.message})` : ''}.</span>
          <button onClick={() => setRetry((n) => n + 1)} className="font-semibold underline underline-offset-2">Retry</button>
        </div>
      )}

      {!view && status !== 'error' && (
        <div
          data-testid="preview-placeholder"
          className="mx-auto bg-white shadow-2xl shrink-0 flex items-center justify-center text-xs text-cv-faint"
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

      {/* Below md it rides above the editor's Edit | Preview pill, which sits at the same bottom-4
          and hid the chip's start (R4-DPH-40); with a dock open it moves left of the dock (index.css). */}
      {status === 'rendering' && view && (
        <span data-testid="preview-updating" className="cv-preview-chip fixed bottom-4 max-md:bottom-16 right-4 text-[11px] text-cv-muted bg-cv-surface/90 border border-cv-hairline rounded-cv-chip px-3 py-1">
          Updating preview…
        </span>
      )}

      <div id={textId} className="sr-only">
        {view?.pages.map((p, i) => (
          <section key={i} aria-label={`${title} page ${i + 1}`}>{texts?.gen === view.gen ? texts.list[i] : ''}</section>
        ))}
      </div>
    </div>
  );
}
