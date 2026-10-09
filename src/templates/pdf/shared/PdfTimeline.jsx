import { View } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { solid, textShades } from './pdfColors';
import { railColor, TIMELINE_RAIL } from './timelineRail';
import { capMiddle, lineBox, textWidth, wrappedLines } from './pdfMeasure';
import { EndRow, endField, endRowLines, fieldGap, getDateColor, headPresence, headerKeep, onBaselineOf, wordRoom } from './PdfItemHeader';
import { SPACER, getColumnWidth, gridRows } from './PdfSections';
import { contentWidthPt } from './PdfPage';
import { ColumnRoom, columnRoom } from './keepTogether';

/**
 * The Timeline template's rail (TimelineTemplatePDF.jsx): a vertical accent line down the left of a
 * section's entries, a dot on it at each entry's first line, and each entry's date set ABOVE its title.
 *
 * Geometry, pt from the content's left edge (the page margin): the rail's centre sits RAIL_X in, so a
 * dot's left edge meets the margin and lines up with the section title; an entry's text starts INSET in.
 * The rail is each entry's left border, and the gap between two entries is the lower one's top padding,
 * so the line runs unbroken down the section, and on across a page break (react-pdf draws a split
 * View's border on both pages). The dot is a drawn circle, never a glyph: a "●" in the text layer
 * reads as a bullet to an item-based parser (OpenResume's BULLET_POINTS) and would end the header.
 *
 * What the entry's header reads as, top down (ATS-1, ATS-2, ATS-5 hold here as in ItemHeader):
 *   1. the date, alone and bold — a parser that splits entries at a bold line after a plain one
 *      (OpenResume's fallback) splits at the date, not at the title under it, so a date never joins
 *      the entry above it; the date's own feature score keeps it from being read as the company;
 *   2. the title in its Title style (Stacked, Inline, Side by side), its two fields as separate runs;
 *   3. the location as its own run AFTER the sub — at the sub line's right end (Stacked) or on a line
 *      of its own under the title (one-line styles). Never on the date line: OpenResume takes the
 *      first of the header's best-scoring runs as the company, and with the role first (bold, like
 *      the date) that is the first plain run — the location, were it on the date line.
 *
 * Measured with OpenResume's own code (qa-visual-compare/tools/or-runner) on the demo résumé: title,
 * company, date and every bullet exact in Stacked, and in Side by side with bullets or paragraphs.
 * Known limit: Stacked with a description that has no bullet glyph and no line of 8+ words puts the
 * sub on line 3, past the 2-line header OpenResume gives such a job — so the Timeline's jobs default
 * to Side by side (TEMPLATE_SECTION_DEFAULTS), whose role and company share line 2 as separate runs.
 */

/** Line width, dot diameter (its white ring included) and the ring, pt. */
export const RAIL_W = TIMELINE_RAIL.width;
export const DOT = 9;
const RING = 1.5;
/** The rail's centre and the entries' text, pt in from the content's left edge. */
export const RAIL_X = DOT / 2;
export const INSET = 16;

/** The date's size: a step under the body text, as a label over the title (never below 7 pt). */
export const timelineDateSize = (settings) => Math.max(7, (settings?.fontSizeBase || 11) - 1);

/** The dot on the rail, level with the middle of the entry's first line (`firstLine`, a lineBox style). */
function Dot({ settings, firstLine }) {
  const top = Math.max(0, capMiddle(firstLine) - DOT / 2);
  return (
    <View
      style={{
        position: 'absolute', left: RAIL_X - DOT / 2 - INSET, top, width: DOT, height: DOT,
        borderRadius: DOT / 2, borderWidth: RING, borderColor: '#ffffff',
        backgroundColor: solid(settings?.accentColor || '#2563eb'),
      }}
    />
  );
}

/**
 * One entry on the rail: its left border is the line, `padTop` the gap above it (the line runs
 * through it). A rendered <View> is unwrapped into it after SPACER, as RenderColGrid's entries are:
 * the entry's header then has a previous sibling, which its minPresenceAhead needs to keep it with
 * the lines under it — as the first child of its own View it was left at the foot of a page alone.
 * `room` (columnRoom): the rail's text column, for PdfRichText to keep a list item whole only while a page can hold it.
 */
function railEntry(el, { padTop = 0, width, settings, key, room }) {
  const rail = {
    ...(width ? { width } : {}), paddingTop: padTop || undefined,
    marginLeft: RAIL_X - RAIL_W / 2, borderLeftWidth: RAIL_W, borderLeftColor: railColor(settings?.accentColor),
    paddingLeft: INSET - RAIL_X - RAIL_W / 2,
  };
  const own = el?.type === View ? [].concat(el.props.style || []) : [];
  return (
    <View key={key} style={[rail, ...own]}>
      {SPACER}
      <ColumnRoom.Provider value={room}>{el?.type === View ? el.props.children : el}</ColumnRoom.Provider>
    </View>
  );
}

/**
 * The section `title` and its entries on the rail — one per row, or `cols` per row (Section Options →
 * Grids), each cell on a rail of its own — as siblings, as RenderColGrid's are, so every entry and every
 * row can move or split on its own at a page break. A grid's rows are RenderColGrid's (gridRows): a row
 * moves whole, with the title on the first, when its cells' headers do not fit — split cell by cell,
 * the right entry printed before the left one (R2-048).
 */
export function TimelineEntries({ items, cols = 1, gap, settings, renderItem, title = null }) {
  const room = columnRoom(settings, railTextWidth(settings, cols));
  if (cols > 1) return gridRows({ items, cols, gap, title, settings, cell: (item, i, width, c) => railEntry(renderItem(item, i), { width, settings, key: c, room }) });
  return (
    <>
      {title}
      {items.map((item, i) => railEntry(renderItem(item, i), { padTop: i ? gap : 0, settings, key: i, room }))}
    </>
  );
}

/**
 * An entry's header on the rail: the date above the title, then the title in its Title style, then
 * the location (see the top of this file for why in this order). `subLine`, an element, stands in
 * for `sub` (a project's technologies and link). Unbreakable and kept with two lines of what follows,
 * as ItemHeader is, so a date and title never sit alone at the foot of a page.
 */
export function TimelineHead({ primary: first, sub: second, subLine, loc, dateStr, settings, titleStyle = 'stacked', italicSub = false, centered = false, below = 0 }) {
  // An empty leading field: the next one leads, bold, as ItemHeader prints it (R2-111).
  const primary = first || second;
  const sub = first ? second : undefined;
  const textColor = settings?.textColor || '#1a1a1a';
  const baseSize  = settings?.fontSizeBase || 11;
  const entrySize = baseSize + (settings?.fontSizeEntryDelta ?? 0);
  const font      = settings?._pdfFontFamily;
  const shade     = textShades(textColor);
  const textAlign = centered ? 'center' : 'left';
  const fontStyle = italicSub ? 'italic' : 'normal';
  const gap       = fieldGap(baseSize);
  const dateSize  = timelineDateSize(settings);
  const subStyle  = { fontSize: baseSize, color: shade.sub, fontStyle, textAlign };
  const locStyle  = { fontSize: baseSize, color: shade.muted, fontStyle, textAlign };
  const keep = { wrap: false, minPresenceAhead: headerKeep(settings, below) };

  const dateLine = dateStr ? (
    <Text style={{ fontSize: dateSize, fontWeight: 'bold', color: getDateColor(settings), textAlign, marginBottom: 1 }}>{dateStr}</Text>
  ) : null;
  const firstLine = dateStr
    ? { fontFamily: font, fontSize: dateSize, fontWeight: 'bold' }
    : { fontFamily: font, fontSize: entrySize, fontWeight: 'bold' };
  const primaryText = primary ? <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: textColor, textAlign }}>{primary}</Text> : null;
  const subText = subLine || (sub ? <Text style={subStyle}>{sub}</Text> : null);
  const style = subLine ? 'stacked' : titleStyle;

  let title;
  if (centered) {
    // Stacked: each field on a centred line of its own. Inline and Side by side: "primary — sub" as one
    // centred line of two runs (a centred pair has no side to put apart), as ItemHeader prints them.
    title = (
      <View style={{ alignItems: 'center' }}>
        {style !== 'stacked' ? inlineTitle({ primary, sub, subStyle, entrySize, textColor, italicSub, textAlign }) : (
          <>
            {primaryText}
            {subText}
          </>
        )}
        {loc ? <Text style={{ ...locStyle, marginTop: 1 }}>{loc}</Text> : null}
      </View>
    );
  } else if (style === 'inline' || style === 'sidebyside') {
    const line = style === 'inline'
      ? inlineTitle({ primary, sub, subStyle, entrySize, textColor, italicSub, textAlign })
      : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: gap }}>
          {primaryText}
          {subText}
        </View>
      );
    // The location on a line of its own under the title, where it starts: beside the title it would
    // squeeze a long one onto two lines, and a title split across lines reads as two (ItemHeader).
    title = (
      <>
        {line}
        {loc ? <Text style={{ ...locStyle, marginTop: 1 }}>{loc}</Text> : null}
      </>
    );
  } else {
    const onSub = onBaselineOf({ fontFamily: font, fontSize: baseSize }, { fontFamily: font, fontSize: baseSize });
    title = (
      <>
        {primaryText}
        {subText || loc ? <EndRow left={subText} leftMin={subLine ? 0 : wordRoom([sub, { fontFamily: font, fontSize: baseSize }])}>{endField(loc, { ...locStyle, lineHeight: onSub }, gap)}</EndRow> : null}
      </>
    );
  }

  return (
    <View {...keep} style={{ marginBottom: 2 }}>
      <Dot settings={settings} firstLine={firstLine} />
      {dateLine}
      {title}
    </View>
  );
}

/**
 * The width an entry's text on the rail is laid out in, pt: the page's text less the rail's INSET, a
 * grid cell's (Section Options → Grids, getColumnWidth's share of it) in a grid.
 */
export const railTextWidth = (settings, cols = 1) => contentWidthPt(settings) * (parseFloat(getColumnWidth(cols)) / 100) - INSET;

/**
 * How much a section title keeps under it so its first entry's TimelineHead (these props) prints on the
 * title's page (SectionTitleOf's `presence`, pt): the date line, the title's lines as TimelineHead lays
 * them out, each field wrapped at the rail's text width (`cols`: the section's Grids; `subText`, the
 * words of a `subLine`), one line more to spare (headPresence), its margins and the two lines it keeps.
 * A fixed five lines fell short of a centred Stacked head with a sub and a location (R4-DOUT-07); a
 * count of one line a field fell short of a field that wraps onto a third line, or of a title and a sub
 * that both wrap, and the section title stayed alone at the foot of a page while the head moved on.
 */
export function timelineHeadPresence({ primary: first, sub: second, subLine, subText: subWords, loc, dateStr, settings, titleStyle = 'stacked', centered = false, cols = 1, below = 0 }) {
  const primary = first || second;
  // The sub's words: a subLine (a project's technologies and link) is one line when they are not given.
  const sub = subLine ? (subWords || '') : (first ? second : '');
  const hasSub = Boolean(subLine || sub);
  const style = subLine ? 'stacked' : titleStyle;
  const oneLine = style === 'inline' || style === 'sidebyside';
  const baseSize = settings?.fontSizeBase || 11;
  const font = settings?._pdfFontFamily;
  const primaryBox = { fontFamily: font, fontSize: baseSize + (settings?.fontSizeEntryDelta ?? 0), fontWeight: 'bold' };
  const subBox = { fontFamily: font, fontSize: baseSize };
  const gap = fieldGap(baseSize);
  const width = railTextWidth(settings, cols);
  const wrap = (text, box) => wrappedLines(text, box, width);
  const subLines = hasSub ? Math.max(1, wrap(sub, subBox)) : 0;
  // One-line styles: both fields on one line where they fit (Inline one text, measured in the
  // primary's wider bold), else each wrapped on its own; centred Stacked: each field on its own lines;
  // Stacked: the primary, then the sub with the location at its right end (EndRow). A location under a
  // one-line or centred title is a line of its own, 1 pt below it.
  const ownLoc = Boolean(loc) && (centered || oneLine);
  const titleLines = style === 'inline' ? wrap([primary, sub].filter(Boolean).join(' — '), primaryBox)
    : primary && hasSub && textWidth(primary, primaryBox) + gap + textWidth(sub, subBox) <= width ? 1
    : wrap(primary, primaryBox) + subLines;
  const lines = oneLine ? titleLines + wrap(loc, subBox)
    : centered ? wrap(primary, primaryBox) + subLines + wrap(loc, subBox)
    : wrap(primary, primaryBox) + (subLine ? subLines : endRowLines({ text: sub, box: subBox, end: loc, endBox: subBox, gap, width }));
  const dateH = dateStr ? lineBox({ fontFamily: font, fontSize: timelineDateSize(settings), fontWeight: 'bold' }).height + 1 : 0;
  return headPresence({ lines, styles: [primaryBox, subBox], keep: headerKeep(settings, below), extra: dateH + 2 + (ownLoc ? 1 : 0) });
}

/** Title "Inline": the primary, then the sub after " — " (", " for an italic sub), in one text of two runs. */
function inlineTitle({ primary, sub, subStyle, entrySize, textColor, italicSub, textAlign }) {
  if (!primary && !sub) return null;
  return (
    <Text style={{ fontSize: entrySize, color: textColor, textAlign }}>
      <Text style={{ fontWeight: 'bold' }}>{primary}</Text>
      {sub ? <Text style={subStyle}>{primary ? (italicSub ? ', ' : ' — ') : ''}{sub}</Text> : null}
    </Text>
  );
}
