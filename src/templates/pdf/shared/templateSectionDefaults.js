/**
 * Per-template section defaults for PDF rendering.
 *
 * These mirror exactly what each HTML template component uses as its implicit
 * default when the user has not customized that setting. User customizations
 * stored in section.settings always take precedence over these defaults.
 *
 * Only entries that differ from the shared PDF baseline need to be listed.
 * Shared PDF baseline: titleStyle='stacked', titleOrder='company'.
 */
export const TEMPLATE_SECTION_DEFAULTS = {
  classic: {},
  modern:  {},
  minimal: {},

  executive: {
    // Executive HTML hardcodes an inline layout: "Role, Company  date→"
    // and always shows role as the primary/bold field.
    experience:   { titleStyle: 'inline', titleOrder: 'role' },
    education:    { titleStyle: 'inline' },
    volunteering: { titleStyle: 'inline' },
  },

  sidebar: {
    // Sidebar HTML main-column experience always shows role bold (not company).
    // Layout stays stacked — sidebar never uses inline/sidebyside.
    experience: { titleOrder: 'role' },
  },
};

/**
 * Resolves a section's effective settings by merging template-level defaults
 * with user-stored settings. User settings always win.
 *
 * Call this once per section in pdfExportReactPDF before building the element
 * so every template renderer receives fully-resolved section data.
 */
export function resolveSection(section, templateKey) {
  const templateDefaults =
    TEMPLATE_SECTION_DEFAULTS[templateKey]?.[section.type] || {};

  return {
    ...section,
    settings: {
      ...templateDefaults,
      ...(section.settings || {}),
    },
  };
}
