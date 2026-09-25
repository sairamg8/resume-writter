/**
 * Design → Typography → Name Font and Heading Font (R2-146): the fonts resolvePdfFonts loaded for the
 * name and the section titles, as a Text style. {} while unset, so they inherit the page's font as
 * they always did — nothing about an unset résumé's PDF changes.
 */
export const nameFace = (settings) => (settings?._pdfNameFontFamily ? { fontFamily: settings._pdfNameFontFamily } : {});
export const headingFace = (settings) => (settings?._pdfHeadingFontFamily ? { fontFamily: settings._pdfHeadingFontFamily } : {});

/** The family the name is measured in (fitFontSize, widestWord): its own font, else the page's. */
export const nameFamily = (settings) => settings?._pdfNameFontFamily || settings?._pdfFontFamily;
