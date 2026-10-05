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
export function Text({ children, ...props }) {
  return <ReactPdfText hyphenationPenalty={10000} {...props}>{Array.isArray(children) ? children.map((child) => splitLongText(child)) : splitLongText(children)}</ReactPdfText>;
}

/** A string longer than this goes to textkit in pieces (splitLongText). */
const SPLIT_OVER = 4000;
/** About how long each piece is, characters. */
const PIECE = 1000;

/**
 * A long paragraph — a pasted article, 200 000 characters — as several strings of about PIECE
 * characters, for `<Text>` children. textkit keeps one run per string, and every step that reads
 * or slices a run (the width of each word, each line cut) copies it from its start: with the whole
 * paragraph one run that is time squared in its length (Classic: 1.3 s at 50 000 characters,
 * 12.7 s at 200 000; typing-freeze 7b). A piece is cut after a whole run of spaces, so every word
 * and space reaches textkit as it did, in the same order, and the pieces share one style: nothing
 * prints differently (a space is never at the head of a line either way). Shorter text, and text
 * with no such space to cut at, comes back as it was.
 * @returns {string|string[]}
 */
export function splitLongText(text) {
  if (typeof text !== 'string' || text.length <= SPLIT_OVER) return text;
  const pieces = [];
  let from = 0;
  let at = PIECE;
  while (at < text.length) {
    const space = text.indexOf(' ', at);
    if (space < 0) break;
    let end = space + 1;
    while (text.charCodeAt(end) === 32) end += 1;
    // Both neighbours of the cut are ASCII: a space between two Hebrew or CJK words belongs to
    // their font (textkit keepsFontForSpace), and a cut there would hand it to the other one.
    if (end < text.length && text.charCodeAt(space - 1) < 128 && text.charCodeAt(end) < 128) {
      pieces.push(text.slice(from, end));
      from = end;
      at = end + PIECE;
    } else at = end;
  }
  if (!from) return text;
  pieces.push(text.slice(from));
  return pieces;
}
