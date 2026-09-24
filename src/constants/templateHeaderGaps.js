// Each template's header spacing where the résumé sets none — TEMPLATES' `headerGaps`
// (src/constants/templates.js), kept here so that table stays one screen of decisions. Plain data.

/**
 * The header's spacing where the résumé sets none (TEMPLATES' `headerGaps`; header_spacing_spec.md),
 * in pt — the PDF's own unit, so an unset gap prints exactly what the template always did: each
 * value is the constant it replaced. null: the template has no such gap, and a stored value is
 * ignored there. A map is by Contact Layout; a function takes Between Sections (pt). The settings
 * (CSS px), their ranges and how they resolve: src/constants/headerSpacing.js. Classic, Minimal and
 * Executive print these; Modern's banner and the Sidebar column still print the constants their
 * values here record, until their own batch wires them (no editor control may offer those before).
 */
export const STACKED_HEADER_GAPS = {
  nameTitleGap: 1,                  // Stack layout: the title's marginTop
  headerInlineGap: 6,               // Inline layout: the 8 px ATS_DEFAULTS stores, as resolveTemplateSettings reads it
  titleContactsGap: 3,              // the contacts' marginTop (PdfContactRow): name ↔ contacts without a title
  contactGapX: { justify: 12 },     // Icon + Justify, pxToPt(16); 2 Grid's 46 % cells and Bar/Bullet's one line have none
  contactGapY: { single: 2, justify: 1.5, '2grid': 1.5 }, // between contact rows
  iconTextGap: 2,                   // a contact's icon (or bullet) ↔ its value
  photoTextGap: 10,                 // photo ↔ name block (a centred header stacks the photo above it)
  summaryGap: 8,                    // contacts ↔ summary
  headerGapBelow: (sectionGapPt) => Math.max(15, sectionGapPt || 0), // mb-5 (20 px), or Between Sections when wider
  headerRuleGap: 12,                // text ↔ the header rule, when it is on: pb-4 (16 px)
  headerPadY: null,                 // no banner
  headerPadX: null,
};
/** Modern ignores Contact Layout, so its contact gaps are plain numbers (a map by layout would drop them). */
export const MODERN_HEADER_GAPS = {
  nameTitleGap: 1, headerInlineGap: null, titleContactsGap: 4, contactGapX: 12, contactGapY: 1.5,
  iconTextGap: 2, photoTextGap: 12, summaryGap: 8, headerGapBelow: (sectionGapPt) => sectionGapPt,
  headerRuleGap: null, headerPadY: 15, headerPadX: 18,
};
/**
 * Banner's header is Classic's stacked one set in a full-bleed band (BannerTemplatePDF.jsx), so it has
 * Classic's gaps, plus the band's own: `headerPadY` the band's padding under its text (its top is the
 * page's top margin, as the cover letter's band keeps it); `summaryGap` the band's edge ↔ the summary,
 * which prints under the band on the white page. The text keeps the page margins: no `headerPadX`.
 */
export const BANNER_HEADER_GAPS = { ...STACKED_HEADER_GAPS, summaryGap: 12, headerPadY: 20 };
export const SIDEBAR_HEADER_GAPS = {
  nameTitleGap: 2, headerInlineGap: null, titleContactsGap: null, contactGapX: null, contactGapY: 6,
  iconTextGap: 3.5, photoTextGap: 10, summaryGap: null, headerGapBelow: (sectionGapPt) => sectionGapPt,
  headerRuleGap: null, headerPadY: null, headerPadX: null,
};
/**
 * Academic's header is Classic's stacked one, centred where it is picked (templates.js ACADEMIC style),
 * set a little tighter for a dense CV: its job title — an italic line, the position under the name —
 * 2 pt under the name, the summary 6 pt under the contacts, and 12 pt (or Between Sections when
 * wider) under the header, where Classic keeps 15 (AcademicTemplatePDF.jsx).
 */
export const ACADEMIC_HEADER_GAPS = {
  ...STACKED_HEADER_GAPS, nameTitleGap: 2, summaryGap: 6,
  headerGapBelow: (sectionGapPt) => Math.max(12, sectionGapPt || 0),
};
