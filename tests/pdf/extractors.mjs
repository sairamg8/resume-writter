/**
 * Word-level text extraction as other readers see it: pdf.js (the harness's read()) and Poppler's
 * pdftotext, whose modes are what most PDF-to-text ATS pipelines run. Letter-spacing a reader
 * does not tolerate splits a word into letters ("C O N TA C T"), which only these catch.
 * And what page 1 paints besides text — rules, bands, icons, images — read from pdf.js's
 * operator list, no canvas needed (painted()).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { read, allText } from './harness.mjs';

/** Poppler's pdftotext is installed (it is optional: tests that use it note its absence). */
export const hasPdftotext = spawnSync('pdftotext', ['-v']).status === 0;

/** The text each pdftotext mode reads — reading order, -raw, -layout — as [label, text] pairs; none without Poppler. */
export function pdftotext(bytes) {
  if (!hasPdftotext) return [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdftotext-'));
  try {
    const file = path.join(dir, 'r.pdf');
    fs.writeFileSync(file, bytes);
    return [[], ['-raw'], ['-layout']].map((mode) => {
      const run = spawnSync('pdftotext', [...mode, file, '-'], { encoding: 'utf8' });
      if (run.status !== 0) throw new Error(`pdftotext ${mode.join(' ')}: ${run.stderr}`);
      return [`pdftotext ${mode.join(' ') || '(reading order)'}`, run.stdout];
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** "reader: WORD" for each of `words` (capitals) that pdf.js or a pdftotext mode does not read whole. */
export async function splitWords(bytes, words) {
  const readers = [['pdf.js', allText(await read(bytes))], ...pdftotext(bytes)];
  return readers.flatMap(([name, text]) => words
    .filter((w) => !new RegExp(`(^|[^A-Z])${w}([^A-Z]|$)`).test(text))
    .map((w) => `${name}: ${w}`));
}

/**
 * Page 1 as drawn: every operator with its arguments, numbers to 0.01 pt. Equal strings print the
 * same page. pdf.js names fonts and images per loaded document (g_d0_f1, g_d2_f1 …), so those ids
 * are made document-neutral — without that, any two renders compare "different".
 */
export async function drawing(bytes) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  const ops = await (await doc.getPage(1)).getOperatorList();
  await doc.loadingTask.destroy();
  const neutral = (_, v) => (typeof v === 'number' ? Math.round(v * 100) / 100
    : typeof v === 'string' ? v.replace(/_d\d+_/g, '_d_') : v);
  return ops.fnArray.map((fn, k) => `${fn} ${JSON.stringify(ops.argsArray[k], neutral)}`).join('\n');
}

const times = (t, m) => [
  t[0] * m[0] + t[1] * m[2], t[0] * m[1] + t[1] * m[3], t[2] * m[0] + t[3] * m[2],
  t[2] * m[1] + t[3] * m[3], t[4] * m[0] + t[5] * m[2] + m[4], t[4] * m[1] + t[5] * m[3] + m[5],
];

/**
 * Every word gap the pages draw — one space (U+0020, a no-break space `nbsp`, or a typographic space) between two non-space glyphs
 * on one baseline, left to right — as { em, at, nbsp }: the distance from the end of the left glyph's own advance to the start of the
 * right glyph, in ems of the left glyph's font size, and the text around it. That distance is all
 * Poppler's `pdftotext -raw` reads a word break from (it drops the U+0020 glyph and re-derives words
 * from geometry), and it joins two words across a gap under ~0.2 em. Positions follow pdf.js's
 * operator list: the CTM, the text matrix, the TJ adjustments and Tc/Tw. Needs no Poppler.
 */
export async function wordGaps(bytes) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  const O = pdfjs.OPS;
  const out = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    const { fnArray, argsArray } = await (await doc.getPage(p)).getOperatorList();
    const glyphs = []; // { ch, x0, x1, y, em } on the page, in drawing order
    const stack = [];
    let ctm = [1, 0, 0, 1, 0, 0];
    let tm = ctm;
    let tlm = ctm;
    let size = 0;
    let tc = 0;
    let tw = 0;
    fnArray.forEach((fn, k) => {
      const a = argsArray[k];
      if (fn === O.save) stack.push(ctm);
      else if (fn === O.restore) ctm = stack.pop() || ctm;
      else if (fn === O.transform) ctm = times(a, ctm);
      else if (fn === O.beginText) tm = tlm = [1, 0, 0, 1, 0, 0];
      else if (fn === O.setTextMatrix) tm = tlm = a.length === 6 ? [...a] : Array.from(a[0]);
      else if (fn === O.moveText || fn === O.setLeadingMoveText) tm = tlm = times([1, 0, 0, 1, a[0], a[1]], tlm);
      else if (fn === O.setFont) size = a[1];
      else if (fn === O.setCharSpacing) tc = a[0];
      else if (fn === O.setWordSpacing) tw = a[0];
      else if (fn === O.showText) {
        const m = times(tm, ctm);
        const em = size * Math.hypot(m[0], m[1]);
        let x = 0;
        for (const g of a[0]) {
          if (typeof g === 'number') { x -= (g / 1000) * size; continue; }
          if (!g) continue;
          const w = (g.width / 1000) * size;
          glyphs.push({ ch: g.unicode, x0: x * m[0] + m[4], x1: (x + w) * m[0] + m[4], y: x * m[1] + m[5], em });
          x += w + tc + (g.isSpace ? tw : 0);
        }
        tm = times([1, 0, 0, 1, x, 0], tm);
      }
    });
    const ink = (g) => g && String(g.ch).trim() !== '';
    const oneLine = (a, b) => Math.abs(a.y - b.y) < 0.5 && b.x0 > a.x0;
    // A word gap is any space character: U+0020, the no-break space, or a typographic space (thin,
    // hair, narrow no-break…) a face draws with its own glyph — -raw breaks words on all of them alike.
    const SPACE = /^\p{Zs}$/u;
    glyphs.forEach((g, i) => {
      const [l, r] = [glyphs[i - 1], glyphs[i + 1]];
      if (!SPACE.test(g.ch) || !ink(l) || !ink(r) || !oneLine(l, r)) return;
      const at = glyphs.slice(Math.max(0, i - 14), i + 15).filter((n) => Math.abs(n.y - g.y) < 0.5).map((n) => n.ch).join('');
      out.push({ em: (r.x0 - l.x1) / l.em, at: `p${p} "${at}"`, nbsp: g.ch === '\u00a0' });
    });
  }
  await doc.loadingTask.destroy();
  return out;
}

/** A 2×2 PNG, for photos and icons: a photo's box comes from the Size/Height settings, not the image. */
export const PNG_2X2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8AARAwQCgAf7gP9i18U1AAAAABJRU5ErkJggg==';

/**
 * Page 1's painted paths and images, and the clip paths between them, on the page, in drawing
 * order: { paint: 'fill' | 'stroke' | 'image' | 'clip', colour, width, x0, y0, x1, y1 }.
 * react-pdf strokes a border at twice its width, clipped to the box, so a stroke's `width` is
 * half its line width: the rule's thickness as printed. A clip also has `start`, the x where its
 * path starts: a rounded box's corner radius is start - x0.
 */
export async function painted(bytes) {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, verbosity: 0 }).promise;
  const { fnArray, argsArray } = await (await doc.getPage(1)).getOperatorList();
  await doc.loadingTask.destroy();
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
      if (clipping) {
        clipping = false;
        const [, [path]] = a;
        out.push({ paint: 'clip', colour: null, width: 0, ...box(a[2], g.m), start: box([path[1], path[2], path[1], path[2]], g.m).x0 });
        return;
      }
      const stroke = a[0] === O.stroke;
      out.push({ paint: stroke ? 'stroke' : 'fill', colour: stroke ? g.stroke : g.fill, width: stroke ? g.lw / 2 : 0, ...box(a[2], g.m) });
    } else if (fn === O.paintImageXObject || fn === O.paintInlineImageXObject) out.push({ paint: 'image', ...box([0, 0, 1, 1], g.m) });
  });
  return out;
}
