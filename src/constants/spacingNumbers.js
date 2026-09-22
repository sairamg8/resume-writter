// Design → Spacing's five numbers as a résumé stores them: `lineHeightValue` (times the font size),
// `marginV` and `marginH` (mm, pageMargins.js), `sectionGap` and `itemGap` (px). The panel only
// ever writes numbers, but an imported .json, a hand-edited store or a cloud copy can carry
// anything, and the editor and the PDF (= the preview) both read what is stored:
// - a value that is not a number crashed the whole editor as the Spacing section opened (NumberRow's
//   toFixed on "abc", or on a Line Height of "1.8") or showed as "truemm"; the PDF printed a Left /
//   Right margin of "abc" at the paper's edge, and a Between Items of "abc" made the Sidebar's render
//   throw (VF2-3.2-NB1-NB1);
// - a margin past the editor's 40 mm ran the Sidebar column off its dark panel, a margin wider than
//   half the paper made the render throw and a tall one never finished (VF2-3.2-NB1); a Line Height
//   or gap past its control's range printed pages of it (VF2-3.2-NB1-NB1-NB2).
// normalizeResume() runs withSpacingNumbers() wherever résumés come in.
import { MARGIN_MM } from './pageMargins.js';

/** Line Height (times the font size), Between Sections and Between Items (px): the panel's ranges. */
export const LINE_HEIGHT = { min: 1, max: 3 };
export const SECTION_GAP_PX = { min: 0, max: 60 };
export const ITEM_GAP_PX = { min: 0, max: 40 };

/**
 * Each Spacing number's key, and the range a stored one is brought into — its control's, on every
 * build: past it Line Height 50 ran a page to three, Between Sections -200 pulled a section over the
 * header and lost text, 5000 made three pages (VF2-3.2-NB1-NB1-NB2).
 */
const SPACING_NUMBERS = { lineHeightValue: LINE_HEIGHT, marginV: MARGIN_MM, marginH: MARGIN_MM, sectionGap: SECTION_GAP_PX, itemGap: ITEM_GAP_PX };

/**
 * `value` as the number the PDF reads it as: a finite number, or text that is one (" 20 " prints
 * as 20). `undefined` for anything else — "abc", "", "12px", true, {}, NaN.
 */
export function storedNumber(value) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

/**
 * `resume` with each Spacing number stored as a number, whatever its data version (an import of
 * this build's own file can carry anything): text that is a number becomes that number, each is
 * clamped to its control's range, and a value that is no number at all is dropped, so the default prints
 * and the panel shows it, as for a résumé that stores none. None stored (or null) is left: the
 * default prints. The same object when nothing changes; settings that are not an object are left.
 */
export const withSpacingNumbers = (resume) => withStoredNumbers(resume, SPACING_NUMBERS);

/** Section Options → Spacing Override (Before, After, Item gap), CSS px: its inputs' range. */
export const SECTION_OVERRIDE_PX = { min: 0, max: 80 };

/**
 * A section's Spacing Override as the PDF prints it and the panel shows it: a number (or text that
 * is one) clamped into SECTION_OVERRIDE_PX; undefined — none: the section's own spacing — for
 * anything else. Unclamped, a Before of -500 pulled the section over the ones above it and Skills
 * off page 1, an Item gap of -30 printed an entry over the one before it, and 'abc' made the panel
 * log a React error (MISSED A1/A2).
 */
export function sectionOverridePx(value) {
  const n = storedNumber(value);
  return n === undefined ? undefined : Math.min(SECTION_OVERRIDE_PX.max, Math.max(SECTION_OVERRIDE_PX.min, n));
}

/**
 * `resume` with each number `table` names ({ key: { min, max, zeroIsUnset? } | null }) stored as a
 * number: text that is a number becomes it, one with a range is clamped into it, one that is no
 * number is dropped — and so is a 0 the PDF reads as unset (`zeroIsUnset`: `width || 2`), which
 * would otherwise print differently once clamped. None stored (or null) is left. The same object
 * when nothing changes. (designNumbers.js reads it too.)
 */
export function withStoredNumbers(resume, table) {
  const settings = resume?.settings;
  if (!settings || typeof settings !== 'object') return resume;
  let next = null;
  for (const [key, range] of Object.entries(table)) {
    if (settings[key] == null) continue;
    const n = storedNumber(settings[key]);
    const kept = n === undefined || !range ? n : n === 0 && range.zeroIsUnset ? undefined : Math.min(range.max, Math.max(range.min, n));
    if (kept === settings[key]) continue;
    next ??= { ...settings };
    if (kept === undefined) delete next[key]; // dropped, not stored as undefined: Firestore refuses one
    else next[key] = kept;
  }
  return next ? { ...resume, settings: next } : resume;
}
