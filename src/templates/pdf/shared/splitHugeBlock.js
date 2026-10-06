// A pasted article is one paragraph of 200 000 characters. textkit lays a paragraph out in one
// piece, and two of its steps take time squared in the paragraph's length: Knuth-Plass keeps an
// active break for every line count a position can be reached with (a count that spreads out the
// longer the paragraph runs), and every width and line cut of a run copies the run from its start.
// Classic took 1.3 s for 50 000 characters and 12.7 s for 200 000 (typing-freeze 7b), and the
// previews queued behind it. A paragraph that long is cut here into paragraphs of a few thousand
// characters, which textkit lays out one after another in time that follows their number.
//
// That is as true of a plain text field, which no rich text goes through: a company, a skills line, a
// name of 100 000 characters took 4-14 s, and 200 000 would pass the PDF worker's budget (R2-142).
// breakHugeChildren cuts those, for every `Text` a template draws (PdfText.jsx), with a line break
// where a rich text block gets a paragraph of its own: textkit lays out each line of a text apart.

/** A block of more than this many characters is cut; one of this many or fewer is never touched. */
export const HUGE_BLOCK = 12000;
/** About how long each piece is, characters. */
export const BLOCK_PIECE = 6000;
/** How far past BLOCK_PIECE a space is looked for before the text is cut where it stands. */
const SPACE_WINDOW = BLOCK_PIECE / 2;

// What may not start a piece: a combining mark, a joiner, a variation selector, a skin tone.
const JOINED_TO_PREVIOUS = /[\p{M}‌‍️\u{1f3fb}-\u{1f3ff}]/u;

/** Where the piece that starts at `from` ends: after a run of spaces when there is one near, else in the text. */
function cutAfter(all, from) {
  const target = from + BLOCK_PIECE;
  const space = all.indexOf(' ', target);
  if (space >= 0 && space < target + SPACE_WINDOW) {
    let end = space;
    while (all.charCodeAt(end) === 32) end += 1;
    if (end < all.length) return { end, skip: end };
  }
  // No space near (CJK text, one long token): cut at the target, never inside a character.
  let end = target;
  while (end < all.length && (/[\udc00-\udfff]/.test(all[end]) || JOINED_TO_PREVIOUS.test(all[end]) || all.charCodeAt(end - 1) === 0x200d)) end += 1;
  return { end, skip: end };
}

/** The pieces `all` (more than HUGE_BLOCK characters) is cut into, as [start, end] pairs that follow one another. */
function piecesOf(all) {
  const pieces = [];
  for (let from = 0; from < all.length;) {
    const { end, skip } = from + BLOCK_PIECE >= all.length - SPACE_WINDOW ? { end: all.length, skip: all.length } : cutAfter(all, from);
    pieces.push([from, end]);
    from = skip;
  }
  return pieces;
}

/**
 * `blocks` (parseRichText's) with each block of more than HUGE_BLOCK characters cut into pieces
 * that follow one another: the spaces a cut falls on are dropped (the line break they stand for
 * would have swallowed them), every other character stays, in order, in the same run formats. A
 * piece after the first is a paragraph of its own — no list marker, `joined`, no gap above it —
 * that continues its list item's text where it sits.
 */
export function splitHugeBlocks(blocks) {
  return blocks.flatMap((block) => {
    const all = block.runs.map((run) => run.text).join('');
    if (all.length <= HUGE_BLOCK) return [block];
    const pieces = piecesOf(all);
    // The runs' share of each piece, trimmed of the spaces a cut left at its end.
    let offset = 0;
    const spans = block.runs.map((run) => { const span = [offset, offset + run.text.length]; offset = span[1]; return span; });
    return pieces.map(([start, end], i) => {
      const trimmed = i < pieces.length - 1 ? all.slice(start, end).replace(/ +$/, '').length + start : end;
      const runs = [];
      block.runs.forEach((run, r) => {
        const [a, b] = [Math.max(start, spans[r][0]), Math.min(trimmed, spans[r][1])];
        if (a < b) runs.push({ ...run, text: run.text.slice(a - spans[r][0], b - spans[r][0]) });
      });
      return i === 0 ? { ...block, runs } : { ...block, runs, marker: null, list: undefined, joined: true };
    });
  });
}

/**
 * Plain text with each line of more than HUGE_BLOCK characters cut into lines of a few thousand, as
 * splitHugeBlocks cuts a block: at a space (dropped, the line break stands for it) or, in text with
 * none, where it stands, never inside a character. textkit lays each line of a text out apart, so the
 * line breaks are what keep its time following the text's length. Text of HUGE_BLOCK characters or
 * fewer, and a line that short, is the same string, byte for byte.
 */
export function breakHugeText(text) {
  if (typeof text !== 'string' || text.length <= HUGE_BLOCK) return text;
  return text.split('\n').map((line) => {
    if (line.length <= HUGE_BLOCK) return line;
    const pieces = piecesOf(line);
    return pieces.map(([start, end], i) => (i < pieces.length - 1 ? line.slice(start, end).replace(/ +$/, '') : line.slice(start, end))).join('\n');
  }).join('\n');
}

/** The children `Text` takes that hold no element: a string, a number, nothing, and lists of them. */
function plainChildren(children) {
  const flat = [];
  const walk = (c) => {
    if (c == null || typeof c === 'boolean') return true;
    if (typeof c === 'string' || typeof c === 'number') { flat.push(String(c)); return true; }
    return Array.isArray(c) && c.every(walk);
  };
  return walk(children) ? flat : null;
}

/**
 * What a `Text` is given as its children, with the plain text in it cut as breakHugeText cuts it when
 * it is more than HUGE_BLOCK characters (strings side by side count together: the paragraph is all of
 * them). Anything shorter, and children with an element among them (a link, a styled run), come back
 * as they are — the same value — so no ordinary text is touched.
 */
export function breakHugeChildren(children) {
  if (typeof children === 'string') return breakHugeText(children);
  if (!Array.isArray(children)) return children;
  const flat = plainChildren(children);
  if (!flat || flat.reduce((n, c) => n + c.length, 0) <= HUGE_BLOCK) return children;
  return breakHugeText(flat.join(''));
}
