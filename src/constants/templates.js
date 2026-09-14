// The résumé templates and what their headers offer. Plain data and functions only — the
// editor UI, the store and the PDF code all read it, and it must not pull react-pdf into the
// editor bundle.

/**
 * Templates whose header takes Header Customization's alignment, name/title layout, rule and
 * contact controls. Modern prints a fixed banner, Sidebar a side panel.
 */
const HEADER_CONTROL_TEMPLATES = ['classic', 'minimal', 'executive'];

export const hasHeaderControls = (template) => HEADER_CONTROL_TEMPLATES.includes(template || 'classic');

/**
 * The header's bottom rule when a résumé has no `showHeaderBorder` (older or imported data;
 * new résumés store `false`): the Classic design draws it, Minimal and Executive do not.
 */
const HEADER_BORDER_WHEN_UNSET = { classic: true, minimal: false, executive: false };

/** Is the header rule on? The PDF and the Header Customization toggle both ask this. */
export function headerBorderOn(settings, template) {
  const v = settings?.showHeaderBorder;
  return typeof v === 'boolean' ? v : HEADER_BORDER_WHEN_UNSET[template || 'classic'] === true;
}
