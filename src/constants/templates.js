// The résumé templates and what their headers offer. Plain data and functions only — the
// editor UI, the store and the PDF code all read it, and it must not pull react-pdf into the
// editor bundle.

/**
 * Every template the app offers, one entry each — so a template cannot be added without its
 * header decisions (they were three more tables — R3-6):
 *   label           its name in the editor (the Cover Letter panel names the look its letter takes)
 *   style           the heading style and title case it brings: set when it is picked and on Reset
 *   headerControls  Header Customization's alignment, name/title layout, rule and contact
 *                   controls apply (Modern prints a fixed banner, Sidebar a side panel)
 *   headerRule      it draws the header's bottom rule when a résumé has no `showHeaderBorder`
 *                   (older or imported data; new résumés store `false`): the Classic design
 * Two per-template tables stay with the code that reads them: DEFAULTS in templateSettings.js — the
 * PDF's fallbacks for unset colours, computed from other settings, and Classic's unset heading
 * is 'line', not the 'ruled' that picking Classic sets, so merging them would change what older
 * résumés print — and TEMPLATE_SECTION_DEFAULTS (templateSectionDefaults.js), per section type.
 */
const TEMPLATES = {
  classic:   { label: 'Classic',   style: { headingStyle: 'ruled',     sectionTitleCase: 'upper' },  headerControls: true,  headerRule: true },
  modern:    { label: 'Modern',    style: { headingStyle: 'line',      sectionTitleCase: 'upper' },  headerControls: false, headerRule: false },
  minimal:   { label: 'Minimal',   style: { headingStyle: 'underline', sectionTitleCase: 'upper' },  headerControls: true,  headerRule: false },
  executive: { label: 'Executive', style: { headingStyle: 'underline', sectionTitleCase: 'normal' }, headerControls: true,  headerRule: false },
  sidebar:   { label: 'Sidebar',   style: { headingStyle: 'plain',     sectionTitleCase: 'upper' },  headerControls: false, headerRule: false },
};

/** Every template the app offers (the Design panel lists these five). */
export const TEMPLATE_IDS = Object.keys(TEMPLATES);

/**
 * The template a résumé prints with: its own when the app offers it, else Classic — what the
 * PDF has always drawn for an id it does not know (the old seed's 'dark', a missing id, an
 * id from an imported file).
 */
export const templateId = (template) => (TEMPLATE_IDS.includes(template) ? template : 'classic');

/** The template's name as the editor shows it ("Classic" for an id the app does not offer). */
export const templateLabel = (template) => TEMPLATES[templateId(template)].label;

/** The heading style and title case a template brings: set when it is picked and on Reset. */
export const templateStyleDefaults = (template) => ({ ...TEMPLATES[templateId(template)].style });

/**
 * `resume` with a template the app offers, so the Design panel shows it selected and every
 * control reads the template the PDF prints. normalizeResume() applies it wherever résumés come
 * in: load, import, cloud sync, restore. The same object when nothing changes.
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
