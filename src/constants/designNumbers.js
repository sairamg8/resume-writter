// The Design panel's numbers as a résumé stores them — the panel only ever writes numbers in its
// controls' ranges, but an imported .json, a hand-edited store or a cloud copy can carry anything,
// and the editor and the PDF (= the preview) both read what is stored. normalizeResume() runs
// withDesignNumbers() wherever résumés come in: Design → Spacing's numbers (spacingNumbers.js) and
// the ones below, each stored as a number in its control's range or dropped so the default prints.
import { HEADER_GAPS } from './headerSpacing.js';
import { withSpacingNumbers, withStoredNumbers } from './spacingNumbers.js';

/**
 * Section Headings → Border thickness, pt: the panel sets 1–8 (DesignPanelHeadings.jsx). Unchecked,
 * "abc" made Ruled and Left bar throw (no preview, no PDF), "3" printed a 32 pt bar ("3" + 2) and 0
 * an invisible rule (ONB-12-NB2).
 */
export const SECTION_BORDER_PT = { min: 1, max: 8 };

/**
 * Header Customization → Header Bottom Border's Thickness, pt: the panel sets 1–12
 * (PersonalInfoEditorHeader.jsx). Unchecked, 50 printed a 50 pt rule under the header and its
 * letter's, and -3 or "abc" none with the border on (FIDB-51-VF3-NB1). Every build prints a 0 as
 * the 2 pt default (`headerBorderWidth || 2`): it is dropped, not clamped to 1.
 */
export const HEADER_BORDER_PT = { min: 1, max: 12, zeroIsUnset: true };


/**
 * Design → Typography: Base 8–16 pt and Contact Icons 9–20 px, stored as set. Unchecked, "abc"
 * dropped the PDF's text, "12" printed 128 pt ("12" + 8) and 50 ran pages of it (VF2-3.2-NB1-NB1-NB1).
 * Contact Icons starts at 9 px: most templates never print an icon under 7 pt, so 8 px (6 pt) printed
 * what 9 px (6.75 pt) prints — a step that changed nothing (R2-123). A stored 8 is brought to 9,
 * which prints the same there.
 */
export const FONT_SIZE_BASE = { min: 8, max: 16 };
export const ICON_SIZE = { min: 9, max: 20 };

/**
 * Design → Typography → Title Spacing: the section titles' letter-spacing, in % of the title's size
 * (R2-146). Up to 6 %: wider, ATS parsers read the letters apart (pdfUnits.js MAX_TRACKING_EM), so
 * every value offered prints differently. Unset prints the 0.7 pt every title always had
 * (sectionHeadingLook.js titleTracking); Word prints what the PDF does.
 */
export const SECTION_LETTER_SPACING = { min: -4, max: 6 };

/** The base a résumé that stores none prints at (defaultData.js, every PDF's `?? 11`). */
const DEFAULT_FONT_SIZE_BASE = 11;

/**
 * Full Name, Section Title and Entry Header: stored as deltas added to the base, but their rows offer
 * the size that prints — Full Name from the base to 36 pt, the other two 6–24 pt. A delta in range for
 * one base is not for another: base 8 with a Section Title delta of -10 printed -2 pt headings, and
 * base 16 with a Full Name delta of 28 a 44 pt name, so each is clamped against its résumé's base.
 */
export const TYPE_SIZE_PT = {
  fontSizeNameDelta: (base) => ({ min: base, max: 36 }),
  fontSizeSectionDelta: () => ({ min: 6, max: 24 }),
  fontSizeEntryDelta: () => ({ min: 6, max: 24 }),
  // Job Title (R2-146): unset (null), the title prints at Entry Header's size, as it always had.
  fontSizeTitleDelta: () => ({ min: 6, max: 24 }),
};

/** `delta` (a number) for `key` moved so that `base` + it prints within that row's range. */
export function deltaInRange(key, delta, base) {
  const { min, max } = TYPE_SIZE_PT[key](base);
  return Math.min(max - base, Math.max(min - base, delta));
}

/** `resume` with each stored size delta clamped against its base (see TYPE_SIZE_PT). */
function withTypeSizes(resume) {
  const settings = resume?.settings;
  if (!settings || typeof settings !== 'object') return resume;
  const base = settings.fontSizeBase ?? DEFAULT_FONT_SIZE_BASE;
  let next = null;
  for (const key of Object.keys(TYPE_SIZE_PT)) {
    if (typeof settings[key] !== 'number') continue;
    const kept = deltaInRange(key, settings[key], base);
    if (kept === settings[key]) continue;
    next ??= { ...settings };
    next[key] = kept;
  }
  return next ? { ...resume, settings: next } : resume;
}

const DESIGN_NUMBERS = {
  fontSizeBase: FONT_SIZE_BASE,
  // Numbers, clamped against the base after it is (withTypeSizes).
  fontSizeNameDelta: null,
  fontSizeSectionDelta: null,
  fontSizeEntryDelta: null,
  fontSizeTitleDelta: null,
  iconSize: ICON_SIZE,
  sectionLetterSpacing: SECTION_LETTER_SPACING,
  sectionBorderWidth: SECTION_BORDER_PT,
  headerBorderWidth: HEADER_BORDER_PT,
  // Header Customization → Name & Title Spacing, px (HEADER_GAPS: 2–48). The résumé's PDF reads it
  // unchecked under Inline: "abc" threw (no PDF), 1000 flung the title off the header (FIDB-51-VF4-NB1).
  headerInlineGap: HEADER_GAPS.headerInlineGap,
};

/** `resume` with every Design number stored as a number in its control's range (see above). */
export const withDesignNumbers = (resume) => withTypeSizes(withStoredNumbers(withSpacingNumbers(resume), DESIGN_NUMBERS));
