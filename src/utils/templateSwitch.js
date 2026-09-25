// Design → a template or a design (R2-138): the résumé after it is picked. One function for the store
// (useResumeStore.setTemplate) and the tests that walk the panels, so both switch the same way.
import { templateId } from '@/constants/templates';
import { presetOf } from '@/constants/templatePresets';
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
  const to = presetOf({ templatePreset: preset }, template) ? preset : '';
  if (templateId(r.template) === templateId(template) && (presetOf(r.settings, r.template)?.id || '') === to) return r;
  const styled = styleOnSwitch(r.settings, r.template, template, to);
  return {
    ...r,
    template,
    settings: to ? withHeaderColorsBack(styled, template, { below: HEADER_READS }) : headerColorsOnSwitch(styled, r.template, template),
    sections: sectionsOnSwitch(r.sections, r.template, template),
  };
}
