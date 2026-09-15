import { StyleSheet } from '@react-pdf/renderer';
import { solid } from './pdfColors';
import { HEADER_BORDER_PAD_PT } from './pdfUnits';

// The per-template fallbacks and resolveTemplateSettings live in the react-pdf-free
// ./templateSettings, which the Word export reads too (FIDB-51); re-exported for the PDF code.
export { DEFAULTS, resolveTemplateSettings } from './templateSettings';

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

export function getPageStyle(settings) {
  // Note: page-level lineHeight is intentionally omitted — it can inflate yoga
  // layout height beyond Text metrics and contribute to blank trailing pages.
  // Line height is applied on Text/PdfRichText instead (matches canvas).
  //
  // paddingBottom: react-pdf's page wrap is sensitive to bottom padding when the
  // last block sits near the edge (github.com/diegomura/react-pdf/issues/739).
  // Keep visual margins equal via a 0.5mm epsilon only on the bottom.
  const v = settings.marginV ?? 14;
  const h = settings.marginH ?? 18;
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
