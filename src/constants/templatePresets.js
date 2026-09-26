// Design → Template's designs (R2-138, B1): named looks, each over a template the app already draws — its
// engine — with a bundle of design settings (font, colours, heading style, header, spacing). Plain data and
// functions only, like ./templates.js: the editor, the store, the importers and the tests all read it.
//
// A design writes only résumé settings, never a section's own (an entry layout the user chose stays
// theirs), and records its id in `settings.templatePreset` so the picker marks it; picking a plain template
// clears it. Every design goes through the ATS battery on every reader (tests/pdf/42-ats-fields.test.mjs),
// its name and job title must read on its header (tests/pdf/93-template-presets.test.mjs), and its badge is
// atsRating over its engine and settings — so a design cannot claim what its page does not print.

import { offersTemplate, templateId, templateStyleDefaults } from './templates.js';

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
 * A design the user saved (B4): `settings.myDesigns[id]`, a { label, engine, settings } of their own look,
 * where it is one — a name, a template the app offers and a map of settings. The résumé carries the
 * designs it was saved on or picked from, so the design it is on syncs, backs up and exports with it.
 */
export function ownDesign(settings, id) {
  const d = settings?.myDesigns;
  const own = d && typeof d === 'object' && typeof id === 'string' && Object.hasOwn(d, id) ? d[id] : null;
  const valid = own && typeof own === 'object' && typeof own.label === 'string' && offersTemplate(own.engine)
    && own.settings && typeof own.settings === 'object' && !Array.isArray(own.settings);
  return valid ? own : null;
}

/**
 * The design a résumé on `template` with `settings` is on: `settings.templatePreset` where it names a
 * design — one of the app's, else one the user saved (ownDesign) — whose engine is the template the
 * résumé prints — { id, ...preset } — else null. A design left on another template (an imported file,
 * an older build) is none.
 */
export function presetOf(settings, template) {
  const id = settings?.templatePreset;
  if (typeof id !== 'string') return null;
  const p = Object.hasOwn(TEMPLATE_PRESETS, id) ? TEMPLATE_PRESETS[id] : ownDesign(settings, id);
  return p && templateId(p.engine) === templateId(template) ? { id, ...p } : null;
}

/**
 * The design settings a résumé on `template` takes from its template and its design (presetOf): the
 * template's style (templateStyleDefaults), the design's settings over it. What a switch brings and takes
 * away (styleOnSwitch) and what Reset returns to (defaultSettings).
 */
export const designStyle = (template, settings) => ({ ...templateStyleDefaults(template), ...presetOf(settings, template)?.settings });

/** A design's settings as the résumé stores them once it is picked: its own, and its id. */
export const presetSettings = (id) => (Object.hasOwn(TEMPLATE_PRESETS, id) ? { ...TEMPLATE_PRESETS[id].settings, templatePreset: id } : {});

// What of a résumé's settings is its look, for a design the user saves (B4): everything but the contact
// icons they uploaded (their own images), the paper (where the résumé is sent, kept by Reset too), the
// language (what the résumé is written in, R2-148: a design saved from an Arabic résumé turned an English
// one's page right to left), and the design bookkeeping itself. Only plain values: a look is font, colour, size and layout choices —
// and null, which is one: Job Title's size and Title Spacing unset print their own (R2-146), so a
// design saved with them unset brings them unset.
const NOT_A_LOOK = ['customContactIcons', 'pageSize', 'language', 'templatePreset', 'myDesigns'];

/** The look `settings` print: what a design saved from them brings (ownDesign). */
export function designLook(settings) {
  return Object.fromEntries(Object.entries(settings || {}).filter(([k, v]) => !NOT_A_LOOK.includes(k)
    && (v === null || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)))));
}

/** `settings` holding the design `id` the user saved (`design`: { label, engine, settings }). */
export const withOwnDesign = (settings, id, design) => ({
  ...settings,
  myDesigns: { ...(ownDesignsOf(settings)), [id]: { label: design.label, engine: templateId(design.engine), settings: designLook(design.settings) } },
});

/** The designs `settings` hold, as stored — a map by id (none: {}). */
function ownDesignsOf(settings) {
  const d = settings?.myDesigns;
  return d && typeof d === 'object' && !Array.isArray(d) ? d : {};
}

/**
 * Every design the user saved, across `resumes` (each carries the ones it was saved on or picked from):
 * [{ id, label, engine, settings }], one per id, by name. The picker lists them with the app's designs.
 */
export function savedDesigns(resumes) {
  const byId = new Map();
  for (const r of resumes || []) {
    for (const id of Object.keys(ownDesignsOf(r?.settings))) {
      const d = ownDesign(r.settings, id);
      if (d && !byId.has(id) && !Object.hasOwn(TEMPLATE_PRESETS, id)) byId.set(id, { id, ...d });
    }
  }
  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** `settings` without the saved design `id`: gone from its designs, and no longer the one it is on (its look stays). */
export function withoutOwnDesign(settings, id) {
  const mine = ownDesignsOf(settings);
  if (!Object.hasOwn(mine, id) && settings?.templatePreset !== id) return settings;
  const out = { ...settings, myDesigns: Object.fromEntries(Object.entries(mine).filter(([k]) => k !== id)) };
  if (out.templatePreset === id) delete out.templatePreset;
  return out;
}
