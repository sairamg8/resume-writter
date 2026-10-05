import { StyleSheet } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { solid, textShades } from './pdfColors';
import { HEADER_BORDER_PAD_PT, MM_TO_PT } from './pdfUnits';
import { pageBoxPt } from '@/constants/pageSize';
import { headerTemplateId } from '@/constants/templates';
import { SIDE_WIDTH_PCT, layoutOption, sideWidthOf } from '@/constants/layoutOptions';


/**
 * The header's bottom rule (Classic, Minimal, Executive) when the settings turn it on, below the
 * header's Text ↔ Border gap: the résumé's own, else the template's (pb-4, 16 px).
 */
export function getHeaderBorderStyle(settings) {
  if (!settings.showHeaderBorder) return {};
  return {
    borderBottomWidth: settings.headerBorderWidth || 2,
    borderBottomColor: solid(settings.accentColor),
    paddingBottom: settings.headerGaps?.headerRuleGap ?? HEADER_BORDER_PAD_PT,
  };
}

export { pageMargins } from '@/constants/pageMargins';
import { pageMargins } from '@/constants/pageMargins';

/** The width between the page's left and right margins, in pt, on the résumé's paper (A4 or US Letter). */
export const contentWidthPt = (settings) => pageBoxPt(settings).width - 2 * pageMargins(settings).h * MM_TO_PT;

/** The Sidebar's dark column: its share of the paper by default — Design → Layout's width sets it (sideShare, PdfSidebarColumn.jsx). */
export const SIDE_COL = SIDE_WIDTH_PCT.default / 100;
/** The Sidebar's main column: its padding on the dark column's side, pt (SidebarTemplatePDF). */
export const MAIN_PAD_LEFT = 14;
/** The side column's padding on the main column's side, pt (SidebarTemplatePDF, PdfSidebarColumn.jsx). */
export const SIDE_PAD = 10;
/** The least a side column's text is laid out in, pt: a narrow column between wide margins keeps this much (sideShare). */
const MIN_SIDE_TEXT_PT = 60;

/**
 * The side column's share of the paper as it prints, 0–1: Design → Layout's width (layoutSideWidth, 24–45 %;
 * unset 38 %, SIDE_COL) — or a little more where the page margins would leave its text under MIN_SIDE_TEXT_PT.
 * At every width and margin the default prints, the column is exactly the width the setting says.
 */
export function sideShare(settings) {
  const share = sideWidthOf(settings?.layoutSideWidth) / 100;
  const least = (pageMargins(settings).h * MM_TO_PT + SIDE_PAD + MIN_SIDE_TEXT_PT) / pageBoxPt(settings).width;
  return Math.max(share, least);
}

/**
 * The width a page's entries are laid out in, pt: the page's text (contentWidthPt), or on the
 * two-column Sidebar its main column — the paper less the side column, the main column's padding and
 * the page's right margin. Its "Single · ATS-safe" page prints Classic's (headerTemplateId), and its
 * Mixed layout prints its main sections across the page's text. A column of Mixed's short sections
 * (`_columnWidthPt`, SidebarTemplatePDF) is its own width.
 */
export const mainTextWidthPt = (settings) => {
  if (Number.isFinite(settings?._columnWidthPt)) return settings._columnWidthPt;
  if (headerTemplateId(settings?._template, settings) !== 'sidebar' || layoutOption('layoutColumns', settings?.layoutColumns) === 'mixed') return contentWidthPt(settings);
  return pageBoxPt(settings).width * (1 - sideShare(settings)) - MAIN_PAD_LEFT - pageMargins(settings).h * MM_TO_PT;
};

export function getPageStyle(settings) {
  // Note: page-level lineHeight is intentionally omitted — it can inflate yoga
  // layout height beyond Text metrics and contribute to blank trailing pages.
  // Line height is applied on Text/PdfRichText instead (matches canvas).
  //
  // paddingBottom: react-pdf's page wrap is sensitive to bottom padding when the
  // last block sits near the edge (github.com/diegomura/react-pdf/issues/739).
  // Keep visual margins equal via a 0.5mm epsilon only on the bottom.
  const { v, h } = pageMargins(settings);
  const bottom = Math.max(0, bottomMarginMm(settings) - 0.5);

  return StyleSheet.create({
    page: {
      fontFamily: settings._pdfFontFamily || 'NotoSans',
      paddingTop: `${v}mm`,
      paddingBottom: `${bottom}mm`,
      paddingLeft: `${h}mm`,
      paddingRight: `${h}mm`,
      fontSize: settings.fontSizeBase,
      color: settings.textColor,
      backgroundColor: 'white',
    },
  }).page;
}

/** Document metadata — product branding (not FlowCV). */
export function getDocumentProps(personal) {
  return {
    title: personal?.name ? `${personal.name} Resume` : 'Resume',
    author: personal?.name || '',
    creator: 'CPWT-CV',
    producer: 'CPWT-CV',
    subject: 'Resume',
    keywords: 'resume, cv, CPWT-CV',
  };
}

/** Design → Page numbers' footer (settings.pageNumbers, R2-147): its type size, pt, and the least bottom margin that holds it, mm. */
const PAGE_NUMBER_PT = 8;
const PAGE_NUMBER_ROOM_MM = 10;

/**
 * The page's bottom margin in mm: Design → Spacing's, or with Page numbers on at least the room its
 * footer prints in — a 0 mm margin would print it over the last line. Off (every résumé storing
 * none), the margin as before.
 */
export const bottomMarginMm = (settings) => {
  const { v } = pageMargins(settings);
  return settings?.pageNumbers === true ? Math.max(v, PAGE_NUMBER_ROOM_MM) : v;
};

/**
 * How far above the paper's bottom edge a mark drawn in the bottom margin must sit to clear the page
 * number's line, pt (the line is centred in bottomMarginMm) — null with Page numbers off.
 */
export const abovePageNumbersPt = (settings) => (settings?.pageNumbers === true
  ? (bottomMarginMm(settings) * MM_TO_PT + PAGE_NUMBER_PT * 1.2) / 2 + 2
  : null);

/**
 * "Page 1 of 2" at the foot of every page when Design → Page numbers is on (R2-147): fixed, so
 * react-pdf repeats it on each page, and absolute, inside the bottom margin (bottomMarginMm) at the
 * right margin, so it takes no room from the content and moves no page break. Right-aligned, it
 * stays off the Sidebar's dark column. A template puts it LAST among its page's children: it is then
 * the page's last text drawn, so text readers (pdftotext -raw, an ATS) still read the name first on
 * page 1 and the running header first on the pages after. (react-pdf leaves the fixed elements that
 * follow a page's own child that cannot break and is taller than a page off that child's page, so no
 * résumé template puts an unbreakable node straight on the page: the header row that never splits sits
 * in a breakable View, whose split keeps the number on the page — R2-147-pn.) Off: nothing.
 * `right`: where the line ends instead of the right margin, with the Sidebar's column on the right
 * (Design → Layout → Details Right): at the main column's text, clear of the dark column.
 */
export function PdfPageNumbers({ settings, right }) {
  if (settings?.pageNumbers !== true) return null;
  const room = bottomMarginMm(settings) * MM_TO_PT;
  const line = PAGE_NUMBER_PT * 1.2;
  return (
    <Text
      fixed
      style={{
        // Placed from the top with no height, as the running header (ATS-7) is. Each time react-pdf lays
        // a page out again it multiplies a render-prop Text's unitless lineHeight by its fontSize once
        // more (8 pt × 1.2 = 9.6, then 76.8, 4915.2 … pt), so this line is far taller than its type. Given a
        // height, textkit dropped the line (it keeps none taller than its box); placed from the bottom, the
        // box grew up off the paper — no page printed a number (19ce8d1 … 9e4c0fa). From the top, it grows
        // down past the paper's edge and the number prints at its top, where it is placed.
        position: 'absolute', top: pageBoxPt(settings).height - room + Math.max(0, (room - line) / 2),
        left: 0, right: right ?? `${pageMargins(settings).h}mm`,
        fontSize: PAGE_NUMBER_PT, lineHeight: 1.2, textAlign: 'right', color: textShades(settings.textColor).meta,
      }}
      render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
    />
  );
}
