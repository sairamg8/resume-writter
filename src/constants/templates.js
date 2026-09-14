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

/**
 * `resume` with a template the app offers, so the Design panel shows it selected and every
 * control reads the template the PDF prints. Applied wherever résumés come in: load, import,
 * cloud sync, restore. The same object when nothing changes.
 */
export function withKnownTemplate(resume) {
  if (!resume || resume.template === templateId(resume.template)) return resume;
  return { ...resume, template: templateId(resume.template) };
}

/**
 * Templates whose header takes Header Customization's alignment, name/title layout, rule and
 * contact controls. Modern prints a fixed banner, Sidebar a side panel.
 */
const HEADER_CONTROL_TEMPLATES = ['classic', 'minimal', 'executive'];

export const hasHeaderControls = (template) => HEADER_CONTROL_TEMPLATES.includes(templateId(template));

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
