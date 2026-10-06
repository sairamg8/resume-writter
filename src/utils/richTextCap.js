import { sanitizeForInsert } from '@/utils/richText';

// What one rich-text field may hold: paragraphs and list items ("blocks"). react-pdf lays each block out as
// a node and, for every page, lays out again every node after it, so a field's build time follows its pages
// times its blocks: 1 000 bullets of 100 characters build in 6.6 s, 2 000 in 23.4 s (past the PDF worker's
// 20 s, so the preview and Export both fail). A paste that would take a field past this many is cut where
// the limit falls, and a line under the field says so (R2-142). Typing is not held: no one types this many.
export const MAX_FIELD_BLOCKS = 1500;

/** The blocks in `html` as the sanitizer writes them: a `<p` or an `<li` opens each one. */
export function countBlocks(html) {
  const s = String(html ?? '');
  const open = /<(?:p|li)[\s>]/gi;
  let n = 0;
  while (open.exec(s)) n += 1;
  return n;
}

/**
 * `clean` (sanitizeForInsert's HTML) kept to `room` blocks: the text before the first block past them is
 * sanitized again, which closes the lists and paragraphs the cut left open and drops a list left empty.
 * `cut` is whether anything was left out.
 */
export function capBlocks(clean, room) {
  const open = /<(?:p|li)[\s>]/gi;
  let n = 0;
  for (let m = open.exec(clean); m; m = open.exec(clean)) {
    n += 1;
    if (n > room) return { html: sanitizeForInsert(clean.slice(0, m.index)), cut: true };
  }
  return { html: clean, cut: false };
}
