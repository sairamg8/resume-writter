/**
 * Word-level text extraction as other readers see it: pdf.js (the harness's read()) and Poppler's
 * pdftotext, whose modes are what most PDF-to-text ATS pipelines run. Letter-spacing a reader
 * does not tolerate splits a word into letters ("C O N TA C T"), which only these catch.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
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
