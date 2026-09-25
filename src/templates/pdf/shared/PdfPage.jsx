import { StyleSheet } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { solid, textShades } from './pdfColors';
import { HEADER_BORDER_PAD_PT, MM_TO_PT } from './pdfUnits';
import { pageBoxPt } from '@/constants/pageSize';


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
 * "Page 1 of 2" at the foot of every page when Design → Page numbers is on (R2-147): fixed, so
 * react-pdf repeats it on each page, and absolute, inside the bottom margin (bottomMarginMm) at the
 * right margin, so it takes no room from the content and moves no page break. Right-aligned, it
 * stays off the Sidebar's dark column. Off: nothing.
 */
export function PdfPageNumbers({ settings }) {
  if (settings?.pageNumbers !== true) return null;
  const room = bottomMarginMm(settings) * MM_TO_PT;
  const line = PAGE_NUMBER_PT * 1.2;
  return (
    <Text
      fixed
      style={{
        // Both sides set: react-pdf lays a render-prop text out before it has its words, and one
        // anchored on the right alone got no width, so nothing printed.
        position: 'absolute', bottom: Math.max(0, (room - line) / 2), left: 0, right: `${pageMargins(settings).h}mm`,
        fontSize: PAGE_NUMBER_PT, lineHeight: 1.2, textAlign: 'right', color: textShades(settings.textColor).meta,
      }}
      render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
    />
  );
}
