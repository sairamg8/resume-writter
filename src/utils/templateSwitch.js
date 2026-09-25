// Design → a template or a design (R2-138): the résumé after it is picked. One function for the store
// (useResumeStore.setTemplate) and the tests that walk the panels, so both switch the same way.
import { templateId } from '@/constants/templates';
import { presetOf, withOwnDesign } from '@/constants/templatePresets';
import { styleOnSwitch } from '@/utils/defaultData';
import { HEADER_READS, headerColorsOnSwitch, withHeaderColorsBack } from '@/templates/pdf/shared/headerColors';
import { sectionsOnSwitch } from '@/templates/pdf/shared/templateSectionDefaults';

/**
 * `r` on `template`, and on the design `preset` where one is named (its engine is `template`):
 * the style they bring (styleOnSwitch: the heading style and title case, a design's whole look —
 * and what the old template or design brought leaving with it where the user kept it), a Name or
 * Job title colour that does not read on the new header back to its own (NB-1: on a template
 * switch, one that reads worse there than it did; a design repaints the header, so any that does
 * not read), and a section's Grids its template's own where it kept the one it was created with
 * (sectionsOnSwitch). The template and design it is on already is no switch — picking it again
 * would put back the heading style and title case the user changed since (R2-087): the same `r`.
 */
export function withTemplate(r, template, preset = '') {
  const to = presetOf({ templatePreset: preset, myDesigns: r.settings?.myDesigns }, template) ? preset : '';
  if (templateId(r.template) === templateId(template) && (presetOf(r.settings, r.template)?.id || '') === to) return r;
  const styled = styleOnSwitch(r.settings, r.template, template, to);
  return {
    ...r,
    template,
    settings: to ? withHeaderColorsBack(styled, template, { below: HEADER_READS }) : headerColorsOnSwitch(styled, r.template, template),
    sections: sectionsOnSwitch(r.sections, r.template, template),
  };
}

/**
 * `r` on a picker card's look (utils/templatePicker.js): its template or design — a design the user saved
 * (`design`) joins the résumé's own first, so it travels with it (B4) — and the Layout the card sets
 * (`variant`, the Sidebar's single column, A9), whose Name and Job title colours are checked against
 * the ground it prints as a Layout change checks them (useResumeStore.updateSetting).
 */
export function withLook(r, { engine, preset = '', variant = null, design = null } = {}) {
  const own = design && preset ? { ...r, settings: withOwnDesign(r.settings, preset, design) } : r;
  const out = withTemplate(own, engine, preset);
  if (!variant) return out;
  const settings = { ...out.settings, ...variant };
  return { ...out, settings: withHeaderColorsBack(settings, out.template, { below: HEADER_READS }) };
}

/**
 * What a template switch can change of `r` (withTemplate): its template, its settings and each
 * section's own settings (a Grid the new template lays out) — kept so the switch can be undone (A4).
 */
export const designSnapshot = (r) => ({
  id: r.id,
  template: r.template,
  settings: r.settings,
  sections: (r.sections || []).map((s) => ({ id: s.id, has: Object.hasOwn(s, 'settings'), settings: s.settings })),
});

/**
 * `r` as `snap` (designSnapshot) had it: the template, the settings and each section's settings — its
 * content as it is now, typed since or not, and the designs saved since kept (B4). A section added since
 * keeps its own; one deleted since stays deleted. Another résumé than the one it was taken of: `r` itself.
 */
export function withDesignSnapshot(r, snap) {
  // Only the résumé it was taken of: the Undo of a switch outlives a résumé opened meanwhile (an import).
  if (snap.id !== undefined && r.id !== snap.id) return r;
  const was = new Map(snap.sections.map((s) => [s.id, s]));
  const sections = (r.sections || []).map((s) => {
    const w = was.get(s.id);
    if (!w) return s;
    if (w.has) return s.settings === w.settings ? s : { ...s, settings: w.settings };
    if (!Object.hasOwn(s, 'settings')) return s;
    const { settings: _gone, ...rest } = s;
    return rest;
  });
  const mine = r.settings?.myDesigns;
  const settings = mine ? { ...snap.settings, myDesigns: mine } : snap.settings;
  return { ...r, template: snap.template, settings, sections };
}
