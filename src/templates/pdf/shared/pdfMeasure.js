// Text widths as react-pdf will print them, for a layout that has to know before react-pdf lays
// it out whether two blocks fit side by side (the letterhead's name and contacts, VM3-0/VM3-1).
// yoga cannot ask a text for its narrowest width, and react-pdf lays a text out once, at the first
// width it is measured with, so a block that is too narrow for its longest word is never re-wrapped:
// the word runs out of it, over whatever sits beside it. The fonts are the ones the render uses:
// resolvePdfFonts has loaded every face of the page's families before a template renders.
import { Font } from '@react-pdf/renderer';

const WEIGHTS = { light: 300, normal: 400, medium: 500, bold: 700 };

/** The loaded fontkit faces textkit picks from for `fontFamily` (a family or a fallback list). */
function faces(fontFamily, fontWeight) {
  const weight = WEIGHTS[fontWeight] ?? fontWeight ?? 400;
  return [].concat(fontFamily || 'NotoSans').map((family) => {
    try {
      return Font.getFont({ fontFamily: family, fontWeight: weight, fontStyle: 'normal' })?.data || null;
    } catch {
      return null; // a family that is not registered
    }
  }).filter((face) => typeof face?.layout === 'function' && face.unitsPerEm);
}

/**
 * The width in pt of `text` on one line in `style` ({ fontFamily, fontSize, fontWeight,
 * letterSpacing }), as textkit sets it: each character in the first face of the family list that
 * has it, kerned. With no loaded face (never the case in a render) a wide estimate, 0.62 em a
 * character, so a layout errs on the side of room.
 */
export function textWidth(text, { fontFamily, fontSize = 12, fontWeight, letterSpacing = 0 } = {}) {
  const chars = [...String(text ?? '')];
  const stack = faces(fontFamily, fontWeight);
  if (!stack.length) return chars.length * fontSize * 0.62;
  let width = 0;
  let run = '';
  let face = null;
  const flush = () => {
    if (run) width += (face.layout(run).advanceWidth * fontSize) / face.unitsPerEm;
    run = '';
  };
  for (const ch of chars) {
    const cp = ch.codePointAt(0);
    const next = stack.find((f) => f.hasGlyphForCodePoint?.(cp)) || stack[0];
    if (next !== face) { flush(); face = next; }
    run += ch;
  }
  flush();
  return width + letterSpacing * Math.max(0, chars.length - 1);
}

/**
 * The narrowest box `text` prints in with no word running out of it: the width of its widest
 * unbreakable piece in `style`. textkit breaks a line only at spaces, and inside a long token at
 * the marks the registered hyphenation callback puts in it (breakLongWords); `tail` is glued to
 * the last piece (a separator that may not start a line).
 */
export function widestWord(text, style, tail = 0) {
  const split = Font.getHyphenationCallback() || ((word) => [word]);
  const words = String(text ?? '').split(/ +/).filter(Boolean);
  let widest = 0;
  words.forEach((word, i) => {
    const parts = split(word).map(String).filter(Boolean); // a break mark reads as ''
    parts.forEach((part, j) => {
      const last = i === words.length - 1 && j === parts.length - 1;
      widest = Math.max(widest, textWidth(part, style) + (last ? tail : 0));
    });
  });
  return widest;
}
