// The résumé templates and what their headers offer. Plain data and functions only — the
// editor UI, the store and the PDF code all read it, and it must not pull react-pdf into the
// editor bundle.

import { TEMPLATES } from './templateTable.js';

// Every template's decisions — label, ATS tier, the style it brings, its header — are one table:
// TEMPLATES in ./templateTable.js. Everything below reads it.

/** Every template the app offers. */
export const TEMPLATE_IDS = Object.keys(TEMPLATES);

/** The order the Design panel lists them in; a template missing here is listed last, never left out. */
const PICKER_FIRST = ['executive', 'classic', 'modern', 'minimal', 'sidebar'];

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
 * How well `template` parses, as ONE answer for the whole app (TUI-5): the Design panel's ATS badge and
 * the ATS Check tab's template verdict both read this, so they cannot drift apart again. They used to be
 * two hardcoded lists and had already disagreed about two of five templates.
 *
 * - `certified` (5 pts) — one linear column on the white page; every Poppler mode and pdf.js read it whole
 *   (`tests/pdf/40-ats-parse.test.mjs`, `42-ats-fields.test.mjs`).
 * - `good` (4 pts) — the same single-column body under a coloured banner (Modern, Banner). It parses clean in the
 *   same battery; the notch is its header ground, not its text flow. Compact's experience is that one column too;
 *   its notch is its grid of short sections, whose cells share a line a line-reading parser takes whole.
 * - `risky` (2 pts) — two columns a portal may interleave (ATS-3). Only the Sidebar, and only in its
 *   two-column Layout.
 *
 * `settings` matters: the Sidebar's "Single · ATS-safe" prints Classic's page (headerTemplateId), so it is
 * rated as Classic. An id the app does not offer is rated as the template it prints as, Classic.
 */
export const ATS_TIER_POINTS = { certified: 5, good: 4, risky: 2 };

export function atsRating(template, settings) {
  const t = headerTemplateId(template, settings);
  const tier = TEMPLATES[t].atsTier;
  // `note`: what the ATS Check says of a template below certified, where its own reason differs (Compact's grid).
  return { tier, points: ATS_TIER_POINTS[tier], safe: tier !== 'risky', ...(TEMPLATES[t].atsNote ? { note: TEMPLATES[t].atsNote } : {}) };
}

/**
 * The picker card's one line on `template`: what its engine draws, as the résumé would print it — the
 * Sidebar in its Layout "Single · ATS-safe" prints Classic's page, and says so (A6). Never an ATS
 * claim: the card's badge says that, from atsRating.
 */
export function templateDesc(template, settings) {
  const t = templateId(template);
  return (headerTemplateId(t, settings) !== t && TEMPLATES[t].descSingle) || TEMPLATES[t].desc;
}

/** The labels of the templates that bring more than a heading style and title case (Academic's type, Compact's spacing). */
export const templatesBringingType = (table = TEMPLATES) => Object.keys(table)
  .filter((id) => Object.keys(table[id].style).some((k) => k !== 'headingStyle' && k !== 'sectionTitleCase'))
  .map((id) => table[id].label);

/**
 * The line under the picker saying what a switch keeps and what it changes (A5), as setTemplate does it
 * (useResumeStore): styleOnSwitch sets the new template's heading style and title case (and the type and
 * spacing of those that bring them, templatesBringingType), a section's entry layout and Grids follow the
 * template where the section holds no choice of its own (resolveSection, sectionsOnSwitch), and a Name or
 * Job title colour that would not read on the new header goes back to the template's own
 * (headerColorsOnSwitch). Everything else — the content, and the colours, font and spacing set — stays.
 */
export function templateSwitchNote(table = TEMPLATES) {
  const bring = templatesBringingType(table);
  const also = bring.length
    ? ` ${bring.length > 1 ? `${bring.slice(0, -1).join(', ')} and ${bring.at(-1)}` : bring[0]} also bring${bring.length > 1 ? '' : 's'} ${bring.length > 1 ? 'their' : 'its'} own type and spacing.`
    : '';
  return 'Switching template keeps your content and the colours, font and spacing you set; it changes the heading style '
    + `and title case to the new template's.${also} Entry layouts you have not set follow the new template, and a Name or `
    + 'Job title colour that would not read on its header goes back to the template\'s own.';
}

/** The Design panel's template picker: { id, label, desc, ats } for every template, in its order. */
export const TEMPLATE_PICKER = [...PICKER_FIRST, ...TEMPLATE_IDS.filter((id) => !PICKER_FIRST.includes(id))]
  .map((id) => ({ id, label: TEMPLATES[id].label, desc: TEMPLATES[id].desc, ats: atsRating(id).safe }));

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
export const inSidebarColumn = (template, type, settings) =>
  templateId(template) === 'sidebar' && !settings?.sidebarSingleColumn && SIDEBAR_COLUMN_TYPES.includes(type);

/**
 * Does the template's header take Header Customization's alignment, name/title layout, rule and
 * contact controls? Classic, Minimal, Executive, Timeline, Banner (in its band), Academic and Compact; Modern
 * prints a fixed banner, Sidebar a side panel.
 * Sidebar in Single · ATS-safe mode prints Classic's page and header.
 */
export const hasHeaderControls = (template, settings) => {
  const t = headerTemplateId(template, settings);
  return TEMPLATES[t].headerControls;
};

/** The labels of the templates whose headers offer Header Customization controls, in order. */
export const headerControlTemplateLabels = (table = TEMPLATES) =>
  Object.keys(table).filter((id) => table[id].headerControls).map((id) => table[id].label);

/**
 * Is the cover letter's letterhead centred? Exactly when the résumé's header is: Text Alignment
 * "Center" in a template that takes it (Classic, Minimal, Executive). The letter then stacks the
 * photo, name and contacts on the centre line, so its Fields Position and Text Position have
 * nothing to place — its panel says so instead of offering them (FIDB-51).
 */
export const letterheadCentered = (settings, template) => hasHeaderControls(template, settings) && settings?.headerAlign === 'center';

/**
 * Photo → Text Position lines the text beside the photo up with its top, centre or bottom. There
 * is no text beside it in Sidebar (the photo sits above the name) or in a centred header
 * (Classic, Minimal, Executive stack the photo above it), so the editor hides the control there
 * rather than offer one that does nothing (R3-0). Modern's banner always has the text beside it.
 */
export function photoTextPositionApplies(settings, template) {
  const t = headerTemplateId(template, settings);
  if (t === 'sidebar') return false;
  return t === 'modern' || settings?.headerAlign !== 'center';
}

/**
 * Header Customization → Contact Details' Style and Layout as the PDF and Word print them, so the
 * panel's active chip is what prints (R2-095). None stored ('' or null too, R9-10) is Icon and
 * Justify; a value no build offered (an imported 'dots') prints its separators as Bar and lays out
 * as Justify (PdfContact, wordExportContacts).
 */
export function contactStyleOf(settings) {
  const style = settings?.contactStyle || 'icon';
  return style === 'icon' || style === 'bullet' ? style : 'bar';
}
export function contactLayoutOf(settings) {
  const layout = settings?.contactLayout;
  return layout === 'single' || layout === '2grid' ? layout : 'justify';
}

/**
 * Does the header draw contact icons (the pack's, or a field's uploaded image)? Modern's banner
 * and the Sidebar column always do; the other templates only with Contact Style "Icon" (the
 * default). The editor offers the per-field icon upload exactly then (R1-2).
 */
export function drawsContactIcons(template, settings) {
  const t = headerTemplateId(template, settings);
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
 * It reads the page the résumé prints (headerTemplateId), as drawsContactIcons does: the Sidebar's
 * Single · ATS-safe prints Classic's header, whose icons follow Contact style (R2-096).
 */
export function contactIconHint(template, settings, cl) {
  const resumeIcons = drawsContactIcons(template, settings);
  const anyIcons = anyDrawsContactIcons(template, settings, cl);
  const page = headerTemplateId(template, settings);

  const usage = (page === 'modern' || page === 'sidebar')
    ? `The ${page === 'modern' ? 'Modern' : 'Sidebar'} template always shows them; the cover letter shows them when its contact style is Icon.`
    : `Used by the résumé when Contact style is Icon (Modern and the two-column Sidebar always) and by the cover letter when its contact style is Icon.${resumeIcons ? '' : ' Picking a pack switches the résumé to Icon.'}`;

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
  const t = headerTemplateId(template, settings);
  return typeof v === 'boolean' ? v : TEMPLATES[t].headerRule;
}
