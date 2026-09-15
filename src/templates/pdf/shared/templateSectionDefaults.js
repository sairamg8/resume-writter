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
    // Unset, Executive prints its entries inline, "Role, Company  date→", the role bold first.
    experience:   { titleStyle: 'inline', titleOrder: 'role' },
    education:    { titleStyle: 'inline' },
    volunteering: { titleStyle: 'inline' },
  },

  sidebar: {
    // Unset, the Sidebar's main-column experience cards lead with the role, bold. Title
    // "Inline" and "Side by side" print there too (27277e0); unset stays Stacked.
    experience: { titleOrder: 'role' },
  },
};

/**
 * Resolves a section's effective settings by merging template-level defaults
 * with user-stored settings. User settings always win; a stored null, undefined or ''
 * (imported data) is no choice, so the template's default applies — the renderers read the
 * resolved value and keep no default of their own that could disagree with it (R6-5).
 *
 * pdfExportReactPDF and wordExport call this once per section before building the
 * document; SectionCustomizer calls it so each control shows the effective value.
 */
export function resolveSection(section, templateKey) {
  const templateDefaults =
    TEMPLATE_SECTION_DEFAULTS[templateKey]?.[section.type] || {};
  const chosen = Object.fromEntries(
    Object.entries(section.settings || {}).filter(([, value]) => value != null && value !== ''),
  );

  return {
    ...section,
    settings: {
      ...templateDefaults,
      ...chosen,
    },
  };
}
