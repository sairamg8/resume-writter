import { Text as ReactPdfText } from '@react-pdf/renderer';
import { breakHugeChildren } from './splitHugeBlock';

let cut = breakHugeChildren;

/** For tests/pdf/175-*: `fn(children) → children` stands in for the cut of huge plain text; null goes back to it. */
export function _setHugeTextCutForTest(fn) {
  cut = fn || breakHugeChildren;
}

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
 *
 * It is also where a plain text field of more than 12 000 characters (a name, a company, a skills line)
 * is cut into lines of a few thousand (breakHugeChildren, splitHugeBlock.js): textkit's time on one
 * paragraph grows with its square, as a pasted article's does (R2-142). Any text shorter than that,
 * and any children with an element in them, reach react-pdf as they always did: the same props.
 */
export function Text(props) {
  const children = cut(props.children);
  return <ReactPdfText hyphenationPenalty={10000} {...props} {...(children === props.children ? null : { children })} />;
}
