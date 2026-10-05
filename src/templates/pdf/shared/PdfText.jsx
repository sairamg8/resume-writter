import { Text as ReactPdfText } from '@react-pdf/renderer';

/**
 * react-pdf's Text with every break inside a word forbidden: hyphenationPenalty at textkit's
 * "infinity" (10000). Every template imports Text from here, and a contact's link holds one of
 * these (ContactValue) instead of the bare string react-pdf would wrap in a paragraph of its own
 * without this setting (VM4-1), so no paragraph misses it.
 *
 * textkit puts a hyphen penalty between any two parts of a word — where formatting changes
 * inside it ("pre<b>view</b>", FIDB-56) and before each break mark breakLongWords puts in a long
 * URL — and a break there draws a hyphen that is not in the text. The mark itself can never be
 * the break while that penalty stands in front of it. So a paragraph with room for a penalty
 * break took one: the sample résumés' project URL printed "…/a11y--" / "check- action" in four
 * templates (R4-10). Forbidden, lines break at spaces; a token longer than its line leaves
 * textkit's optimal pass nowhere to break, and its best-fit pass breaks at the marks, with no
 * hyphen.
 */
export function Text(props) {
  return <ReactPdfText hyphenationPenalty={10000} {...props} />;
}
