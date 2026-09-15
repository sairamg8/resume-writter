// The paper a résumé prints on (PAR-01): A4, or US Letter — the standard in the US and Canada.
// One setting per résumé, `settings.pageSize`; its cover letter prints on the same paper, as it
// takes the résumé's margins, fonts and colours. No value — every résumé saved before the setting
// — and a value this build does not offer read as A4, the page every résumé has printed on, so
// saved, synced and imported résumés print as they always did. Plain data: the PDF documents, the
// editor's preview and the Word files all read the size through pageSizeOf().

/**
 * Each size: its name in the editor, its dimensions as the editor states them, and its page box
 * in PDF points (react-pdf's own sizes for 'A4' and 'LETTER') and in Word's twips (1/20 pt; A4's
 * are the docx library's default, the page every Word file had).
 */
export const PAGE_SIZES = {
  A4: { label: 'A4', dims: '210 × 297 mm', pt: { width: 595.28, height: 841.89 }, twips: { width: 11906, height: 16838 } },
  LETTER: { label: 'US Letter', dims: '8.5 × 11 in', pt: { width: 612, height: 792 }, twips: { width: 12240, height: 15840 } },
};

export const PAGE_SIZE_IDS = Object.keys(PAGE_SIZES);

/** What a résumé with no page size prints on. */
export const DEFAULT_PAGE_SIZE = 'A4';

/**
 * The résumé's page size: a key of PAGE_SIZES, and the name react-pdf's <Page size> takes. Its
 * stored value in any case ('letter' is Letter); anything else — none, an unknown size, not a
 * string — is A4.
 */
export function pageSizeOf(settings) {
  const id = typeof settings?.pageSize === 'string' ? settings.pageSize.toUpperCase() : '';
  return PAGE_SIZE_IDS.includes(id) ? id : DEFAULT_PAGE_SIZE;
}

/** The résumé's page box in pt: { width, height }. */
export const pageBoxPt = (settings) => PAGE_SIZES[pageSizeOf(settings)].pt;
