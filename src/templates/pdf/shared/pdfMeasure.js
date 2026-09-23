// Text widths as react-pdf will print them, for a layout that has to know before react-pdf lays
// it out whether two blocks fit side by side (the letterhead's name and contacts, VM3-0/VM3-1).
// yoga cannot ask a text for its narrowest width, and react-pdf lays a text out once, at the first
// width it is measured with, so a block that is too narrow for its longest word is never re-wrapped:
// the word runs out of it, over whatever sits beside it. The fonts are the ones the render uses:
// resolvePdfFonts has loaded every face of the page's families before a template renders.
import { Font } from '@react-pdf/renderer';
import { BREAK_AFTER, BREAK_MARK } from './pdfFontLoader';

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

/** Noto Sans's vertical metrics per em (hhea), for a family with no loaded face. */
const NOTO_METRICS = { ascent: 1.069, descent: -0.293, lineGap: 0 };

/**
 * The line box textkit gives one line of text in `style` ({ fontFamily, fontSize, fontWeight,
 * lineHeight }), pt: its `height` — `lineHeight` (absolute pt) when the text has one, else the
 * face's ascent − descent + lineGap — and the `ascent` its baseline sits below the box's top
 * (react-pdf draws a line's baseline its ascent down, whatever its lineHeight). Several styles:
 * a line holding a run of each, whose box is the largest of theirs.
 */
export function lineBox(styles) {
  return [].concat(styles).reduce((box, { fontFamily, fontSize = 12, fontWeight, lineHeight } = {}) => {
    const [face] = faces(fontFamily, fontWeight);
    const m = face ? { ascent: face.ascent / face.unitsPerEm, descent: face.descent / face.unitsPerEm, lineGap: (face.lineGap || 0) / face.unitsPerEm } : NOTO_METRICS;
    const height = lineHeight ?? (m.ascent - m.descent + m.lineGap) * fontSize;
    return { height: Math.max(box.height, height), ascent: Math.max(box.ascent, m.ascent * fontSize) };
  }, { height: 0, ascent: 0 });
}

/**
 * The narrowest box `text` prints in with no word running out of it: the width of its widest
 * unbreakable piece in `style`. textkit breaks a line only at spaces, and inside a long token at
 * the marks the registered hyphenation callback puts in it (breakLongWords); `tail` is glued to
 * the last piece (a separator that may not start a line).
 */
export function widestWord(text, style, tail = 0) {
  const all = pieces(text);
  return all.reduce((widest, part, i) => Math.max(widest, textWidth(part, style) + (i === all.length - 1 ? tail : 0)), 0);
}

/** `text`'s unbreakable pieces, in order: its words, split where breakLongWords marks a long one. */
function pieces(text) {
  const split = Font.getHyphenationCallback() || ((word) => [word]);
  return String(text ?? '').split(/ +/).filter(Boolean)
    .flatMap((word) => split(word).map(String).filter(Boolean)); // a break mark reads as ''
}

/** Room left under a fitted width, pt: a word's kerning into the next space is not in it. */
const FIT_SLACK = 1;
/** The smallest size fitFontSize returns, pt. */
export const MIN_FIT_PT = 1;

/**
 * The font size `text` prints at in a box `maxWidth` pt wide with no word running out of it — a
 * header's name, which textkit breaks only at its spaces: `style.fontSize` when its widest piece
 * fits (every usual name, which prints exactly as it always has), else the largest size at which
 * every piece does. A name of one long word ("Wolfeschlegelsteinhausenbergerdorff" at 28 pt) has
 * nowhere to break, and react-pdf drew it out of its box — past the margin, off the paper, over the
 * Sidebar's main column. A piece is `size × its width at 1 pt` plus a letterSpacing that does not
 * scale, so the size is solved for, not guessed. No readable floor, which would let the name out
 * again: MIN_FIT_PT only keeps the size a size.
 */
export function fitFontSize(text, style, maxWidth) {
  const size = style?.fontSize ?? 12;
  if (!(maxWidth > 0) || widestWord(text, style) <= maxWidth) return size;
  const spacing = style?.letterSpacing ?? 0;
  const unit = { ...style, fontSize: 1, letterSpacing: 0 };
  const fit = pieces(text).reduce((smallest, part) => {
    const perPt = textWidth(part, unit);
    const tracked = spacing * Math.max(0, [...part].length - 1);
    return perPt > 0 ? Math.min(smallest, (maxWidth - FIT_SLACK - tracked) / perPt) : smallest;
  }, size);
  return Math.max(MIN_FIT_PT, fit);
}

/**
 * How far textkit closes up a line wider than its box, pt: 11/256 pt either side of each glyph
 * (its SHRINK_CHAR_FACTOR), none before the first or after the last.
 */
const squeeze = (s) => Math.max(0, 2 * [...s].length - 2) * (11 / 256);
/** How far past its box a closed-up word may still print, pt: nothing a reader sees. */
const OVERHANG = 0.5;

/** Whether `text` prints on one line `maxWidth` pt wide: as wide as that, or closed up to it by textkit (a line a little wider than its box). */
export const fitsOnLine = (text, style, maxWidth) => !(maxWidth > 0) || textWidth(text, style) - squeeze(text) <= maxWidth + OVERHANG;

/**
 * A hyphenation callback for a Text laid out `maxWidth` pt wide in `style` — a value in the
 * Sidebar's dark column. The registered callback (breakLongWords) marks a token only past 48
 * characters, so a shorter e-mail address or URL wider than a narrow box had nowhere to break and
 * ran out of it, over the main column ("alexandra.johnson-smith@examplecompany.com", 205 pt at
 * 9 pt in a 146 pt column). A word that prints inside the box is split only as the registered
 * callback splits it — one a little wider, which textkit closes up to fit, too: the sample
 * résumé's "linkedin.com/in/jordan-rivera-sample" keeps its one line. A wider one is marked after
 * / . - _ @ …, and a piece still wider than the box between the longest runs of its characters
 * that fit. textkit takes a mark only for a word wider than its line, with no hyphen, and the text
 * reads as typed (BREAK_MARK).
 */
export function breakToFit(style, maxWidth) {
  const registered = Font.getHyphenationCallback() || ((word) => [word]);
  const fits = (s) => textWidth(s, style) <= maxWidth - FIT_SLACK;
  return (word) => {
    if (fitsOnLine(word, style, maxWidth)) return registered(word);
    const parts = word.split(BREAK_AFTER).flatMap((part) => (fits(part) ? [part] : runsThatFit(part, fits)));
    return parts.flatMap((part, i) => (i ? [BREAK_MARK, part] : [part]));
  };
}

/** `part` cut into the longest runs of characters that `fits` (one character at the least). */
function runsThatFit(part, fits) {
  const runs = [''];
  for (const ch of part) {
    const last = runs.length - 1;
    if (runs[last] && !fits(runs[last] + ch)) runs.push(ch);
    else runs[last] += ch;
  }
  return runs;
}
