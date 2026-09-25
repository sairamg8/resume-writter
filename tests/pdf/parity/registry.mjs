// Every setting the editor's panels write, and what the parity matrix checks for it — the pinned list
// 00-registry.test.mjs compares with what the walker finds by using the panels. A control that writes a
// key missing here fails the suite until its effect is written down (registry-*.mjs) and it is run by a
// family's test file (FAMILY_FILES); a key here that no panel writes any more fails too.
import { DESIGN } from './registry-design.mjs';
import { HEADER_CONTROLS } from './registry-header.mjs';
import { SECTIONS } from './registry-sections.mjs';

export const REGISTRY = { ...DESIGN, ...HEADER_CONTROLS, ...SECTIONS };

/** The key's entry (undefined for a key the registry does not know: 00-registry fails on it). */
export const spec = (key) => REGISTRY[key];

/** The test file that runs each family's controls. */
export const FAMILY_FILES = {
  colors: '10-colors.test.mjs',
  type: '11-type.test.mjs',
  fonts: '12-fonts.test.mjs',
  spacing: '13-spacing.test.mjs',
  headings: '14-headings-dates.test.mjs',
  dates: '14-headings-dates.test.mjs',
  lists: '17-lists.test.mjs',
  template: '15-template-resets.test.mjs',
  resets: '15-template-resets.test.mjs',
  icons: '16-icons.test.mjs',
  header: '20-header.test.mjs',
  gaps: '21-header-gaps.test.mjs',
  photo: '22-photo-visibility.test.mjs',
  visibility: '22-photo-visibility.test.mjs',
  sections: '30-sections.test.mjs',
  overrides: '31-section-overrides.test.mjs',
};

/** A control's family: a reset's is 'resets', else its first key's. */
export const familyOf = (control) => (control.reset ? 'resets' : spec(control.keys[0])?.family);

/**
 * Defects the matrix found that are filed, not fixed yet: a control's test whose every failure matches
 * one of these is reported as TODO (it still runs, and turns green when the fix lands — then delete the
 * entry). { variant, key (the control's first key), match (a failure line), id (the tracker row) }.
 */
export const KNOWN = [];

/** The filed defects `failures` of `control` on `variant` are all accounted for by: [] when some is not. */
export function knownFor(variant, control, failures) {
  const ids = new Set();
  for (const f of failures) {
    const k = KNOWN.find((x) => x.variant === variant.id && x.key === control.keys[0] && x.match.test(f));
    if (!k) return [];
    ids.add(k.id);
  }
  return [...ids];
}
