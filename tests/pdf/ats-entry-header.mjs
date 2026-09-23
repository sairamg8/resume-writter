/**
 * How an item-based résumé parser reads an entry's header from the PDF's text items — our own
 * model of OpenResume's documented rules (its source is not copied here, and the gate does not
 * have it; qa-visual-compare/tools/or-runner cross-checks locally):
 *
 *   1. pdf.js items, in content-stream order, form lines: a new line starts when the baseline
 *      moves (OpenResume reads pdf.js's end-of-line flag; a move of more than 2 pt stands in).
 *   2. On a line, an item that starts closer than about a character's width to the end of the
 *      one before it — or before it ends — merges into it: one text run, one field.
 *   3. An entry's header is its lines up to the first line holding a bullet glyph; failing that,
 *      up to the first line that is ONE run of 8+ words without digits (read as a paragraph);
 *      failing that, 2 lines for a job and 1 for a project. What falls past it is description.
 *
 * `pages` is what the harness's read() returns: [{ items: [{ str, x, y, w, h }] }].
 */

/** OpenResume's bullet glyphs. The "·" (U+00B7) between fields is not one of them. */
export const BULLETS = ['⋅', '∙', '🞄', '•', '⦁', '⚫', '●', '⬤', '⚬', '○'];

/** Items closer than this share a run: about a character's width (half the font size). */
const MERGE_EM = 0.5;

/** One line's items as runs (rule 2): [{ text, x, end, h }], in stream order. */
function runsOf(items) {
  const runs = [];
  for (const it of items) {
    const prev = runs[runs.length - 1];
    if (prev && it.x - prev.end <= MERGE_EM * Math.max(it.h, prev.h)) {
      prev.text += (/\s$/.test(prev.text) || /^\s/.test(it.str) || it.x - prev.end < 0.8 ? '' : ' ') + it.str;
      prev.end = Math.max(prev.end, it.x + it.w);
    } else {
      runs.push({ text: it.str, x: it.x, end: it.x + it.w, h: it.h });
    }
  }
  return runs.map((r) => ({ ...r, text: r.text.replace(/\s+/g, ' ').trim() }));
}

/** Every page's lines (rule 1), each a list of runs (rule 2). */
export function lines(pages) {
  const out = [];
  for (const page of pages) {
    let cur = null;
    for (const it of page.items) {
      if (!cur || Math.abs(it.y - cur.y) > 2) { cur = { y: it.y, items: [] }; out.push(cur); }
      cur.items.push(it);
    }
  }
  return out.map((l) => runsOf(l.items));
}

const words = (text) => text.split(/\s/).filter((w) => w && /^[^0-9]+$/.test(w));

/** Rule 3: how many of `entryLines` form the header; `cap` is 2 for a job, 1 for a project. */
export function headerCut(entryLines, cap) {
  const bullet = entryLines.findIndex((runs) => runs.some((r) => BULLETS.some((b) => r.text.includes(b))));
  if (bullet >= 0) return bullet;
  const paragraph = entryLines.findIndex((runs) => runs.length === 1 && words(runs[0].text).length >= 8);
  if (paragraph >= 0) return paragraph;
  return cap;
}

/**
 * Each entry's lines: from the line holding a run that starts with its `anchor` (the entry's first
 * text, e.g. its company or name) up to the next entry's anchor, or `tail` lines when it is the
 * last. The search starts after the line whose run reads `after` (the section title, any case), so
 * a job title that is also the résumé's own title is found in its entry. An anchor that is never
 * found gives null for that entry.
 */
export function blocks(allLines, anchors, { after = null, tail = 8 } = {}) {
  const at = [];
  let from = after == null ? 0
    : allLines.findIndex((runs) => runs.some((r) => r.text.toLowerCase() === after.toLowerCase())) + 1;
  if (after != null && from === 0) return anchors.map(() => null);
  for (const a of anchors) {
    const i = allLines.findIndex((runs, k) => k >= from && runs.some((r) => r.text.startsWith(a)));
    at.push(i);
    if (i >= 0) from = i + 1;
  }
  return at.map((i, k) => {
    if (i < 0) return null;
    const next = at.slice(k + 1).find((j) => j > i);
    return allLines.slice(i, next ?? i + tail);
  });
}

/** The header lines' text of one entry block, joined, for "is the date in the header". */
export function headerText(block, cap) {
  return block.slice(0, headerCut(block, cap)).flat().map((r) => r.text).join(' | ');
}

/** Every run's text in the document, for "which runs hold this field". */
export const allRuns = (pages) => lines(pages).flat().map((r) => r.text);
