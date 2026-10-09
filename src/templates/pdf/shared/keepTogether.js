import { createContext } from 'react';
import { pageBoxPt } from '@/constants/pageSize';
import { MM_TO_PT } from './pdfUnits';
import { bottomMarginMm, pageMargins } from './PdfPage';

/**
 * The room a list item is laid out in, { width, height } in pt: the width of the column (or Grids cell)
 * its text is drawn in, and the height of a page's text. Provided around the entries of a column
 * (RenderColGrid, the Timeline's rail, the Sidebar's dark column) so PdfRichText can tell an item that
 * can never fit a page from one that does. Nothing provided: the item's length alone decides.
 */
export const ColumnRoom = createContext(null);

/** The room for text `width` pt wide on the résumé's paper: the page's text height between its margins. */
export const columnRoom = (settings, width) => ({
  width,
  height: pageBoxPt(settings).height - (pageMargins(settings).v + bottomMarginMm(settings)) * MM_TO_PT,
});

// An average character is about half an em in the faces the PDF prints; a wider guess only makes an
// item count as taller, which lets it split. A character of a wide script (CJK, Hangul, kana, fullwidth
// forms) is a full em.
const LATIN_EM = 0.55;
const WIDE_EM = 1;
const WIDE_FROM = 0x2e80;
/** An item taller than this share of a page's text is not kept whole: the estimate is rough, so it leaves room. */
const FITS_SHARE = 0.8;

/**
 * True when a list item whose text is `text`, drawn at `fontSize` pt and `lineHeight` (a multiple of it)
 * in a column of `width` pt, is shorter than a page's text `height` — so it can be kept whole on one
 * page. An item taller than a page that cannot break is cut off at the page's foot, its tail lost
 * (a 3- or 4-column Grids cell, or the Sidebar's dark column, with wide margins and a large type size).
 */
export function fitsPage({ text, fontSize, lineHeight, width, height }) {
  if (!(width > fontSize) || !(height > 0)) return false;
  let em = 0;
  for (const ch of text) em += ch.codePointAt(0) >= WIDE_FROM ? WIDE_EM : LATIN_EM;
  // One line more than the text fills: a line is never full, and a word that does not fit starts the next.
  const lines = Math.ceil((em * fontSize) / width) + 1;
  return lines * fontSize * lineHeight <= height * FITS_SHARE;
}
