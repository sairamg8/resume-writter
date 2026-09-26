// What the parity matrix measures in a rendered PDF, read in ONE pass per document (the matrix renders
// hundreds): every page's text runs (as harness.read gives them), what it paints (paths, rules, images,
// with their colour and box — extractors.painted, for every page), the colours it sets, and its
// drawing — every operator with its arguments, document-neutral — so two PDFs that draw the same
// pages compare equal and any visible change compares different.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const times = (t, m) => [
  t[0] * m[0] + t[1] * m[2], t[0] * m[1] + t[1] * m[3], t[2] * m[0] + t[3] * m[2],
  t[2] * m[1] + t[3] * m[3], t[4] * m[0] + t[5] * m[2] + m[4], t[4] * m[1] + t[5] * m[3] + m[5],
];
const neutral = (_, v) => (typeof v === 'number' ? Math.round(v * 100) / 100
  : typeof v === 'string' ? v.replace(/_d\d+_/g, '_d_') : v);

/**
 * What an image op paints, read from its decoded pixels: { digest, grey }. The op itself names the
 * image only by its object id and size, so a greyscale photo and a colour one drew "the same PDF"
 * (R2-147); the digest — a hash of the pixels, sampled to at most ~64k of them — tells them apart, and
 * `grey` says every sampled pixel has R = G = B (within 2, for a JPEG's rounding). Document-neutral: the
 * pixels, not where the PDF keeps them. pdf.js decodes an image after the operator list that paints it
 * is done, so this waits for it (5 s at most); undefined when it never comes.
 */
async function pixelsOf(page, op, args) {
  let img = op === pdfjs.OPS.paintInlineImageXObject ? args[0] : null;
  if (!img) {
    const id = args[0];
    const objs = typeof id === 'string' && id.startsWith('g_') ? page.commonObjs : page.objs;
    let timer;
    img = await Promise.race([
      new Promise((resolve) => { objs.get(id, resolve); }),
      new Promise((resolve) => { timer = setTimeout(resolve, 5000, null); }),
    ]).finally(() => clearTimeout(timer));
  }
  const data = img?.data;
  if (!data?.length) return undefined;
  const K = pdfjs.ImageKind;
  const step = img.kind === K.RGBA_32BPP ? 4 : img.kind === K.RGB_24BPP ? 3 : 0;
  let h = 2166136261;
  const every = Math.max(1, Math.ceil(data.length / (step || 1) / 65536));
  let grey = true;
  if (!step) {
    for (let i = 0; i < data.length; i += every) h = Math.imul(h ^ data[i], 16777619) >>> 0;
  } else {
    for (let i = 0; i + step <= data.length; i += step * every) {
      for (let c = 0; c < step; c += 1) h = Math.imul(h ^ data[i + c], 16777619) >>> 0;
      if (Math.abs(data[i] - data[i + 1]) > 2 || Math.abs(data[i + 1] - data[i + 2]) > 2) grey = false;
    }
  }
  return { digest: `${img.kind}:${img.width}x${img.height}:${h.toString(16)}`, grey };
}

/** One page's painted paths and images (extractors.painted's reading, for any page); `pixels(k)`: image op k's pixelsOf. */
function paintedOf({ fnArray, argsArray }, page, pixels = () => undefined) {
  const O = pdfjs.OPS;
  const out = [];
  const stack = [];
  let g = { m: [1, 0, 0, 1, 0, 0], fill: '#000000', stroke: '#000000', lw: 1 };
  let clipping = false;
  const box = ([x0, y0, x1, y1], m) => {
    const xs = [x0 * m[0] + y0 * m[2] + m[4], x1 * m[0] + y1 * m[2] + m[4]];
    const ys = [x0 * m[1] + y0 * m[3] + m[5], x1 * m[1] + y1 * m[3] + m[5]];
    return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  };
  fnArray.forEach((fn, k) => {
    const a = argsArray[k];
    if (fn === O.save) stack.push(g);
    else if (fn === O.restore) g = stack.pop() || g;
    else if (fn === O.transform) g = { ...g, m: times(a, g.m) };
    else if (fn === O.setFillRGBColor) g = { ...g, fill: a[0] };
    else if (fn === O.setStrokeRGBColor) g = { ...g, stroke: a[0] };
    else if (fn === O.setLineWidth) g = { ...g, lw: a[0] };
    else if (fn === O.clip || fn === O.eoClip) clipping = true;
    else if (fn === O.constructPath) {
      if (clipping) { clipping = false; out.push({ page, paint: 'clip', ...box(a[2], g.m) }); return; }
      const stroke = a[0] === O.stroke;
      out.push({ page, paint: stroke ? 'stroke' : 'fill', colour: stroke ? g.stroke : g.fill, width: stroke ? g.lw / 2 : 0, ...box(a[2], g.m) });
    } else if (fn === O.paintImageXObject || fn === O.paintInlineImageXObject) out.push({ page, paint: 'image', ...box([0, 0, 1, 1], g.m), ...pixels(k) });
  });
  return out;
}

/**
 * The document, measured: { pages: [{ W, H, items }], drawing, paint, colours, text }. items as
 * harness.read gives them ({ str, x, y, w, h, font }, y the baseline from the page bottom, pt). An
 * image's paint carries { digest, grey } (pixelsOf), and its op in the drawing its digest.
 */
export async function snapshot(bytes) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  const O = pdfjs.OPS;
  const pages = [];
  const drawing = [];
  const paint = [];
  const colours = new Set();
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const [, , W, H] = page.view;
    const ops = await page.getOperatorList();
    const fontName = (id) => { try { return page.commonObjs.get(id)?.name || id; } catch { return id; } };
    const tc = await page.getTextContent();
    const items = tc.items.filter((it) => typeof it.str === 'string' && it.str.trim()).map((it) => ({
      str: it.str, x: it.transform[4], y: it.transform[5], w: it.width,
      h: it.height || Math.abs(it.transform[3]), font: fontName(it.fontName).replace(/^[A-Z]{6}\+/, ''), page: i,
    }));
    pages.push({ W, H, items });
    const isImage = (fn) => fn === O.paintImageXObject || fn === O.paintInlineImageXObject;
    const pixels = new Map((await Promise.all(ops.fnArray.map(async (fn, k) => [k, isImage(fn) ? await pixelsOf(page, fn, ops.argsArray[k]) : undefined]))).filter(([, v]) => v));
    drawing.push(`page ${i} ${W}x${H}`, ...ops.fnArray.map((fn, k) => (isImage(fn)
      ? `${fn} ${fn === O.paintInlineImageXObject ? '' : JSON.stringify(ops.argsArray[k], neutral)} ${pixels.get(k)?.digest ?? 'unread'}`
      : `${fn} ${JSON.stringify(ops.argsArray[k], neutral)}`)));
    ops.fnArray.forEach((fn, k) => { if (fn === O.setFillRGBColor || fn === O.setStrokeRGBColor) colours.add(ops.argsArray[k][0]); });
    paint.push(...paintedOf(ops, i, (k) => pixels.get(k)));
  }
  await doc.loadingTask.destroy();
  const text = pages.map((p) => p.items.map((t) => t.str).join(' ')).join(' ').replace(/\s+/g, ' ');
  return { pages, drawing: drawing.join('\n'), paint, colours, text };
}

/**
 * The runs of the résumé's own text: each page after the first without its running header ("Name · Page 2",
 * ATS-7) — the page's first line drawn, when it ends "Page N". Page furniture in the top margin, not a
 * section's text: the section measures read around it.
 */
export const ownRuns = (snap) => snap.pages.flatMap((p, i) => {
  if (!i || !p.items.length) return p.items;
  const line = p.items.filter((t) => Math.abs(t.y - p.items[0].y) < 0.5);
  const header = new RegExp(`(^|\\s)Page ${i + 1}$`).test(line.map((t) => t.str).join(' ').replace(/\s+/g, ' ').trim());
  return header ? p.items.filter((t) => !line.includes(t)) : p.items;
});

/** The first run containing `mark` (null when none prints). */
export const item = (snap, mark) => snap.pages.flatMap((p) => p.items).find((t) => t.str.includes(mark)) || null;

/** Every run containing `mark`. */
export const items = (snap, mark) => snap.pages.flatMap((p) => p.items).filter((t) => t.str.includes(mark));

/** How far down the document a run sits: pages before it, then its depth on its page (pt). */
export function flow(snap, run) {
  if (!run) return null;
  const H = snap.pages[run.page - 1].H;
  return (run.page - 1) * H + (H - run.y);
}

/**
 * Does the document print `mark`, ignoring case and line breaks? A right-to-left paragraph's closing
 * punctuation prints at the left end of its last line (UAX #9), where pdf.js reads it in front of that
 * line's first word ('.engineer'): punctuation standing before a word is set aside for a second look.
 */
const LEADING_PUNCT = /(^|\s)[.,;:!?؟،]+\s*(?=[^\s.,;:!?؟،])/gu;
export const prints = (snap, mark) => {
  const want = mark.toLowerCase().replace(/\s+/g, ' ');
  const text = snap.text.toLowerCase();
  return text.includes(want) || text.replace(LEADING_PUNCT, '$1').includes(want);
};

/** Pairs of different text runs whose boxes overlap, on any page (harness.overlaps' rule). */
export function overlapping(snap) {
  const out = [];
  for (const page of snap.pages) {
    const it = page.items;
    for (let a = 0; a < it.length; a += 1) {
      for (let b = a + 1; b < it.length; b += 1) {
        const A = it[a];
        const B = it[b];
        const yOverlap = Math.min(A.y + A.h * 0.75, B.y + B.h * 0.75) - Math.max(A.y, B.y);
        const xOverlap = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
        if (yOverlap > Math.min(A.h, B.h) * 0.3 && xOverlap > 2) out.push(`p${page.items[a].page}: "${A.str}" × "${B.str}"`);
      }
    }
  }
  return out;
}

/** The fill colour each drawn string containing `needle` is painted in (harness.drawState's reading). */
export async function fillsOf(bytes, needle) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  const O = pdfjs.OPS;
  const hits = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const ops = await (await doc.getPage(i)).getOperatorList();
    let fill = '#000000';
    ops.fnArray.forEach((fn, k) => {
      const a = ops.argsArray[k];
      if (fn === O.setFillRGBColor) fill = a[0];
      if (fn === O.showText && a[0].map((g) => (g && typeof g === 'object' ? g.unicode : '')).join('').includes(needle)) hits.push(fill);
    });
  }
  await doc.loadingTask.destroy();
  return hits;
}
