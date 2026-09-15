/**
 * Per-template section defaults: what a template prints for a setting the user has not
 * chosen. User customizations stored in section.settings always take precedence.
 *
 * Plain data (no react-pdf): the PDF, the Word export and the section editor's controls all
 * read it through resolveSection(), so a control shows what the PDF prints (FIDA-58).
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
 * pdfExportReactPDF and wordExport call this once per section before building the
 * document; SectionCustomizer calls it so each control shows the effective value.
 */
export function resolveSection(section, templateKey) {
  const templateDefaults =
    TEMPLATE_SECTION_DEFAULTS[templateKey]?.[section.type] || {};

  return {
    ...section,
    settings: {
      ...templateDefaults,
      ...section.settings,
    },
  };
}
