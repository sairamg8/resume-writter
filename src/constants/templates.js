// The résumé templates and what their headers offer. Plain data and functions only — the
// editor UI, the store and the PDF code all read it, and it must not pull react-pdf into the
// editor bundle.

/** Every template the app offers (the Design panel lists these five). */
export const TEMPLATE_IDS = ['classic', 'modern', 'minimal', 'executive', 'sidebar'];

/**
 * The template a résumé prints with: its own when the app offers it, else Classic — what the
 * PDF has always drawn for an id it does not know (the old seed's 'dark', a missing id, an
 * id from an imported file).
 */
export const templateId = (template) => (TEMPLATE_IDS.includes(template) ? template : 'classic');

/** The heading style and title case each template brings: set when it is picked and on Reset. */
const TEMPLATE_STYLE_DEFAULTS = {
  executive: { headingStyle: 'underline', sectionTitleCase: 'normal' },
  classic:   { headingStyle: 'ruled',     sectionTitleCase: 'upper' },
  modern:    { headingStyle: 'line',      sectionTitleCase: 'upper' },
  minimal:   { headingStyle: 'underline', sectionTitleCase: 'upper' },
  sidebar:   { headingStyle: 'plain',     sectionTitleCase: 'upper' },
};

export const templateStyleDefaults = (template) => ({ ...TEMPLATE_STYLE_DEFAULTS[templateId(template)] });

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
 * Templates whose header takes Header Customization's alignment, name/title layout, rule and
 * contact controls. Modern prints a fixed banner, Sidebar a side panel.
 */
const HEADER_CONTROL_TEMPLATES = ['classic', 'minimal', 'executive'];

export const hasHeaderControls = (template) => HEADER_CONTROL_TEMPLATES.includes(templateId(template));

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

/** Text Position as a flex alignment for the photo's row (Center when unset). */
export const photoTextAlignItems = (settings) =>
  ({ top: 'flex-start', bottom: 'flex-end' })[settings?.photoTextAlign] || 'center';

/**
 * The header's bottom rule when a résumé has no `showHeaderBorder` (older or imported data;
 * new résumés store `false`): the Classic design draws it, Minimal and Executive do not.
 */
const HEADER_BORDER_WHEN_UNSET = { classic: true, minimal: false, executive: false };

/** Is the header rule on? The PDF and the Header Customization toggle both ask this. */
export function headerBorderOn(settings, template) {
  const v = settings?.showHeaderBorder;
  return typeof v === 'boolean' ? v : HEADER_BORDER_WHEN_UNSET[templateId(template)] === true;
}
