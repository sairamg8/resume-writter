/**
 * Node PDF test harness. Renders résumés with the app's own react-pdf code — loaded through
 * Vite's SSR module loader, so `@/` aliases and JSX work unchanged — and reads the PDFs back
 * with pdf.js. No browser and no dev-server port: Vite runs in middleware mode, and the only
 * socket is an ephemeral in-process server for the font files react-pdf fetches.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const TEMPLATES = ['classic', 'modern', 'minimal', 'executive', 'sidebar'];
export const MM = 72 / 25.4; // points per millimetre

let ctx = null;
let seq = 0;

/** Serve public/ and @fontsource files — the only URLs the PDF code fetches. */
function serveFonts() {
  const nm = fs.realpathSync(path.join(ROOT, 'node_modules'));
  const allowed = [path.join(ROOT, 'public'), path.join(nm, '@fontsource')];
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file;
    if (url.startsWith('/@fs/')) file = url.slice('/@fs'.length);
    else if (url.startsWith('/node_modules/')) file = path.join(nm, url.slice('/node_modules/'.length));
    else file = path.join(ROOT, 'public', url);
    file = path.resolve(file);
    if (!allowed.some((dir) => file.startsWith(dir + path.sep))) {
      res.writeHead(403);
      res.end();
      return;
    }
    fs.readFile(file, (err, data) => {
      res.writeHead(err ? 404 : 200);
      res.end(err ? undefined : data);
    });
  });
  return new Promise((resolve) => { server.listen(0, '127.0.0.1', () => resolve(server)); });
}

export async function setup() {
  if (ctx) return ctx;
  const fonts = await serveFonts();
  // The font loader turns its URLs absolute with window.location.origin (react-pdf in Node
  // reads a relative URL as a file path). It captures the origin at module load.
  globalThis.window = { location: { origin: `http://127.0.0.1:${fonts.address().port}` } };
  const vite = await createServer({
    root: ROOT,
    configFile: path.join(ROOT, 'vite.config.js'),
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
    logLevel: 'error',
  });
  try {
    const [pdf, data, types] = await Promise.all([
      vite.ssrLoadModule('/src/utils/pdfExportReactPDF.js'),
      vite.ssrLoadModule('/src/utils/defaultData.js'),
      vite.ssrLoadModule('/src/utils/defaultDataSectionTypes.js'),
    ]);
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    ctx = { fonts, vite, pdf, data, types, pdfjs, load: (p) => vite.ssrLoadModule(p) };
  } finally {
    delete globalThis.window;
  }
  return ctx;
}

export async function teardown() {
  if (!ctx) return;
  await ctx.vite.close();
  ctx.fonts.close();
  ctx = null;
}

/** Load any app module (e.g. '/src/utils/wordExport.js') through the same Vite instance. */
export const loadModule = (p) => ctx.load(p);

// ── Test data ────────────────────────────────────────────────────────────────

export function resume({ template = 'classic', settings = {}, personal = {}, sections = [], coverLetter = {} } = {}) {
  const r = ctx.data.createBlankResume({ id: `resume_t${++seq}`, name: 'Test', template });
  r.settings = { ...r.settings, ...settings };
  r.personal = { ...r.personal, name: 'Test Person', title: 'Engineer', ...personal };
  r.sections = sections;
  r.coverLetter = { ...r.coverLetter, ...coverLetter };
  return r;
}

/** A section of `type` built from the app's own defaults, with `items` merged over the blank item. */
export function section(type, items = [], settings = {}, extra = {}) {
  const base = ctx.types.SECTION_TYPE_DEFAULTS[type](`${type}_t${++seq}`);
  const blank = base.items[0];
  return {
    ...base,
    visible: true,
    ...extra,
    settings: { ...base.settings, ...settings },
    items: items.map((it, i) => ({ ...blank, id: `${base.id}_${i}`, ...it })),
  };
}

/** Experience entries with sensible header fields, so tests only state what they are about. */
export function experience(items, settings = {}) {
  return section('experience', items.map((it, i) => ({
    company: `Company ${i + 1}`, role: `Role ${i + 1}`, location: 'City',
    startDate: '01/2020', endDate: '12/2021', ...it,
  })), settings);
}

// ── Rendering ────────────────────────────────────────────────────────────────

export async function render(r) {
  const blob = await ctx.pdf.renderResumePdf(r);
  return new Uint8Array(await blob.arrayBuffer());
}

export async function renderCover(r, opts) {
  const blob = await ctx.pdf.renderCoverLetterPdf(r, opts);
  return new Uint8Array(await blob.arrayBuffer());
}

// ── Reading ──────────────────────────────────────────────────────────────────

async function open(bytes) {
  return ctx.pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
}

/**
 * Per page: { W, H, items, links, text, strokes, fills }.
 * items: { str, x, y, w, h, font } — y is the baseline measured from the page bottom, in pt;
 * font is the embedded font's PostScript name (e.g. "NotoSans-Bold").
 */
export async function read(bytes) {
  const doc = await open(bytes);
  const O = ctx.pdfjs.OPS;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const [, , W, H] = page.view;
    const ops = await page.getOperatorList(); // also loads the fonts into commonObjs
    const fontName = (id) => {
      try { return page.commonObjs.get(id)?.name || id; } catch { return id; }
    };
    const tc = await page.getTextContent();
    const items = tc.items
      .filter((it) => typeof it.str === 'string' && it.str.trim())
      .map((it) => ({
        str: it.str, x: it.transform[4], y: it.transform[5], w: it.width,
        h: it.height || Math.abs(it.transform[3]), font: fontName(it.fontName),
      }));
    const strokes = new Set();
    const fills = new Set();
    ops.fnArray.forEach((fn, k) => {
      if (fn === O.setStrokeRGBColor) strokes.add(ops.argsArray[k][0]);
      if (fn === O.setFillRGBColor) fills.add(ops.argsArray[k][0]);
    });
    const links = (await page.getAnnotations())
      .filter((a) => a.subtype === 'Link')
      .map((a) => ({ url: a.url || a.unsafeUrl || null, rect: a.rect }));
    pages.push({ W, H, items, links, strokes, fills, text: items.map((t) => t.str).join(' ') });
  }
  await doc.loadingTask.destroy();
  return pages;
}

/** Every text item of every page, in page order. */
export const allItems = (pages) => pages.flatMap((p, i) => p.items.map((t) => ({ ...t, page: i + 1 })));

/** All text of the document, runs joined with single spaces. */
export const allText = (pages) => pages.map((p) => p.text).join(' ');

/** Items whose text contains `needle`. */
export const itemsWith = (pages, needle) => allItems(pages).filter((t) => t.str.includes(needle));

/** For each drawn string containing `needle`: the fill colour and fill alpha in effect. */
export async function drawState(bytes, needle) {
  const doc = await open(bytes);
  const O = ctx.pdfjs.OPS;
  const hits = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const ops = await (await doc.getPage(i)).getOperatorList();
    let fill = '#000000';
    let alpha = 1;
    ops.fnArray.forEach((fn, k) => {
      const a = ops.argsArray[k];
      if (fn === O.setFillRGBColor) fill = a[0];
      if (fn === O.setGState) for (const [key, v] of a[0]) if (key === 'ca') alpha = v;
      if (fn === O.showText) {
        const s = a[0].map((g) => (g && typeof g === 'object' ? g.unicode : '')).join('');
        if (s.includes(needle)) hits.push({ fill, alpha, s });
      }
    });
  }
  await doc.loadingTask.destroy();
  return hits;
}

/** Pairs of different text runs whose boxes overlap — never true of a sound layout. */
export function overlaps(page) {
  const out = [];
  const it = page.items;
  for (let a = 0; a < it.length; a += 1) {
    for (let b = a + 1; b < it.length; b += 1) {
      const A = it[a];
      const B = it[b];
      const yOverlap = Math.min(A.y + A.h * 0.75, B.y + B.h * 0.75) - Math.max(A.y, B.y);
      const xOverlap = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
      if (yOverlap > Math.min(A.h, B.h) * 0.3 && xOverlap > 2) out.push([A.str, B.str]);
    }
  }
  return out;
}
