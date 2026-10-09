import { pageBoxPt } from '@/constants/pageSize';
import { MM_TO_PT } from './pdfUnits';
import { bottomMarginMm, pageMargins } from './PdfPage';
import { wrappedLines } from './pdfMeasure';
import { ColumnRoom } from './roomContext';

export { ColumnRoom };

/** The room for text `width` pt wide on the résumé's paper: the page's text height between its margins. */
export const columnRoom = (settings, width) => ({
  width,
  height: pageBoxPt(settings).height - (pageMargins(settings).v + bottomMarginMm(settings)) * MM_TO_PT,
  fontFamily: settings?._pdfFontFamily,
});

// A character of a wide script (CJK, Hangul, kana, fullwidth forms) is a full em, and never less: the
// face a page prints it in is measured, but one the page's fonts lack would measure it as a gap.
const WIDE_EM = 1;
const WIDE_FROM = 0x2e80;
/** An item taller than this share of a page's text is not kept whole: textkit may set a line more than the measure, and the entry's header has to stay with it. */
const FITS_SHARE = 0.9;
// An item this short is known to fit without measuring it: even at 0.75 em a character (wider than any
// face on offer sets prose) and a line more, it is under half a page.
const SURE_EM = 0.75;
const SURE_SHARE = 0.5;

/**
 * True when a list item whose text is `text`, drawn at `fontSize` pt and `lineHeight` (a multiple of it)
 * in a column of `width` pt, is shorter than a page's text `height` — so it can be kept whole on one
 * page. An item taller than a page that cannot break is cut off at the page's foot, its tail lost
 * (a 3- or 4-column Grids cell, or the Sidebar's dark column, with wide margins and a large type size).
 * The lines are counted from the widths of the words in `fontFamily` (the page's font, pdfMeasure's
 * wrappedLines: greedy, so never fewer than react-pdf sets), plus one for a line that textkit sets in
 * two; an item that is plainly short is accepted without measuring it.
 */
export function fitsPage({ text, fontSize, lineHeight, width, height, fontFamily }) {
  if (!(width > fontSize) || !(height > 0)) return false;
  let wide = 0;
  let em = 0;
  for (const ch of text) {
    if (ch.codePointAt(0) >= WIDE_FROM) { wide += 1; em += WIDE_EM; } else em += SURE_EM;
  }
  const lineAt = fontSize * lineHeight;
  if ((Math.ceil((em * fontSize) / width) + 1) * lineAt <= height * SURE_SHARE) return true;
  const lines = Math.max(wrappedLines(text, { fontFamily, fontSize }, width), Math.ceil((wide * fontSize) / width));
  return (lines + 1) * lineAt <= height * FITS_SHARE;
}
