import { createContext, useContext } from 'react';
import { View, Link } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { listMarker, parseRichText, safeHref } from '@/utils/richText';
import { useLinkLook } from './PdfLinkStyle';

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
// behind at the bottom of a page while its text starts the next one. Longer items (far beyond
// a page's worth in any column) split normally rather than overflow the page.
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
    if (href) return <Link key={i} src={href} style={{ ...style, ...look }}>{run.text}</Link>;
    return Object.keys(style).length ? <Text key={i} style={style}>{run.text}</Text> : run.text;
  });
}

const isBullet = (marker) => marker.length === 1;

/** Marker column width for a list level: room for its longest marker ("•", "9." … "viii."). */
function markerWidth(chars, fontSize) {
  return Math.max(chars * fontSize * 0.55, fontSize * 0.6) + MARKER_GAP;
}

/**
 * Rich text (the editor's HTML) as react-pdf blocks: one <Text> per paragraph and one row per
 * list item, returned as siblings so the page can break between any two of them.
 *
 * `style` is the text style (font size, colour, line height, alignment); its marginTop and
 * marginBottom apply once, above the first block and below the last. `breaks(inset)`: where a word
 * of a block whose text starts `inset` pt in may break (sideBreaks in the Sidebar's dark column).
 */
export function PdfRichText({ html, style = {}, breaks }) {
  const bulletStyle = useContext(BulletStyle);
  const blocks = parseRichText(html);
  if (!blocks.length) return null;
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

  return blocks.map((block, i) => {
    const prev = blocks[i - 1];
    const edges = {
      marginTop: i === 0 ? marginTop : (prev.marker && block.marker ? LIST_GAP : PARA_GAP),
      marginBottom: i === blocks.length - 1 ? marginBottom : undefined,
    };
    const align = block.align || textStyle.textAlign;

    if (!block.marker) {
      // Body text, or a further paragraph of a list item aligned with that item's text.
      const left = block.indent > 0 ? (textStart[block.indent] ?? block.indent * INDENT) : 0;
      return (
        <Text key={i} style={{ ...textStyle, ...edges, textAlign: align, marginLeft: left || undefined }} hyphenationCallback={breaks?.(left)}>
          <Runs runs={block.runs} color={color} />
        </Text>
      );
    }

    const left = textStart[block.indent - 1] ?? (block.indent - 1) * INDENT;
    const width = markerWidth(longest[`${block.indent}:${isBullet(block.marker)}`], fontSize);
    textStart[block.indent] = left + width;
    textStart.length = block.indent + 1;
    const length = block.runs.reduce((n, r) => n + r.text.length, 0);
    // The glyph Design → Lists picked; the column is as wide whatever it draws, so a style never
    // moves the text. None draws nothing there: the text keeps its place by its own margin.
    const glyph = listMarker(block.marker, bulletStyle);
    return (
      <View
        key={i}
        wrap={length > KEEP_TOGETHER_CHARS}
        style={{ ...edges, flexDirection: 'row', marginLeft: left || undefined }}
      >
        {glyph ? <Text style={{ ...textStyle, textAlign: 'left', width }}>{glyph}</Text> : null}
        <Text style={{ ...textStyle, textAlign: align, flex: 1, marginLeft: glyph ? undefined : width }} hyphenationCallback={breaks?.(left + width)}>
          <Runs runs={block.runs} color={color} />
        </Text>
      </View>
    );
  });
}
