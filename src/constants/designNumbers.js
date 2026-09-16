// The Design panel's numbers as a résumé stores them — the panel only ever writes numbers in its
// controls' ranges, but an imported .json, a hand-edited store or a cloud copy can carry anything,
// and the editor and the PDF (= the preview) both read what is stored. normalizeResume() runs
// withDesignNumbers() wherever résumés come in: Design → Spacing's numbers (spacingNumbers.js) and
// the ones below, each stored as a number in its control's range or dropped so the default prints.
import { withSpacingNumbers, withStoredNumbers } from './spacingNumbers.js';

/**
 * Section Headings → Border thickness, pt: the panel sets 1–8 (DesignPanelHeadings.jsx). Unchecked,
 * "abc" made Ruled and Left bar throw (no preview, no PDF), "3" printed a 32 pt bar ("3" + 2) and 0
 * an invisible rule (ONB-12-NB2).
 */
export const SECTION_BORDER_PT = { min: 1, max: 8 };

const DESIGN_NUMBERS = { sectionBorderWidth: SECTION_BORDER_PT };

/** `resume` with every Design number stored as a number in its control's range (see above). */
export const withDesignNumbers = (resume) => withStoredNumbers(withSpacingNumbers(resume), DESIGN_NUMBERS);
