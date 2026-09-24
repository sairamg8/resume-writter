// What a page of the Banner template paints besides text, for its tests (68-banner-*): every page's
// fills and strokes, not only page 1's (extractors.mjs painted() reads page 1) — the band carries on
// as a strip across the top of every later page. pdf.js's operator list, no canvas needed.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

/** The product of two PDF transformation matrices, `t` applied after `m`. */
const times = (t, m) => [
  t[0] * m[0] + t[1] * m[2], t[0] * m[1] + t[1] * m[3],
  t[2] * m[0] + t[3] * m[2], t[2] * m[1] + t[3] * m[3],
  t[4] * m[0] + t[5] * m[2] + m[4], t[4] * m[1] + t[5] * m[3] + m[5],
];

/**
 * Per page, its painted paths in drawing order: { paint: 'fill' | 'stroke', colour, width, x0, y0, x1, y1 }
 * on the page (pt, y up from the page's foot). A stroke's `width` is half its line width: react-pdf
 * strokes a border at twice its width, clipped to the box (as painted() reads it). Clip paths and
 * images are left out.
 */
export async function paintedPages(bytes) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  const O = pdfjs.OPS;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    const { fnArray, argsArray } = await (await doc.getPage(p)).getOperatorList();
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
        if (clipping) { clipping = false; return; }
        const stroke = a[0] === O.stroke;
        out.push({ paint: stroke ? 'stroke' : 'fill', colour: stroke ? g.stroke : g.fill, width: stroke ? g.lw / 2 : 0, ...box(a[2], g.m) });
      }
    });
    pages.push(out);
  }
  await doc.loadingTask.destroy();
  return pages;
}

/**
 * The fills in `colour` that run the page's full width `W` and reach its top edge `H` — the band on
 * page 1, the strip on the pages after it — widest first.
 */
export const topBands = (paints, colour, W, H) => paints
  .filter((p) => p.paint === 'fill' && p.colour === colour && p.x0 < 0.5 && p.x1 > W - 0.5 && p.y1 > H - 0.5)
  .sort((a, b) => (b.y1 - b.y0) - (a.y1 - a.y0));

/** The fills in `colour` behind the text item `item` (its box holds the item's start and baseline). */
export const fillsBehind = (paints, colour, item) => paints.filter((p) => p.paint === 'fill' && p.colour === colour
  && p.x0 <= item.x + 0.5 && p.x1 >= item.x + item.w - 0.5 && p.y0 <= item.y && p.y1 >= item.y + item.h * 0.6);
