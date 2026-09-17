import { StyleSheet } from '@react-pdf/renderer';
import { solid } from './pdfColors';
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
  const bottom = Math.max(0, v - 0.5);

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
