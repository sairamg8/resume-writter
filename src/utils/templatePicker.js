// Design → Template's cards, built from the data — never listed by hand (R2-139): every template in
// TEMPLATE_PICKER (a template added to the table is a card, in its category, with no change here), the
// second card of a template whose Layout is a page of its own (the Sidebar's single column, A9), the
// app's designs (TEMPLATE_PRESETS) and the designs the user saved (B4). The panel's list, the gallery,
// its filter chips and the new-résumé picker all read these.
import { atsRating, headerTemplateId, templateDesc, TEMPLATE_PICKER, templateStyleDefaults } from '@/constants/templates';
import { TEMPLATES } from '@/constants/templateTable';
import { PRESET_IDS, TEMPLATE_PRESETS } from '@/constants/templatePresets';
import { FONTS } from '@/utils/fonts';

/** The gallery's categories (B3), in chip order; a template names one in the table (none: Simple). */
export const PICKER_CATEGORIES = [
  { id: 'simple', label: 'Simple' },
  { id: 'professional', label: 'Professional' },
  { id: 'modern', label: 'Modern' },
  { id: 'creative', label: 'Creative' },
  { id: 'compact', label: 'Compact' },
  { id: 'mine', label: 'My designs' },
];

/** The gallery's filter chips (A3): what the page prints, each true or false of a card. */
export const PICKER_FILTERS = [
  { id: 'ats', label: 'ATS-safe', test: (c) => c.ats },
  { id: 'one', label: 'One column', test: (c) => c.columns === 1 },
  { id: 'two', label: 'Two columns', test: (c) => c.columns === 2 },
  { id: 'colour', label: 'Colour header', test: (c) => c.colourHeader },
  { id: 'serif', label: 'Serif', test: (c) => c.serif },
];

const SERIF = new Set(FONTS.filter((f) => f.category === 'serif').map((f) => f.id));

/**
 * What a card's page prints, from the table: the page its Layout prints (the Sidebar's single column is
 * Classic's, headerTemplateId), how many columns, a coloured header ground, a serif face, its ATS badge.
 */
function traits(engine, settings) {
  const page = TEMPLATES[headerTemplateId(engine, settings)];
  return {
    ats: atsRating(engine, settings).safe,
    columns: page.columns === 2 ? 2 : 1,
    colourHeader: Boolean(page.colourHeader),
    serif: SERIF.has(settings.font || 'notosans'),
  };
}

/**
 * Every card, in the picker's order, for a résumé with `settings`, and `mine` — the designs the user
 * saved ([{ id, label, engine, settings }], savedDesigns):
 *   testid              template-<id> (template-sidebar-single for a Layout's card), preset-<id>, design-<id>
 *   engine, preset      what picking it switches to (setTemplate(engine, preset)); `own` for a saved design
 *   variant             { key: value } the card sets besides (the Sidebar's Layout), or null
 *   look                the settings its page prints with, over the résumé's (its thumbnail's)
 *   label, desc, category, accent, and traits(): ats, columns, colourHeader, serif
 */
export function pickerCards(settings = {}, mine = []) {
  const cards = [];
  for (const t of TEMPLATE_PICKER) {
    const row = TEMPLATES[t.id];
    const base = { engine: t.id, preset: '', own: false, category: row.category || 'simple', accent: settings.accentColor };
    // A Layout that is a page of its own is two cards: each one sets it (A9).
    const layouts = row.variant ? [false, true] : [null];
    for (const on of layouts) {
      const variant = on === null ? null : { [row.variant.key]: on };
      const look = { ...settings, ...templateStyleDefaults(t.id), ...variant };
      cards.push({
        ...base, variant, look,
        testid: on ? `template-${t.id}-single` : `template-${t.id}`,
        label: on ? row.variant.label : t.label,
        desc: templateDesc(t.id, look),
        ...traits(t.id, look),
      });
    }
  }
  for (const id of PRESET_IDS) {
    const p = TEMPLATE_PRESETS[id];
    const look = { ...settings, ...templateStyleDefaults(p.engine), ...p.settings };
    cards.push({
      testid: `preset-${id}`, engine: p.engine, preset: id, own: false, variant: null, look,
      label: p.label, desc: p.desc, category: p.category || TEMPLATES[p.engine].category || 'simple', accent: p.settings.accentColor,
      ...traits(p.engine, look),
    });
  }
  for (const d of mine) {
    const look = { ...settings, ...templateStyleDefaults(d.engine), ...d.settings };
    cards.push({
      testid: `design-${d.id}`, engine: d.engine, preset: d.id, own: true, design: d, variant: null, look,
      label: d.label, desc: `Your design · ${TEMPLATES[d.engine].label}`, category: 'mine', accent: d.settings.accentColor || settings.accentColor,
      ...traits(d.engine, look),
    });
  }
  return cards;
}

/**
 * Is `card` the one the résumé is on — its template, its design (none for a plain template) and, for a
 * Layout's card, its Layout?
 */
export function cardSelected(card, template, activePreset, settings = {}) {
  if (card.engine !== template || card.preset !== activePreset) return false;
  return !card.variant || Object.entries(card.variant).every(([k, v]) => Boolean(settings[k]) === v);
}

/** The cards in `category` (none: all) that pass every filter chip in `filters`. */
export function filterCards(cards, { category = '', filters = [] } = {}) {
  const tests = PICKER_FILTERS.filter((f) => filters.includes(f.id));
  return cards.filter((c) => (!category || c.category === category) && tests.every((f) => f.test(c)));
}

/**
 * The categories that have a card, in chip order: a category nothing is in offers no chip, and one a
 * template names that is not listed above ('photo', say) gets a chip of its own, before My designs.
 */
export function categoriesOf(cards) {
  const used = new Set(cards.map((c) => c.category));
  const known = PICKER_CATEGORIES.filter((c) => used.has(c.id));
  const other = [...used].filter((id) => id && !PICKER_CATEGORIES.some((c) => c.id === id))
    .map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1) }));
  const mine = known.filter((c) => c.id === 'mine');
  return [...known.filter((c) => c.id !== 'mine'), ...other, ...mine];
}
