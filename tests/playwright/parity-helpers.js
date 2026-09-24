// Preview == download, measured in the real browser. The editor's preview IS the PDF (PdfPreview.jsx
// renders the react-pdf blob with pdf.js), so "the canvas matches the download" is two claims, each
// proven here from the running app, not assumed:
//   1. the preview's PDF and the downloaded PDF are the same document — every page draws the same
//      operators (measure.snapshot's document-neutral drawing: react-pdf's random font-subset tags and
//      creation date make the bytes of two renders differ, never what they draw);
//   2. the canvas on screen is that document — page 1 of the DOWNLOADED file, rasterised by the same
//      pdf.js build at the canvas's own size, matches the preview canvas pixel for pixel.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshot } from '../pdf/parity/measure.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const PDFJS = path.join(ROOT, 'node_modules/pdfjs-dist/legacy/build');

/**
 * Before the app loads: keep a copy of every PDF blob the page reads (the preview reads its render with
 * blob.arrayBuffer(); an export hands its blob to a download link and reads none), and serve this
 * checkout's pdf.js at /__parity/pdfjs/ for the pixel comparison.
 */
export async function hookPreviewPdfs(page) {
  await page.addInitScript(() => {
    window.__pdfs = [];
    const read = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = function arrayBuffer() {
      const p = read.call(this);
      if (this.type === 'application/pdf') p.then((buf) => window.__pdfs.push(new Uint8Array(buf.slice(0))));
      return p;
    };
  });
  await page.route('**/__parity/pdfjs/*', (route) => {
    const file = path.join(PDFJS, path.basename(new URL(route.request().url()).pathname));
    return route.fulfill({ path: file, contentType: 'text/javascript' });
  });
}

/** Wait until the preview has painted and nothing re-renders for `quietMs`. */
export async function settledPreview(page, quietMs = 800) {
  await page.waitForSelector('[data-preview-status="ready"] canvas', { timeout: 30_000 });
  let count = -1;
  for (let i = 0; i < 40; i += 1) {
    const now = await page.evaluate(() => [window.__pdfs.length, document.querySelector('[data-preview-status]')?.dataset.previewStatus]);
    if (now[0] === count && now[1] === 'ready') return;
    count = now[0];
    await page.waitForTimeout(quietMs);
  }
  throw new Error('the preview never settled');
}

/** The PDF the preview last rendered, as bytes. */
export async function previewPdf(page) {
  const b64 = await page.evaluate(() => {
    const u8 = window.__pdfs.at(-1);
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return btoa(s);
  });
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

/** Export → Export PDF, the file the browser downloads, as bytes. */
export async function downloadedPdf(page) {
  await page.locator('button:has-text("Export")').first().click();
  const downloading = page.waitForEvent('download', { timeout: 30_000 });
  await page.locator('button:has-text("Export PDF")').click();
  const file = await (await downloading).path();
  return new Uint8Array(fs.readFileSync(file));
}

/** Where two PDFs draw differently: [] when every page draws the same. */
export async function drawingDiff(a, b) {
  const [x, y] = [await snapshot(a), await snapshot(b)];
  if (x.pages.length !== y.pages.length) return [`${x.pages.length} pages vs ${y.pages.length}`];
  if (x.drawing === y.drawing) return [];
  const [l, r] = [x.drawing.split('\n'), y.drawing.split('\n')];
  const at = l.findIndex((line, i) => line !== r[i]);
  return [`they draw differently from operator ${at}: ${l[at]?.slice(0, 120)} vs ${r[at]?.slice(0, 120)}`];
}

/**
 * Page 1 of `bytes`, rasterised in the page by this checkout's pdf.js at the preview canvas's size, against
 * the preview canvas: { width, height, differing } — the pixels whose colour differs by more than 8 in a channel.
 */
export async function canvasVsPdf(page, bytes) {
  return page.evaluate(async (b64) => {
    const lib = await import('/__parity/pdfjs/pdf.mjs');
    lib.GlobalWorkerOptions.workerSrc = '/__parity/pdfjs/pdf.worker.min.mjs'; // the worker the app bundles
    const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const doc = await lib.getDocument({ data, isEvalSupported: false }).promise;
    const pg = await doc.getPage(1);
    const shown = document.querySelector('[data-preview-status="ready"] canvas');
    const viewport = pg.getViewport({ scale: shown.width / pg.view[2] });
    const mine = document.createElement('canvas');
    mine.width = Math.round(viewport.width);
    mine.height = Math.round(viewport.height);
    await pg.render({ canvasContext: mine.getContext('2d'), viewport, canvas: mine }).promise;
    if (mine.width !== shown.width || mine.height !== shown.height) return { width: mine.width, height: mine.height, differing: -1, shown: [shown.width, shown.height] };
    const a = shown.getContext('2d').getImageData(0, 0, shown.width, shown.height).data;
    const b = mine.getContext('2d').getImageData(0, 0, mine.width, mine.height).data;
    let differing = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (Math.abs(a[i] - b[i]) > 8 || Math.abs(a[i + 1] - b[i + 1]) > 8 || Math.abs(a[i + 2] - b[i + 2]) > 8) differing += 1;
    }
    await doc.loadingTask.destroy();
    return { width: mine.width, height: mine.height, differing };
  }, Buffer.from(bytes).toString('base64'));
}

/** A cheap fingerprint of what the preview shows: every page's size and pixels, sampled (a control may move only page 2). */
export async function previewPrint(page) {
  return page.evaluate(() => {
    const canvases = [...document.querySelectorAll('[data-preview-status] canvas')];
    if (!canvases.length) return 'none';
    return canvases.map((c) => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let h = 0;
      for (let i = 0; i < d.length; i += 4 * 7) h = (h * 31 + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) % 2147483647;
      return `${c.width}x${c.height}:${h}`;
    }).join(' ');
  });
}
