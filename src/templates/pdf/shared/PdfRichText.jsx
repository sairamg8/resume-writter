import { createContext, Fragment, useContext } from 'react';
import { View, Link } from '@react-pdf/renderer';
import { Text, fitIn } from './PdfText';
import { listMarker, parseRichText, safeHref } from '@/utils/richText';
import { useLinkLook } from './PdfLinkStyle';
import { splitHugeBlocks } from './splitHugeBlock';
import { ColumnRoom, columnRoom, fitsPage } from './keepTogether';
import { wrappedLines } from './pdfMeasure';

/**
 * Design → Lists → Bullet (settings.bulletStyle, R2-147) of the document being drawn. renderResumePdf
 * and renderCoverLetterPdf provide it around the template, so every list — the summary's, an entry's
 * description, its legacy bullets[], the letter's body, in either Sidebar column — prints the chosen
 * glyph without each section passing it down. Nothing provided: the parse's own markers, as before.
 */
export const BulletStyle = createContext(undefined);

const INDENT = 10;        // pt of text indent per list level
const MARKER_GAP = 3;     // pt between a list marker and its text
const PARA_GAP = 2;       // pt between blocks
const LIST_GAP = 1.5;     // pt between two list items
// A list item this short is kept on one page: it never splits, so its marker can never be left
// behind at the bottom of a page while its text starts the next one. Longer items split normally
// rather than overflow the page — and so does a shorter one that is taller than a page in its own
// column (keepTogether.js: fitsPage), a narrow Grids cell or the Sidebar's dark column at a large type size.
const KEEP_TOGETHER_CHARS = 1500;
// Text (./PdfText) never breaks a line inside a word, so a formatting change mid-word
// ("pre<b>view</b>") cannot draw a hyphen that is not in the text (FIDB-56).

function runStyle(run, color) {
  const style = {};
  if (run.bold) style.fontWeight = 'bold';
  if (run.italic) style.fontStyle = 'italic';
  const deco = [run.underline && 'underline', run.strike && 'line-through'].filter(Boolean).join(' ');
  if (deco) style.textDecoration = deco;
  if (run.href) {
    // react-pdf paints links blue and underlined unless told otherwise.
    style.color = color;
    if (!deco) style.textDecoration = 'none';
  }
  return style;
}

function Runs({ runs, color }) {
  // Design → Links (R2-147): an underline, or the accent, over the link's own look; Plain adds nothing.
  const look = useLinkLook();
  return runs.map((run, i) => {
    const style = runStyle(run, color);
    const href = run.href && safeHref(run.href);
    if (href) {
      // Underline adds its line to a struck-through link's, as Word keeps both.
      const deco = look.textDecoration && run.strike ? { textDecoration: 'underline line-through' } : {};
      return <Link key={i} src={href} style={{ ...style, ...look, ...deco }}>{run.text}</Link>;
    }
    return Object.keys(style).length ? <Text key={i} style={style}>{run.text}</Text> : run.text;
  });
}

const isBullet = (marker) => marker.length === 1;

/** Marker column width for a list level: room for its longest marker ("•", "9." … "viii."). */
function markerWidth(chars, fontSize) {
  return Math.max(chars * fontSize * 0.55, fontSize * 0.6) + MARKER_GAP;
}

/**
 * What an entry's header must keep under it, pt, so that the first thing its description prints starts
 * on the header's page: that block's own height when it cannot be split, else 0 (the header's two lines
 * are enough). A list item kept whole (the rule PdfRichText draws it by), and a paragraph of up to three
 * lines (textkit never splits one under four: two lines on each page), move to the next page as a whole.
 * The header kept only two lines, so a 3-line bullet that did not fit the room left under it went to the
 * next page and the header stayed alone at the foot of the page above it. `width`: the pt the text has in
 * its column (entryTextWidth); `fontSize`, `lineHeight` and `marginTop` as the description is drawn with.
 */
export function firstChunkKeep({ html, settings, fontSize, lineHeight, width, marginTop = 2 }) {
  const blocks = splitHugeBlocks(parseRichText(html));
  return chunkKeep(blocks, 0, { settings, fontSize, lineHeight, width, marginTop });
}

/** The same for block `at` of `blocks`: its height when it cannot be split, else 0. */
function chunkKeep(blocks, at, { settings, fontSize, lineHeight, width, marginTop = 2 }) {
  const block = blocks[at];
  if (!block) return 0;
  const text = block.runs.map((r) => r.text).join('');
  const style = { fontFamily: settings?._pdfFontFamily, fontSize };
  let across = width;
  let whole;
  if (block.marker) {
    const longest = Math.max(...blocks.filter((b) => b.marker && b.indent === block.indent && isBullet(b.marker) === isBullet(block.marker)).map((b) => b.marker.length));
    across = width - (block.indent - 1) * INDENT - markerWidth(longest, fontSize);
    whole = text.length <= KEEP_TOGETHER_CHARS && fitsPage({ text, fontSize, lineHeight, width: across, height: columnRoom(settings, width).height, fontFamily: style.fontFamily });
  } else {
    across = width - Math.max(0, block.indent) * INDENT;
  }
  const lines = wrappedLines(text, style, across);
  if (block.marker ? !whole : lines >= 4) return 0;
  return Math.ceil(lines * fontSize * lineHeight + marginTop);
}

/**
 * Rich text (the editor's HTML) as react-pdf blocks: one <Text> per paragraph and one row per
 * list item, returned as siblings so the page can break between any two of them.
 *
 * `style` is the text style (font size, colour, line height, alignment); its marginTop and
 * marginBottom apply once, above the first block and below the last. `breaks(inset)`: where a word
 * of a block whose text starts `inset` pt in may break (sideBreaks in the Sidebar's dark column).
 * `tail`: { node, settings, width } — what follows the text and must not stand alone on a page (a
 * letter's closing and signature). The last block goes with it when that block cannot be split
 * (chunkKeep), so the page break falls before the block and not between the block and the closing.
 */
export function PdfRichText({ html, style = {}, breaks, tail }) {
  const bulletStyle = useContext(BulletStyle);
  const room = useContext(ColumnRoom);
  const blocks = splitHugeBlocks(parseRichText(html)); // a paste of 200 000 characters: typing-freeze 7b
  if (!blocks.length) return tail ? tail.node : null;
  const { marginTop, marginBottom, ...textStyle } = style;
  const fontSize = textStyle.fontSize || 11;
  const color = textStyle.color;

  // Every item of one level shares a marker column as wide as its longest marker, so "9." and
  // "10." start their text at the same x.
  const longest = {};
  for (const b of blocks) {
    if (!b.marker) continue;
    const key = `${b.indent}:${isBullet(b.marker)}`;
    longest[key] = Math.max(longest[key] || 0, b.marker.length);
  }
  const textStart = [0]; // x where the text of each list depth starts

  // Where a word of a block whose text starts `inset` pt in may break: as the caller says (the Sidebar's
  // column), else, in a column or a Grids cell, inside the room that text has (H3-459).
  const breakAt = (inset) => (breaks ? breaks(inset) : fitIn(room, textStyle, inset));
  const lastAt = blocks.length - 1;
  const hold = tail && chunkKeep(blocks, lastAt, { settings: tail.settings, fontSize, lineHeight: textStyle.lineHeight ?? 1.4, width: tail.width, marginTop: 0 }) > 0;
  const drawn = blocks.map((block, i) => {
    const prev = blocks[i - 1];
    const edges = {
      marginTop: i === 0 ? marginTop : (block.joined ? 0 : prev.marker && block.marker ? LIST_GAP : PARA_GAP),
      marginBottom: i === blocks.length - 1 ? marginBottom : undefined,
    };
    const align = block.align || textStyle.textAlign;

    if (!block.marker) {
      // Body text, or a further paragraph of a list item aligned with that item's text.
      const left = block.indent > 0 ? (textStart[block.indent] ?? block.indent * INDENT) : 0;
      return (
        <Text key={i} style={{ ...textStyle, ...edges, textAlign: align, marginLeft: left || undefined }} hyphenationCallback={breakAt(left)}>
          <Runs runs={block.runs} color={color} />
        </Text>
      );
    }

    const left = textStart[block.indent - 1] ?? (block.indent - 1) * INDENT;
    const width = markerWidth(longest[`${block.indent}:${isBullet(block.marker)}`], fontSize);
    textStart[block.indent] = left + width;
    textStart.length = block.indent + 1;
    const text = block.runs.map((r) => r.text).join('');
    const length = text.length;
    // Kept whole only while it can fit a page: `across` is the width the text has in this column.
    const keeps = (across) => length <= KEEP_TOGETHER_CHARS && (!room || fitsPage({
      text, fontSize, lineHeight: textStyle.lineHeight ?? 1.4, width: room.width - left - across, height: room.height, fontFamily: room.fontFamily,
    }));
    // The glyph Design → Lists picked; the column is as wide whatever it draws, so a style never
    // moves the text. None draws nothing there: the text keeps its place by its own margin.
    const glyph = listMarker(block.marker, bulletStyle);
    if (align === 'center' || align === 'right') {
      // Centred or right-aligned (Section Options → Alignment, or the item's own alignment): the
      // marker leads its text on one line, placed together — '• Cut costs 20%' — as Word places a
      // centred list paragraph with its bullet. A marker column would leave it at the left margin.
      return (
        <View key={i} wrap={!keeps(0)} style={{ ...edges, flexDirection: 'row', marginLeft: left || undefined }}>
          <Text style={{ ...textStyle, textAlign: align, flex: 1 }} hyphenationCallback={breakAt(left)}>
            {glyph ? `${glyph} ` : null}
            <Runs runs={block.runs} color={color} />
          </Text>
        </View>
      );
    }
    return (
      <View
        key={i}
        wrap={!keeps(width)}
        style={{ ...edges, flexDirection: 'row', marginLeft: left || undefined }}
      >
        {glyph ? <Text style={{ ...textStyle, textAlign: 'left', width }}>{glyph}</Text> : null}
        <Text style={{ ...textStyle, textAlign: align, flex: 1, marginLeft: glyph ? undefined : width }} hyphenationCallback={breakAt(left + width)}>
          <Runs runs={block.runs} color={color} />
        </Text>
      </View>
    );
  });
  if (!tail) return drawn;
  if (!hold) return [...drawn, <Fragment key="tail">{tail.node}</Fragment>];
  return [
    ...drawn.slice(0, lastAt),
    <View key="tail" wrap={false}>{drawn[lastAt]}{tail.node}</View>,
  ];
}
