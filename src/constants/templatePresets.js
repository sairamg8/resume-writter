// Design → Template's designs (R2-138, B1): named looks, each over a template the app already draws — its
// engine — with a bundle of design settings (font, colours, heading style, header, spacing). Plain data and
// functions only, like ./templates.js: the editor, the store, the importers and the tests all read it.
//
// A design writes only résumé settings, never a section's own (an entry layout the user chose stays
// theirs), and records its id in `settings.templatePreset` so the picker marks it; picking a plain template
// clears it. Every design goes through the ATS battery on every reader (tests/pdf/42-ats-fields.test.mjs),
// its name and job title must read on its header (tests/pdf/93-template-presets.test.mjs), and its badge is
// atsRating over its engine and settings — so a design cannot claim what its page does not print.

import { templateId, templateStyleDefaults } from './templates.js';

/**
 * Every design, in the order the picker lists them:
 *   label, desc   its name and one line saying what it looks like
 *   engine        the template that draws it (TEMPLATES in ./templateTable.js)
 *   settings      the design settings it sets when picked, over the engine's own style (styleOnSwitch)
 */
export const TEMPLATE_PRESETS = {
  harbor: {
    label: 'Harbor', engine: 'classic', desc: 'Classic in IBM Plex Sans · Navy left-bar headings under a heavy rule',
    settings: {
      font: 'ibmplexsans', accentColor: '#0f4c81', textColor: '#1f2937', headingStyle: 'leftbar', sectionTitleCase: 'upper',
      showHeaderBorder: true, headerBorderWidth: 3,
    },
  },
  ledger: {
    label: 'Ledger', engine: 'classic', desc: 'Centred PT Serif header · Title-case headings with a rust line after',
    settings: {
      font: 'ptserif', accentColor: '#7c2d12', textColor: '#1c1917', headingStyle: 'line', sectionTitleCase: 'normal',
      headerAlign: 'center', lineHeightValue: 1.4,
    },
  },
  nordic: {
    label: 'Nordic', engine: 'minimal', desc: 'Minimal in Lato · A large name, teal plain headings, wide margins',
    settings: {
      font: 'lato', accentColor: '#0e7490', textColor: '#0f172a', headingStyle: 'plain', sectionTitleCase: 'upper',
      fontSizeNameDelta: 12, sectionGap: 22, marginH: 22, marginV: 18,
    },
  },
  crimson: {
    label: 'Crimson', engine: 'executive', desc: 'Executive in Gelasio serif · Centred header, crimson boxed headings',
    settings: {
      font: 'georgia', accentColor: '#9f1239', textColor: '#1f1f1f', headingStyle: 'box', sectionTitleCase: 'upper',
      headerAlign: 'center',
    },
  },
  midnight: {
    label: 'Midnight', engine: 'modern', desc: 'Modern in Roboto · A near-black banner, left-bar headings',
    settings: {
      font: 'roboto', accentColor: '#0f172a', textColor: '#111827', headingStyle: 'leftbar', sectionTitleCase: 'upper',
    },
  },
  sunrise: {
    label: 'Sunrise', engine: 'banner', desc: 'Banner in Fira Sans · A burnt-orange band, underlined title-case headings',
    settings: {
      font: 'firasans', accentColor: '#c2410c', textColor: '#1c1917', headingStyle: 'underline', sectionTitleCase: 'normal',
    },
  },
  grove: {
    label: 'Grove', engine: 'timeline', desc: 'Timeline in Source Sans 3 · A green rail, underlined title-case headings',
    settings: {
      font: 'sourcesans', accentColor: '#15803d', textColor: '#1a1a1a', headingStyle: 'underline', sectionTitleCase: 'normal',
      lineHeightValue: 1.35,
    },
  },
  inkwell: {
    label: 'Inkwell', engine: 'compact', desc: 'Compact in Inter · Red left-bar headings, one dense page',
    settings: {
      font: 'inter', accentColor: '#b91c1c', textColor: '#111111', headingStyle: 'leftbar', sectionTitleCase: 'upper',
    },
  },
};

/** Every design's id, in the picker's order. */
export const PRESET_IDS = Object.keys(TEMPLATE_PRESETS);

/**
 * The design a résumé on `template` with `settings` is on: `settings.templatePreset` where it names a
 * design whose engine is the template the résumé prints — { id, ...preset } — else null. A design left
 * on another template (an imported file, an older build) is none.
 */
export function presetOf(settings, template) {
  const id = settings?.templatePreset;
  if (typeof id !== 'string' || !Object.hasOwn(TEMPLATE_PRESETS, id)) return null;
  const p = TEMPLATE_PRESETS[id];
  return p.engine === templateId(template) ? { id, ...p } : null;
}

/**
 * The design settings a résumé on `template` takes from its template and its design (presetOf): the
 * template's style (templateStyleDefaults), the design's settings over it. What a switch brings and takes
 * away (styleOnSwitch) and what Reset returns to (defaultSettings).
 */
export const designStyle = (template, settings) => ({ ...templateStyleDefaults(template), ...presetOf(settings, template)?.settings });

/** A design's settings as the résumé stores them once it is picked: its own, and its id. */
export const presetSettings = (id) => (Object.hasOwn(TEMPLATE_PRESETS, id) ? { ...TEMPLATE_PRESETS[id].settings, templatePreset: id } : {});
