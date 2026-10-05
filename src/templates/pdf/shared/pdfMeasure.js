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

const SPACES = [0x20, 0xa0];
// Which face of a stack draws a code point, kept per stack (its first face and the rest, as the
// list of families gives them): the answer is a lookup in each face's cmap, asked once for every
// character of every text measured (typing-freeze 7).
const picked = new WeakMap();
function pickerFor(stack) {
  let entry = picked.get(stack[0]);
  if (!entry || entry.stack.length !== stack.length || entry.stack.some((f, i) => f !== stack[i])) {
    entry = { stack, faces: new Map() };
    picked.set(stack[0], entry);
  }
  return (cp) => {
    let face = entry.faces.get(cp);
    if (face === undefined) {
      face = stack.find((f) => f.hasGlyphForCodePoint?.(cp)) || stack[0];
      entry.faces.set(cp, face);
    }
    return face;
  };
}

/**
 * Does the space at `chars[i]` stay in `face`, the face of the text before it? textkit's patch
 * (R2-010, .yarn/patches/@react-pdf-textkit-*.patch, keepsFontForSpace) keeps a space between two
 * characters of one fallback face — two Hebrew or CJK words — in that face, unless its space is
 * wider than half an em. `next[i]` is the first character at or after i that is no space (a run
 * of spaces is read once, not from each of its spaces).
 */
function keepsFace(chars, i, face, pick, next) {
  const cp = chars[i].codePointAt(0);
  if (!face || !SPACES.includes(cp) || !face.hasGlyphForCodePoint?.(cp)) return false;
  if (face.glyphForCodePoint(cp).advanceWidth > face.unitsPerEm / 2) return false;
  const j = next[i + 1];
  return j < chars.length && pick(chars[j].codePointAt(0)) === face;
}

/**
 * The width in pt of `text` on one line in `style` ({ fontFamily, fontSize, fontWeight,
 * letterSpacing }), as textkit sets it: each character in the first face of the family list that
 * has it (a space between two characters of one face in that face, keepsFace), kerned. With no
 * loaded face (never the case in a render) a wide estimate, 0.62 em a character, so a layout errs
 * on the side of room.
 */
export function textWidth(text, { fontFamily, fontSize = 12, fontWeight, letterSpacing = 0 } = {}) {
  const chars = [...String(text ?? '')];
  const stack = faces(fontFamily, fontWeight);
  if (!stack.length) return chars.length * fontSize * 0.62;
  const pick = pickerFor(stack);
  const next = new Array(chars.length + 1).fill(chars.length);
  for (let i = chars.length - 1; i >= 0; i -= 1) next[i] = SPACES.includes(chars[i].codePointAt(0)) ? next[i + 1] : i;
  let width = 0;
  let run = '';
  let face = null;
  const flush = () => {
    if (run) width += (face.layout(run).advanceWidth * fontSize) / face.unitsPerEm;
    run = '';
  };
  chars.forEach((ch, i) => {
    const nextFace = keepsFace(chars, i, face, pick, next) ? face : pick(ch.codePointAt(0));
    if (nextFace !== face) { flush(); face = nextFace; }
    run += ch;
  });
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
 * pt from the top of a first line in `styles` (lineBox's) to the middle of its capitals at `size`
 * (the first style's): react-pdf sets a line's baseline its ascent below the box's top, and a capital
 * stands about 0.72 em over it (Noto Sans' cap height; the fonts on offer range 0.66–0.73). Where a
 * marker drawn beside an entry's title (the Timeline's dot, the Sidebar card's) centres on its line.
 */
export const capMiddle = (styles, size = [].concat(styles)[0].fontSize) => lineBox(styles).ascent - 0.36 * size;

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

/**
 * How many lines `text` wraps to in a box `maxWidth` pt wide in `style` (textWidth's): broken at its
 * spaces, a word wider than the box across as many lines as it fills (a link that breaks inside
 * itself). Greedy, and every line at its full width, never closed up as textkit may: an estimate for
 * what a block will take on the page, which errs on more lines, not fewer (R4-DOUT-07). 0 for no text.
 */
export function wrappedLines(text, style, maxWidth) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  if (!(maxWidth > 0)) return 1;
  const space = textWidth(' ', style);
  let lines = 1;
  let used = 0;
  for (const word of words) {
    const w = textWidth(word, style);
    if (w > maxWidth) {
      const span = Math.ceil(w / maxWidth);
      lines += (used ? 1 : 0) + span - 1;
      used = w - (span - 1) * maxWidth;
    } else if (!used) used = w;
    else if (used + space + w <= maxWidth) used += space + w;
    else { lines += 1; used = w; }
  }
  return lines;
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
/** A text of fewer characters than this is always measured whole (breakToFit's clearlyWider). */
const SCREEN_MIN = 200;

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
  // react-pdf asks again for a word it has seen (each measure of the same Text), and the answer
  // depends on nothing but the word.
  const seen = new Map();
  const widths = new Map();
  const advance = (ch) => {
    let w = widths.get(ch);
    if (w === undefined) { w = textWidth(ch, { ...style, letterSpacing: 0 }); widths.set(ch, w); }
    return w;
  };
  // A long text far wider than the box is known from the sum of its cached advances (kerning and
  // shaping move a width by a few per cent, never by half), so it is not laid out whole to learn
  // that: laying a 20 000-character token out twice, to find it too wide, was a third of the cost.
  const spacing = style?.letterSpacing ?? 0;
  const clearlyWider = (s, limit) => {
    if (s.length < SCREEN_MIN) return false;
    let sum = 0;
    let n = 0;
    for (const ch of s) { sum += advance(ch); n += 1; }
    return sum + spacing * Math.max(0, n - 1) > 2 * Math.max(0, limit);
  };
  return (word) => {
    if (seen.has(word)) return seen.get(word);
    let out;
    if (!(maxWidth > 0) || (!clearlyWider(word, maxWidth + OVERHANG) && fitsOnLine(word, style, maxWidth))) out = registered(word);
    else {
      const parts = word.split(BREAK_AFTER).flatMap((part) => (!clearlyWider(part, maxWidth - FIT_SLACK) && fits(part) ? [part] : runsThatFit(part, fits, guessRuns(part, style, maxWidth - FIT_SLACK, advance))));
      out = parts.flatMap((part, i) => (i ? [BREAK_MARK, part] : [part]));
    }
    seen.set(word, out);
    return out;
  };
}

/**
 * `part` cut into the longest runs of characters that `fits` (one character at the least). Each
 * run's end is found from `guess(start, room)`, the length a run starting at character `start` is
 * expected to have (at most `room`), then confirmed with the real measure: when that length fits
 * and one more does not, it is the run, at two measures of a run's own length. Where the guess is
 * off (kerning, joined scripts) the end is searched out from it by doubling steps then halving.
 * With no guess, from one character by doubling. A prefix is never narrower than a shorter one of
 * the same text, so a run costs a handful of measures of its own length, not one per character
 * (typing-freeze 7: a 20 000-character token measured every prefix of every run, ~9 s).
 */
export function runsThatFit(part, fits, guess) {
  const chars = [...part];
  const at = [0]; // at[i]: where character i starts in `part`
  for (const ch of chars) at.push(at[at.length - 1] + ch.length);
  const runs = [];
  let start = 0;
  while (start < chars.length) {
    const room = chars.length - start;
    const fitsLen = (n) => fits(part.slice(at[start], at[start + n]));
    let good = 1; // a run is one character at the least
    let bad = 0; // the shortest length known not to fit; 0: none yet
    const first = guess ? Math.min(room, Math.max(1, guess(start, room) | 0)) : 1;
    if (first > 1 && !fitsLen(first)) {
      bad = first; // too long: step down from it
      for (let step = 1; ; step *= 2) {
        const probe = bad - step;
        if (probe <= 1) break;
        if (fitsLen(probe)) { good = probe; break; }
        bad = probe;
      }
    } else good = first;
    let step = 1;
    while (!bad && good < room) {
      const probe = Math.min(room, good + step);
      if (fitsLen(probe)) { good = probe; step *= 2; }
      else bad = probe;
    }
    while (bad - good > 1) {
      const mid = (good + bad) >> 1;
      if (fitsLen(mid)) good = mid;
      else bad = mid;
    }
    runs.push(part.slice(at[start], at[start + good]));
    start += good;
  }
  return runs;
}

/**
 * Where a run of `part`'s characters is expected to end in a column `limit` pt wide: from each
 * character's own advance (a width kept per character for the style, so a token of one thousand
 * different characters is laid out once each, not once per run) and the letterSpacing between
 * them. It leaves out kerning and shaping, which is why runsThatFit confirms it with the real
 * measure; it is exact for the usual run of Latin, CJK or emoji.
 */
function guessRuns(part, style, limit, advance) {
  const chars = [...part];
  const total = [0];
  for (const ch of chars) total.push(total[total.length - 1] + advance(ch));
  const spacing = style?.letterSpacing ?? 0;
  return (start, room) => {
    let lo = 1;
    let hi = room;
    while (lo < hi) { // the most characters whose summed advances stay inside the limit
      const mid = (lo + hi + 1) >> 1;
      if (total[start + mid] - total[start] + spacing * (mid - 1) <= limit) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
}
