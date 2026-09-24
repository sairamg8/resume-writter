import { SECTION_TYPE_DEFAULTS } from '../../../utils/defaultDataSectionTypes.js';

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

  timeline: {
    // Unset, a job on the Timeline's rail reads: its date, then "Role  Company" side by side (two
    // runs), then its location. Line 2 holds both, so a parser that gives a job without bullets a
    // 2-line header still reads the company (Stacked puts it on line 3); Inline would join the two
    // into one run (PdfTimeline.jsx). Volunteering is laid out the same way.
    experience:   { titleOrder: 'role', titleStyle: 'sidebyside' },
    volunteering: { titleStyle: 'sidebyside' },
  },

  banner: {
    // Unset, a job leads with the role, bold, its date at the right; the company and location on the
    // line under it (Stacked): the job title is what an ATS indexes first (atsChecker's title order).
    experience: { titleOrder: 'role' },
  },

  academic: {
    // Unset, a post leads with the position, bold, its dates flush right on that line; the
    // institution (italic) and its location on the line under it (Stacked), as a scholarly CV
    // lists appointments — and the job title is what an ATS indexes first (atsChecker's title order).
    experience: { titleOrder: 'role' },
  },

  compact: {
    // Unset, a job leads with the role, bold, its dates flush right; the company and location on the
    // line under it (Stacked) — the experience stays one ATS-exact column. The short sections print in
    // a grid of whole items, two to a row: a skill group (its category next to its skills), a
    // certification, an award, a language, a reference. Grids is still theirs to change; a section that
    // stores the Grids it was created with takes these on a switch (gridsOnSwitch).
    experience:     { titleOrder: 'role' },
    skills:         { columns: 2 },
    certifications: { columns: 2 },
    awards:         { columns: 2 },
    languages:      { columns: 2 },
    references:     { columns: 2 },
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

/** The Grids a new section of `type` stores (SECTION_TYPE_DEFAULTS), or undefined where it stores none. */
const createdColumns = (type) => (SECTION_TYPE_DEFAULTS[type] || SECTION_TYPE_DEFAULTS.custom)('grid').settings.columns;

/**
 * A section's Grids for template `to`, coming from `from`: every section is created storing a Grids
 * (SECTION_TYPE_DEFAULTS: 1, 2 for Languages and References), so a template's own (Compact's grid,
 * TEMPLATE_SECTION_DEFAULTS) would never print. Where `to` lays the section's type out in its own
 * and the section still holds the Grids it was created with, or the one `from` brought, the stored
 * value is dropped and `to`'s prints (resolveSection); where `from` brought one `to` does not and the
 * section still holds it, it is dropped too and the section prints as it was created. A Grids the
 * user picked stays theirs — as styleOnSwitch treats the design settings (T8). The same section when
 * nothing changes.
 */
export function sectionGridOnSwitch(section, from, to) {
  const was = TEMPLATE_SECTION_DEFAULTS[from]?.[section?.type]?.columns;
  const next = TEMPLATE_SECTION_DEFAULTS[to]?.[section?.type]?.columns;
  const stored = section?.settings?.columns;
  if (was === next || stored == null) return section;
  if (stored !== was && (next === undefined || stored !== createdColumns(section.type))) return section;
  const settings = { ...section.settings };
  delete settings.columns;
  return { ...section, settings };
}

/** `sections` on a switch from `from` to `to` (useResumeStore.setTemplate): sectionGridOnSwitch on each; the same array when none changes. */
export function sectionsOnSwitch(sections, from, to) {
  if (!Array.isArray(sections)) return sections;
  const out = sections.map((s) => sectionGridOnSwitch(s, from, to));
  return out.some((s, i) => s !== sections[i]) ? out : sections;
}

/** A section as it is created (SECTION_TYPE_DEFAULTS) on `template`: in the template's own Grids where it has one. */
export const newSectionGrid = (section, template) => sectionGridOnSwitch(section, null, template);
