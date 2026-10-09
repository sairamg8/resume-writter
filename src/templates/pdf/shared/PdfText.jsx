import { useContext } from 'react';
import { Text as ReactPdfText } from '@react-pdf/renderer';
import { breakHugeChildren } from './splitHugeBlock';
import { breakToFit } from './pdfMeasure';
import { ColumnRoom } from './roomContext';

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
  const room = useContext(ColumnRoom);
  const children = cut(props.children);
  // In a column or a Grids cell (ColumnRoom), a word wider than the whole cell breaks inside it
  // (breakToFit) instead of running out of it over the next cell or the page's margin: a 29-letter
  // German job title in a 3-column grid, a URL in a 2-column one (H3-459). A callback the caller
  // gives (the Sidebar's) stays; so does a Text with no size of its own (it takes its parent's).
  const fit = !room || props.hyphenationCallback ? undefined : fitIn(room, props.style);
  return <ReactPdfText hyphenationPenalty={10000} {...props} {...(fit ? { hyphenationCallback: fit } : null)} {...(children === props.children ? null : { children })} />;
}

/**
 * `breakToFit` for a text in `style` whose first character is `inset` pt in from the edge of `room`
 * (a list item's text, after its marker), or nothing when the style has no font size or no room.
 */
export function fitIn(room, style, inset = 0) {
  const flat = Array.isArray(style) ? Object.assign({}, ...style.flat(Infinity).filter(Boolean)) : style;
  if (!room || !(flat?.fontSize > 0) || !(room.width - inset > 0)) return undefined;
  const { fontSize, fontWeight, letterSpacing } = flat;
  return breakToFit({ fontFamily: flat.fontFamily || room.fontFamily, fontSize, fontWeight, letterSpacing }, room.width - inset);
}
