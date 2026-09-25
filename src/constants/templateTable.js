// The résumé templates the app offers, one entry each: TEMPLATES. Kept here so the table of decisions
// stays one screen; ./templates.js reads it and holds every function over it. Plain data.

import {
  ACADEMIC_HEADER_GAPS, BANNER_HEADER_GAPS, COMPACT_HEADER_GAPS, MODERN_HEADER_GAPS, SIDEBAR_HEADER_GAPS,
  STACKED_HEADER_GAPS,
} from './templateHeaderGaps.js';

// The header's spacing where the résumé sets none, per template, in pt: ./templateHeaderGaps.js.

/**
 * Every template the app offers, one entry each — so a template cannot be added without its
 * header decisions or its place in the picker (they were four more tables — R3-6, VM3-5):
 *   label           its name in the editor (the Cover Letter panel names the look its letter takes)
 *   desc            the Design panel's one-line description: what the engine draws, never an ATS claim —
 *                   the card's ATS badge is derived from atsRating, so the words cannot contradict it (A6)
 *   descSingle      the Sidebar's description in its Layout "Single · ATS-safe", which prints Classic's page
 *   atsTier, atsNote how well it parses (atsRating) and, below certified, the ATS Check's reason where it
 *                   is not the coloured header ground's (Compact's grid)
 *   style           the heading style and title case it brings: set when it is picked and on Reset
 *                   (Academic brings its serif, centred header and dense Spacing as well, Compact its
 *                   small type, narrow margins and one-page Spacing)
 *   headerControls  Header Customization's alignment, name/title layout, rule and contact
 *                   controls apply (Modern prints a fixed banner, Sidebar a side panel)
 *   headerRule      it draws the header's bottom rule when a résumé has no `showHeaderBorder`
 *                   (older or imported data; new résumés store `false`): the Classic design
 *   headerGaps      the header's spacing where the résumé sets none (below)
 * Four per-template tables stay with the code that reads them, each pinned to TEMPLATE_IDS by
 * tests/pdf/15-design-defaults: DEFAULTS in templateSettings.js — the PDF's fallbacks for unset
 * colours, computed from other settings, and Classic's unset heading is 'line', not the 'ruled'
 * that picking Classic sets, so merging them would change what older résumés print —
 * TEMPLATE_SECTION_DEFAULTS (templateSectionDefaults.js), per section type, the PDF
 * components' LOADERS (pdfExportReactPDF.js), which are code-split imports, and the cover
 * letter's LOOKS (templates/pdf/shared/letterhead.js), computed from the résumé's colours.
 */
export const TEMPLATES = {
  classic: {
    label: 'Classic', desc: 'Name over a full-width rule · Section titles over a rule', atsTier: 'certified',
    style: { headingStyle: 'ruled', sectionTitleCase: 'upper' }, headerControls: true, headerRule: true,
    headerGaps: STACKED_HEADER_GAPS,
  },
  modern: {
    label: 'Modern', desc: 'Name and contacts in an accent banner · One full-width column', atsTier: 'good',
    style: { headingStyle: 'line', sectionTitleCase: 'upper' }, headerControls: false, headerRule: false,
    headerGaps: MODERN_HEADER_GAPS,
  },
  minimal: {
    label: 'Minimal', desc: 'Open header, no rule · Titles underlined · Whitespace-first', atsTier: 'certified',
    style: { headingStyle: 'underline', sectionTitleCase: 'upper' }, headerControls: true, headerRule: false,
    headerGaps: { ...STACKED_HEADER_GAPS, summaryGap: 6 },
  },
  executive: {
    label: 'Executive', desc: 'Role-first entries on one line · Title-case accent headings', atsTier: 'certified',
    style: { headingStyle: 'underline', sectionTitleCase: 'normal' }, headerControls: true, headerRule: false,
    headerGaps: { ...STACKED_HEADER_GAPS, summaryGap: 6 },
  },
  sidebar: {
    label: 'Sidebar', desc: 'Skills, education and contacts in a coloured side column',
    descSingle: "Single · ATS-safe: one column, printed as Classic's page", atsTier: 'risky',
    style: { headingStyle: 'plain', sectionTitleCase: 'upper' }, headerControls: false, headerRule: false,
    headerGaps: SIDEBAR_HEADER_GAPS,
  },
  // History on an accent line, a dot per entry, dates above titles (TimelineTemplatePDF.jsx). Its header
  // is Classic's stacked one, so it takes every header control and Classic's spacing.
  timeline: {
    label: 'Timeline', desc: 'Dated entries on an accent line', atsTier: 'certified',
    style: { headingStyle: 'plain', sectionTitleCase: 'upper' }, headerControls: true, headerRule: false,
    headerGaps: STACKED_HEADER_GAPS,
  },
  // A full-bleed accent band holding the name, title and contacts in reversed colour, filled heading
  // chips, one column (BannerTemplatePDF.jsx). Its band takes every header control; rated as Modern's
  // banner is: the same clean text flow, under a coloured header ground.
  banner: {
    label: 'Banner', desc: 'Full-bleed colour band · Filled section tags', atsTier: 'good',
    style: { headingStyle: 'box', sectionTitleCase: 'upper' }, headerControls: true, headerRule: false,
    headerGaps: BANNER_HEADER_GAPS,
  },
  // A scholarly CV (AcademicTemplatePDF.jsx): serif, the name centred, section titles in small capitals
  // (capitals at the body's size) over a hairline, italic institutions, dense. Picking it (and Reset)
  // brings that type, header and spacing — they are settings, so every control still changes them; the
  // Design panel says so under the picker. Its contacts keep Icon: Bar and Bullet glue a value's words
  // under pdftotext -raw in the narrow-space fonts (R3-003), so they are no template's default.
  academic: {
    label: 'Academic', desc: 'Scholarly CV · Serif, centred, small-capital titles', atsTier: 'certified',
    style: {
      headingStyle: 'ruled', sectionTitleCase: 'upper', font: 'sourceserif', headerAlign: 'center',
      fontSizeSectionDelta: 0, lineHeightValue: 1.35, sectionGap: 12, itemGap: 6,
    },
    headerControls: true, headerRule: false,
    headerGaps: ACADEMIC_HEADER_GAPS,
  },
  // A dense one-page résumé for a long career (CompactTemplatePDF.jsx): 9 pt type, narrow margins, the
  // title on the name's line, each section title followed by a short accent rule on its own line
  // (Line after, sectionHeadingLook), and the short sections — skills, certifications, awards,
  // languages, references — in a grid of whole items (TEMPLATE_SECTION_DEFAULTS; picking it lays out
  // a section's Grids where the résumé kept the one it was created with, templateSectionDefaults.js).
  // Rated good, not certified: the experience flows in one column, but a grid's cells share lines,
  // which a line-reading parser takes as one line of two items.
  compact: {
    label: 'Compact', desc: 'Dense one-pager · Short sections two to a row', atsTier: 'good',
    atsNote: 'Single-column experience parses reliably. Skills, certifications and other short sections print two to a line, which some older parsers read as one line.',
    style: {
      headingStyle: 'line', sectionTitleCase: 'upper', headerLayout: 'inline',
      fontSizeBase: 9, lineHeightValue: 1.3, sectionGap: 10, itemGap: 5, marginH: 12, marginV: 10,
    },
    headerControls: true, headerRule: false,
    headerGaps: COMPACT_HEADER_GAPS,
  },
  // The designed layouts (R2-138 B2): each Classic's stacked header — every Header Customization control —
  // and the shared single column, with marks of its own that are fills, never text (PdfDesigned.jsx,
  // designedMarks.js), and its own heading mark under the heading style it brings (sectionHeadingLook).
  gridline: {
    label: 'Gridline', desc: 'Hairlines over and under the header · Titles between two hairlines', atsTier: 'certified',
    style: { headingStyle: 'ruled', sectionTitleCase: 'upper' }, headerControls: true, headerRule: false,
    headerGaps: STACKED_HEADER_GAPS,
  },
  registry: {
    label: 'Registry', desc: 'An accent bar over the name · Titles on a dotted rule · Role-first jobs', atsTier: 'certified',
    style: { headingStyle: 'underline', sectionTitleCase: 'upper' }, headerControls: true, headerRule: false,
    headerGaps: STACKED_HEADER_GAPS,
  },
  bookend: {
    label: 'Bookend', desc: 'The header between two heavy rules · A rule along every page\'s foot', atsTier: 'certified',
    style: { headingStyle: 'line', sectionTitleCase: 'upper' }, headerControls: true, headerRule: false,
    headerGaps: STACKED_HEADER_GAPS,
  },
  lectern: {
    label: 'Lectern', desc: 'Centred header over a short rule · Centred section titles', atsTier: 'certified',
    style: { headingStyle: 'line', sectionTitleCase: 'upper', headerAlign: 'center' }, headerControls: true, headerRule: false,
    headerGaps: STACKED_HEADER_GAPS,
  },
  chronicle: {
    label: 'Chronicle', desc: 'A serif masthead over a thick-and-thin rule · Double-ruled titles', atsTier: 'certified',
    style: { headingStyle: 'underline', sectionTitleCase: 'upper', font: 'ptserif' }, headerControls: true, headerRule: false,
    headerGaps: STACKED_HEADER_GAPS,
  },
  keystone: {
    label: 'Keystone', desc: 'An accent keystone beside the name · Boxed titles with an accent edge', atsTier: 'certified',
    style: { headingStyle: 'box', sectionTitleCase: 'upper' }, headerControls: true, headerRule: false,
    headerGaps: STACKED_HEADER_GAPS,
  },
  // Rated as Banner is: the same clean text flow, under a tinted header ground.
  banded: {
    label: 'Banded', desc: 'The header on a pale band across the page · Titles on bands to the edges', atsTier: 'good',
    style: { headingStyle: 'box', sectionTitleCase: 'upper' }, headerControls: true, headerRule: false,
    headerGaps: STACKED_HEADER_GAPS,
  },
  keel: {
    label: 'Keel', desc: 'An accent bar down the header\'s side · Left-bar titles', atsTier: 'certified',
    style: { headingStyle: 'leftbar', sectionTitleCase: 'upper' }, headerControls: true, headerRule: false,
    headerGaps: STACKED_HEADER_GAPS,
  },
  linen: {
    label: 'Linen', desc: 'Lato, soft and open · Title-case titles underlined to their length', atsTier: 'certified',
    style: { headingStyle: 'underline', sectionTitleCase: 'normal', font: 'lato' }, headerControls: true, headerRule: false,
    headerGaps: STACKED_HEADER_GAPS,
  },
  broadsheet: {
    label: 'Broadsheet', desc: 'A headline name over a heavy rule · A rule over every title', atsTier: 'certified',
    style: { headingStyle: 'ruled', sectionTitleCase: 'upper', fontSizeNameDelta: 14, sectionBorderWidth: 2 }, headerControls: true, headerRule: false,
    headerGaps: STACKED_HEADER_GAPS,
  },
};
