// Design → Contact Layout and Contact Style in Word: the contacts as rows of runs, for the résumé's
// header (wordExportHeader.js) and the cover letter's letterhead (wordExportCoverLetter.js), laid out
// as PdfContactRow lays them out in the PDF.
import { TabStopType } from 'docx';
import { accent2Hex, contactSeparator, linked, normal, WORD_MARGIN_IN } from '@/utils/wordExportUtils';
import { CONTACT_GRID } from '@/utils/contacts';
import { PAGE_SIZES, pageSizeOf } from '@/constants/pageSize';
import { PAGE_MARKS } from '@/templates/pdf/shared/pdfColors';
import { pxToPt } from '@/templates/pdf/shared/pdfUnits';

const twips = (pt) => Math.round(pt * 20);

/**
 * The contacts `items` (contactItems) as rows `[{ runs, centred, extra }]` — `centred`: the row is
 * centred as a whole (a centred 2 Grid row of two is not: its tab stops centre it); `extra`: the
 * paragraph options it needs (tab stops). Justify (and a layout the app does not
 * offer): one row, the values joined by `contactStyle`'s marks (Icon prints bars). Single: a row a
 * value. 2 Grid: a row of two, the second at a tab stop where the PDF's second cell starts on Word's
 * page (`settings`' paper) — centred, centre tab stops at the two cells' centres, and an odd last
 * value centred on the line as its lone cell is. Word has no cells: a value wider than its cell
 * pushes the next one along, where the PDF gives it a row of its own. Under Single and 2 Grid,
 * Bullet prints a bullet before each value, Icon and Bar nothing. `style` the values' run style,
 * `markColor` the marks' ('rrggbb'; the page's greys where none).
 */
export function contactRows(items, { contactStyle, layout, centered, settings, style, markColor }) {
  if (layout !== 'single' && layout !== '2grid') {
    return [{ runs: items.flatMap((c, i) => [...(i ? [contactSeparator(contactStyle, style, markColor)] : []), linked(c.value, c.href, style)]), centred: centered, extra: {} }];
  }
  const mark = contactStyle === 'bullet' ? [normal('• ', { ...style, color: markColor || accent2Hex(PAGE_MARKS.bullet) })] : [];
  const cell = (item) => [...mark, linked(item.value, item.href, style)];
  if (layout === 'single') return items.map((item) => ({ runs: cell(item), centred: centered, extra: {} }));
  const width = PAGE_SIZES[pageSizeOf(settings)].twips.width / 20 - 144 * WORD_MARGIN_IN;
  const cellPt = CONTACT_GRID.cell * width;
  const gap = pxToPt(CONTACT_GRID.gapPx);
  const left = (width - (2 * cellPt + gap)) / 2;
  const tabStops = centered
    ? [left + cellPt / 2, left + cellPt + gap + cellPt / 2].map((pt) => ({ type: TabStopType.CENTER, position: twips(pt) }))
    : [{ type: TabStopType.LEFT, position: twips(cellPt + gap) }];
  const tab = () => normal('\t', style);
  const rows = [];
  for (let i = 0; i < items.length; i += 2) {
    const [a, b] = items.slice(i, i + 2);
    if (!b) rows.push({ runs: cell(a), centred: centered, extra: {} });
    else if (centered) rows.push({ runs: [tab(), ...cell(a), tab(), ...cell(b)], centred: false, extra: { tabStops } });
    else rows.push({ runs: [...cell(a), tab(), ...cell(b)], centred: false, extra: { tabStops } });
  }
  return rows;
}
