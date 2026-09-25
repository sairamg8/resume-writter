// The running header every résumé page after the first carries: "Name · Page 2" (ATS-7, the owner's
// option A, 2026-09-25). Poppler's `pdftotext -raw` writes a page's words in the order they are drawn and
// puts the form feed straight after the last one, so whatever is drawn first on the next page joins the
// last line of the page before ("…checkout service.\fSKILLS"). A section heading that opened a page was
// read as body text by a parser that splits lines on '\n' only. Drawn first on the page, the header is
// what joins that line, and the heading keeps a line of its own. It is plain text, as it reads: hidden
// text is what screeners flag as keyword stuffing.
//
// It prints in the top margin, so it never moves the page's text: where the margin has no room for it
// (a margin of a few mm) it is left out. The PDF (PdfRunningHeader) and Word (a page header on every page
// but the first) print the same line.

const PT_PER_MM = 72 / 25.4;

/** Its type size, pt: a caption, well under any body size the editor offers. */
export const RUNNING_HEADER_PT = 7.5;

/** Its line box, pt, at line height 1.2. */
export const RUNNING_HEADER_LINE_PT = RUNNING_HEADER_PT * 1.2;

/** The least room it takes above the page's text: its line and 2 pt clear on either side. */
const MIN_ROOM_PT = RUNNING_HEADER_LINE_PT + 4;

/** What it says before the page number: "Pat Lee · Page ", or "Page " for a résumé with no name. */
export function runningHeaderLead(name) {
  const who = String(name ?? '').replace(/\s+/g, ' ').trim();
  return who ? `${who} · Page ` : 'Page ';
}

/** The whole line on page `pageNumber`. */
export const runningHeaderText = (name, pageNumber) => `${runningHeaderLead(name)}${pageNumber}`;

/**
 * Where its line box starts, pt below the paper's top edge: centred in the room between `insetPt` (the
 * Banner's strip, carried along the top edge) and the page's top margin `marginVmm`; null when that room
 * cannot hold it clear of the text below.
 */
export function runningHeaderTop(marginVmm, insetPt = 0) {
  const inset = Math.max(0, Number(insetPt) || 0);
  const room = Math.max(0, Number(marginVmm) || 0) * PT_PER_MM - inset;
  if (!(room >= MIN_ROOM_PT)) return null;
  return inset + (room - RUNNING_HEADER_LINE_PT) / 2;
}
