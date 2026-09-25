/**
 * What a résumé parser reads from the PDF — the ATS tab's "What a parser reads" (R2-141): pdf.js's
 * text items, in the order it reads them, as lines of runs. The same two rules the ATS battery holds
 * an item-based parser to (tests/pdf/ats-entry-header.mjs, OpenResume's documented rules), which it
 * checks every template against:
 *
 *   1. A new line starts where the baseline moves, by more than 2 pt.
 *   2. On a line, an item that starts within about a character's width (half its size) of the end of
 *      the one before it merges into it: one run, which a parser reads as one field. Text set further
 *      apart (a date at the line's right end) is a run of its own.
 *
 * Plain data in and out, and no imports: node's unit tests load it as it is.
 */

/** A baseline move beyond this starts a new line, pt. */
const LINE_MOVE_PT = 2;
/** Items closer than this share a run, in ems of the larger one. */
const MERGE_EM = 0.5;
/** Runs closer than this join without a space (a font change inside a word), pt. */
const TOUCH_PT = 0.8;
/** How the text shows two runs on one line: set apart, as the page sets them. */
export const RUN_GAP = '   ';

/** One pdf.js text item as { str, x, y, w, h }: `transform` holds its origin; `height` is its size. */
const itemOf = (it) => ({
  str: it.str, x: it.transform[4], y: it.transform[5], w: it.width || 0,
  h: it.height || Math.abs(it.transform[3]) || 0,
});

/** One line's items as the texts of its runs (rule 2), in the order pdf.js read them. */
function runsOf(items) {
  const runs = [];
  for (const it of items) {
    const prev = runs[runs.length - 1];
    if (prev && it.x - prev.end <= MERGE_EM * Math.max(it.h, prev.h)) {
      const noSpace = /\s$/.test(prev.text) || /^\s/.test(it.str) || it.x - prev.end < TOUCH_PT;
      prev.text += (noSpace ? '' : ' ') + it.str;
      prev.end = Math.max(prev.end, it.x + it.w);
    } else {
      runs.push({ text: it.str, end: it.x + it.w, h: it.h });
    }
  }
  return runs.map((r) => r.text.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

/**
 * A page's text items (pdf.js getTextContent().items) as its lines, each the texts of its runs:
 * [['Senior Engineer', '03/2021 – Present'], ['Northwind Traders', 'Austin, TX'], …]. Items with
 * no text (pdf.js's end-of-line and space markers) carry nothing a parser reads, and are skipped.
 */
export function textLines(items) {
  const lines = [];
  let cur = null;
  for (const raw of Array.isArray(items) ? items : []) {
    if (typeof raw?.str !== 'string' || !raw.str.trim() || !Array.isArray(raw.transform)) continue;
    const it = itemOf(raw);
    if (!cur || Math.abs(it.y - cur.y) > LINE_MOVE_PT) {
      cur = { y: it.y, items: [] };
      lines.push(cur);
    }
    cur.items.push(it);
  }
  return lines.map((l) => runsOf(l.items)).filter((runs) => runs.length);
}

/**
 * Every page's lines (textLines) as one plain text: a line to a line, its runs RUN_GAP apart, a
 * blank line between pages. What the ATS tab shows and copies.
 */
export const parserText = (pages) => (Array.isArray(pages) ? pages : [])
  .map((lines) => lines.map((runs) => runs.join(RUN_GAP)).join('\n'))
  .filter(Boolean)
  .join('\n\n');

/**
 * Reads the PDF `data` (bytes) with pdf.js — `pdfjs` is { lib, worker }: the library, and the worker
 * to run it on (none: pdf.js starts its own) — into each page's lines (textLines). The document is
 * freed once read, whether or not that worked.
 */
export async function readPdfLines(data, { lib, worker } = {}) {
  const task = lib.getDocument({ data, ...(worker ? { worker } : {}), isEvalSupported: false });
  try {
    const pdf = await task.promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      pages.push(textLines((await page.getTextContent()).items));
    }
    return pages;
  } finally {
    // Freed in the background: a failure to free it is no failure to read it.
    Promise.resolve(task.destroy()).catch(() => {});
  }
}
