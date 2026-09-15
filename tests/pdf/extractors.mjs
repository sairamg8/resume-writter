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

const times = (t, m) => [
  t[0] * m[0] + t[1] * m[2], t[0] * m[1] + t[1] * m[3], t[2] * m[0] + t[3] * m[2],
  t[2] * m[1] + t[3] * m[3], t[4] * m[0] + t[5] * m[2] + m[4], t[4] * m[1] + t[5] * m[3] + m[5],
];

/**
 * Page 1's painted paths and images, on the page: { paint: 'fill' | 'stroke' | 'image', colour,
 * width, x0, y0, x1, y1 }. react-pdf strokes a border at twice its width, clipped to the box, so
 * a stroke's `width` is half its line width: the rule's thickness as printed.
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
      if (clipping) { clipping = false; return; }
      const stroke = a[0] === O.stroke;
      out.push({ paint: stroke ? 'stroke' : 'fill', colour: stroke ? g.stroke : g.fill, width: stroke ? g.lw / 2 : 0, ...box(a[2], g.m) });
    } else if (fn === O.paintImageXObject) out.push({ paint: 'image', ...box([0, 0, 1, 1], g.m) });
  });
  return out;
}
