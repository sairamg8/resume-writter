// Design → Spacing's five numbers as a résumé stores them: `lineHeightValue` (times the font size),
// `marginV` and `marginH` (mm, pageMargins.js), `sectionGap` and `itemGap` (px). The panel only
// ever writes numbers, but an imported .json, a hand-edited store or a cloud copy can carry
// anything, and the editor and the PDF (= the preview) both read what is stored:
// - a value that is not a number crashed the whole editor as the Spacing section opened (NumberRow's
//   toFixed on "abc", or on a Line Height of "1.8") or showed as "truemm"; the PDF printed a Left /
//   Right margin of "abc" at the paper's edge, and a Between Items of "abc" made the Sidebar's render
//   throw (VF2-3.2-NB1-NB1);
// - a margin past the editor's 40 mm ran the Sidebar column off its dark panel, a margin wider than
//   half the paper made the render throw and a tall one never finished (VF2-3.2-NB1).
// normalizeResume() runs withSpacingNumbers() wherever résumés come in.
import { MARGIN_MM } from './pageMargins.js';

/** Each Spacing number's key, and the range a stored one is brought into: the margins' alone. */
const SPACING_NUMBERS = { lineHeightValue: null, marginV: MARGIN_MM, marginH: MARGIN_MM, sectionGap: null, itemGap: null };

/**
 * `value` as the number the PDF reads it as: a finite number, or text that is one (" 20 " prints
 * as 20). `undefined` for anything else — "abc", "", "12px", true, {}, NaN.
 */
function storedNumber(value) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

/**
 * `resume` with each Spacing number stored as a number, whatever its data version (an import of
 * this build's own file can carry anything): text that is a number becomes that number, a margin
 * is clamped to MARGIN_MM, and a value that is no number at all is dropped, so the default prints
 * and the panel shows it, as for a résumé that stores none. None stored (or null) is left: the
 * default prints. The same object when nothing changes; settings that are not an object are left.
 */
export function withSpacingNumbers(resume) {
  const settings = resume?.settings;
  if (!settings || typeof settings !== 'object') return resume;
  let next = null;
  for (const [key, range] of Object.entries(SPACING_NUMBERS)) {
    if (settings[key] == null) continue;
    const n = storedNumber(settings[key]);
    const kept = n === undefined || !range ? n : Math.min(range.max, Math.max(range.min, n));
    if (kept === settings[key]) continue;
    next ??= { ...settings };
    if (kept === undefined) delete next[key]; // dropped, not stored as undefined: Firestore refuses one
    else next[key] = kept;
  }
  return next ? { ...resume, settings: next } : resume;
}
