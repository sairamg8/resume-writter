// The résumé templates and what their headers offer. Plain data and functions only — the
// editor UI, the store and the PDF code all read it, and it must not pull react-pdf into the
// editor bundle.

/**
 * The header's spacing where the résumé sets none (TEMPLATES' `headerGaps`; header_spacing_spec.md),
 * in pt — the PDF's own unit, so an unset gap prints exactly what the template always did: each
 * value is the constant it replaced. null: the template has no such gap, and a stored value is
 * ignored there. A map is by Contact Layout; a function takes Between Sections (pt). The settings
 * (CSS px), their ranges and how they resolve: src/constants/headerSpacing.js. Classic, Minimal and
 * Executive print these; Modern's banner and the Sidebar column still print the constants their
 * values here record, until their own batch wires them (no editor control may offer those before).
 */
const STACKED_HEADER_GAPS = {
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
const MODERN_HEADER_GAPS = {
  nameTitleGap: 1, headerInlineGap: null, titleContactsGap: 4, contactGapX: 12, contactGapY: 1.5,
  iconTextGap: 2, photoTextGap: 12, summaryGap: 8, headerGapBelow: (sectionGapPt) => sectionGapPt,
  headerRuleGap: null, headerPadY: 15, headerPadX: 18,
};
const SIDEBAR_HEADER_GAPS = {
  nameTitleGap: 2, headerInlineGap: null, titleContactsGap: null, contactGapX: null, contactGapY: 6,
  iconTextGap: 3.5, photoTextGap: 10, summaryGap: null, headerGapBelow: (sectionGapPt) => sectionGapPt,
  headerRuleGap: null, headerPadY: null, headerPadX: null,
};

/**
 * Every template the app offers, one entry each — so a template cannot be added without its
 * header decisions or its place in the picker (they were four more tables — R3-6, VM3-5):
 *   label           its name in the editor (the Cover Letter panel names the look its letter takes)
 *   desc, ats       the Design panel's one-line description, and its ATS-friendly badge
 *   style           the heading style and title case it brings: set when it is picked and on Reset
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
const TEMPLATES = {
  classic: {
    label: 'Classic', desc: 'ATS-friendly · Two-column header', ats: true,
    style: { headingStyle: 'ruled', sectionTitleCase: 'upper' }, headerControls: true, headerRule: true,
    headerGaps: STACKED_HEADER_GAPS,
  },
  modern: {
    label: 'Modern', desc: 'Bold accent header · Full-width layout', ats: false,
    style: { headingStyle: 'line', sectionTitleCase: 'upper' }, headerControls: false, headerRule: false,
    headerGaps: MODERN_HEADER_GAPS,
  },
  minimal: {
    label: 'Minimal', desc: 'ATS-friendly · Clean & whitespace-first', ats: true,
    style: { headingStyle: 'underline', sectionTitleCase: 'upper' }, headerControls: true, headerRule: false,
    headerGaps: { ...STACKED_HEADER_GAPS, summaryGap: 6 },
  },
  executive: {
    label: 'Executive', desc: 'ATS-friendly · Clean accent headings · Vibrant', ats: true,
    style: { headingStyle: 'underline', sectionTitleCase: 'normal' }, headerControls: true, headerRule: false,
    headerGaps: { ...STACKED_HEADER_GAPS, summaryGap: 6 },
  },
  sidebar: {
    label: 'Sidebar', desc: 'Colored left sidebar layout', ats: false,
    style: { headingStyle: 'plain', sectionTitleCase: 'upper' }, headerControls: false, headerRule: false,
    headerGaps: SIDEBAR_HEADER_GAPS,
  },
};

/** Every template the app offers. */
export const TEMPLATE_IDS = Object.keys(TEMPLATES);

/** The order the Design panel lists them in; a template missing here is listed last, never left out. */
const PICKER_FIRST = ['executive', 'classic', 'modern', 'minimal', 'sidebar'];

/** The Design panel's template picker: { id, label, desc, ats } for every template, in its order. */
export const TEMPLATE_PICKER = [...PICKER_FIRST, ...TEMPLATE_IDS.filter((id) => !PICKER_FIRST.includes(id))]
  .map((id) => ({ id, label: TEMPLATES[id].label, desc: TEMPLATES[id].desc, ats: TEMPLATES[id].ats }));

/** A stored id as the app writes it: an imported file's "Modern" or " sidebar " is Modern or Sidebar (R5-5). */
const asWritten = (template) => (typeof template === 'string' ? template.trim().toLowerCase() : '');

/** Does the app offer `template`, however an imported file cased or spaced it? */
export const offersTemplate = (template) => TEMPLATE_IDS.includes(asWritten(template));

/**
 * The template a résumé prints with: its own when the app offers it (in any case, R5-5), else
 * Classic — what the PDF has always drawn for an id it does not know (the old seed's 'dark', a
 * missing id, an id from an imported file).
 */
export const templateId = (template) => (offersTemplate(template) ? asWritten(template) : 'classic');

/** The template's name as the editor shows it ("Classic" for an id the app does not offer). */
export const templateLabel = (template) => TEMPLATES[templateId(template)].label;

/** The heading style and title case a template brings: set when it is picked and on Reset. */
export const templateStyleDefaults = (template) => ({ ...TEMPLATES[templateId(template)].style });

/**
 * Does Section Headings' Title case print section titles in capitals? Only "ABC" ('upper', and an
 * unset one); "Abc" ('normal') and anything else an imported file carries ('title', 'lower')
 * print the title as typed. One rule for the main column's headings, the Sidebar side column's
 * and the panel's buttons: the side column capitalised all but 'normal' (V2W2b-5).
 */
export const upperSectionTitles = (titleCase) => (titleCase || 'upper') === 'upper';

/**
 * How many pt wider than Section Headings' Border thickness a heading style prints its rule. Ruled,
 * Line after and Underline print the stored value; Left bar's bar is 2 pt wider (a 1 pt bar beside
 * bold capitals is a hairline). One rule for the PDF's bar and the panel, which shows and sets the
 * printed width — the stored value keeps its look, so every saved résumé prints as it did (ONB-12).
 */
export const headingBorderExtraPt = (headingStyle) => (headingStyle === 'leftbar' ? 2 : 0);

/**
 * Which border controls in Design → Section Headings affect the heading in the PDF and Word:
 * - Ruled, Left bar, Line after and Underline take both Border thickness and Border color.
 * - Boxed draws a filled background tinted by Border color, but no border rule (thickness is inert).
 * - Plain draws the title alone with no border or background (both are inert).
 * Anything unknown falls through to Plain in the PDF, so neither applies.
 */
export function headingBorderControls(headingStyle) {
  if (headingStyle === 'box') return { thickness: false, color: true };
  if (headingStyle === 'plain') return { thickness: false, color: false };
  if (['ruled', 'leftbar', 'line', 'underline'].includes(headingStyle)) {
    return { thickness: true, color: true };
  }
  return { thickness: false, color: false };
}


/** The template's header spacing where the résumé sets none (pt; STACKED_HEADER_GAPS above). */
export const templateHeaderGaps = (template) => TEMPLATES[templateId(template)].headerGaps;

/**
 * The template whose header a résumé's page prints: its own, but Classic for the Sidebar's ATS-safe
 * single column (Design → Layout "Single · ATS-safe", `sidebarSingleColumn`), which SidebarTemplatePDF
 * prints as Classic's page — so its header takes Classic's spacing, not the Sidebar column's.
 */
export const headerTemplateId = (template, settings) => {
  const t = templateId(template);
  return t === 'sidebar' && settings?.sidebarSingleColumn ? 'classic' : t;
};

/**
 * `resume` with a template the app offers, as the app writes it ("Modern" is 'modern'), so the
 * Design panel shows it selected and every control reads the template the PDF prints.
 * normalizeResume() applies it wherever résumés come in: load, import, cloud sync, restore. The
 * same object when nothing changes.
 */
export function withKnownTemplate(resume) {
  if (!resume || resume.template === templateId(resume.template)) return resume;
  return { ...resume, template: templateId(resume.template) };
}

/** Section types the Sidebar template prints in its dark side column; the rest go to the main column. */
export const SIDEBAR_COLUMN_TYPES = ['skills', 'education', 'languages', 'certifications', 'interests', 'references'];

/** Does a `type` section print in the Sidebar's side column — one narrow, left-aligned column? */
export const inSidebarColumn = (template, type) => templateId(template) === 'sidebar' && SIDEBAR_COLUMN_TYPES.includes(type);

/**
 * Does the template's header take Header Customization's alignment, name/title layout, rule and
 * contact controls? Classic, Minimal and Executive; Modern prints a fixed banner, Sidebar a side panel.
 */
export const hasHeaderControls = (template) => TEMPLATES[templateId(template)].headerControls;

/** The labels of the templates whose headers offer Header Customization controls, in order. */
export const headerControlTemplateLabels = (table = TEMPLATES) =>
  Object.keys(table).filter((id) => table[id].headerControls).map((id) => table[id].label);

/**
 * Is the cover letter's letterhead centred? Exactly when the résumé's header is: Text Alignment
 * "Center" in a template that takes it (Classic, Minimal, Executive). The letter then stacks the
 * photo, name and contacts on the centre line, so its Fields Position and Text Position have
 * nothing to place — its panel says so instead of offering them (FIDB-51).
 */
export const letterheadCentered = (settings, template) => hasHeaderControls(template) && settings?.headerAlign === 'center';

/**
 * Photo → Text Position lines the text beside the photo up with its top, centre or bottom. There
 * is no text beside it in Sidebar (the photo sits above the name) or in a centred header
 * (Classic, Minimal, Executive stack the photo above it), so the editor hides the control there
 * rather than offer one that does nothing (R3-0). Modern's banner always has the text beside it.
 */
export function photoTextPositionApplies(settings, template) {
  const t = templateId(template);
  if (t === 'sidebar') return false;
  return t === 'modern' || settings?.headerAlign !== 'center';
}

/**
 * Does the header draw contact icons (the pack's, or a field's uploaded image)? Modern's banner
 * and the Sidebar column always do; the other templates only with Contact Style "Icon" (the
 * default). The editor offers the per-field icon upload exactly then (R1-2).
 */
export function drawsContactIcons(template, settings) {
  const t = templateId(template);
  return t === 'modern' || t === 'sidebar' || (settings?.contactStyle || 'icon') === 'icon';
}

/**
 * Does the cover letter draw contact icons (the pack's, or a field's uploaded image)?
 * Exactly when its contact style is 'icon'.
 */
export const letterDrawsContactIcons = (cl, settings) =>
  (cl?.headerStyle || settings?.contactStyle || 'icon') === 'icon';

/**
 * Does either the résumé or the cover letter draw contact icons?
 * Personal Info → Fields offers custom icon uploads when this is true (R1-2, R9-5).
 */
export function anyDrawsContactIcons(template, settings, cl) {
  return drawsContactIcons(template, settings) || letterDrawsContactIcons(cl, settings);
}

/**
 * Design → Contact icons explanatory hint: tells the user where and when contact icons
 * are used, and accurately states when custom image uploads per field appear (ONB-8).
 */
export function contactIconHint(template, settings, cl) {
  const resumeIcons = drawsContactIcons(template, settings);
  const anyIcons = anyDrawsContactIcons(template, settings, cl);

  const usage = (templateId(template) === 'modern' || templateId(template) === 'sidebar')
    ? `The ${templateId(template) === 'modern' ? 'Modern' : 'Sidebar'} template always shows them; the cover letter shows them when its contact style is Icon.`
    : `Used by the résumé when Contact style is Icon (Modern and Sidebar always) and by the cover letter when its contact style is Icon.${resumeIcons ? '' : ' Picking a pack switches the résumé to Icon.'}`;

  const upload = anyIcons
    ? 'Custom images per field appear under Personal Info → Fields.'
    : 'Custom images per field appear under Personal Info → Fields while icons are shown.';

  return `${usage} ${upload}`;
}


/** Text Position as a flex alignment for the photo's row (Center when unset). */
export const photoTextAlignItems = (settings) =>
  ({ top: 'flex-start', bottom: 'flex-end' })[settings?.photoTextAlign] || 'center';

/**
 * Is the header rule on? The PDF and the Header Customization toggle both ask this: the stored
 * choice, else the template's design (Classic draws it, Minimal and Executive do not).
 */
export function headerBorderOn(settings, template) {
  const v = settings?.showHeaderBorder;
  return typeof v === 'boolean' ? v : TEMPLATES[templateId(template)].headerRule;
}
