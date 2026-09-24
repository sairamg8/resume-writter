import { View } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { tint, textShades } from './pdfColors';
import { lineBox } from './pdfMeasure';
import { headerTemplateId } from '@/constants/templates';

/**
 * An entry's header — Experience, Education, Volunteering and Custom (ItemHeader), the Sidebar's
 * cards (PdfSidebarSections.jsx), Projects and Certifications (PdfSectionsTwo.jsx) — laid out so a
 * résumé parser reads every field on its own (ATS-1, ATS-2, ATS-5):
 *
 *   - The date sits on the entry's first line: at its right end (Left) or after a " · " (Center).
 *     An item-based parser (OpenResume) reads a job's header as its first 2 lines and a project's
 *     as its first line when the description has no bullet glyph; a date below that was lost.
 *   - The location sits with the date: right-aligned under it, on the sub-line (Title "Stacked")
 *     or a line of its own (Title "Inline" / "Side by side" — beside the date it squeezed the
 *     title onto more lines, and a title split across lines reads as two), or on a centred line
 *     of its own (Center). Printed in the subtitle's own text run after " · " it read as part of
 *     the job title or the company, and no separator glyph can split a run.
 *   - A field at a line's right end sits on the LAST line of the text beside it (the row aligns
 *     its items' bottoms), so a title that wraps reads whole before its date in the readers that
 *     rebuild lines by position (Poppler, pdf.js lines), as Title "Side by side" always did — on
 *     that line's baseline, whatever the two sizes (onBaselineOf).
 *   - Two fields that share a line are separate runs at least fieldGap apart.
 *
 * The on-screen preview is this same PDF painted by pdf.js (PdfPreview.jsx), so it follows.
 */

/** Body and secondary text colours — shades of the user's Text colour (see textShades). */
const shadesOf = (settings) => textShades(settings?.textColor || '#1a1a1a');

export function getDateColor(settings) {
  const template = settings?._template;
  // Banner's colour is its band and heading chips; its entries' dates are the Text colour's grey.
  if (template === 'minimal' || template === 'executive' || template === 'banner') return shadesOf(settings).sub;
  if (template === 'sidebar') return shadesOf(settings).muted;
  return settings?.accentColor || '#2563eb';
}

/**
 * The space between two fields on one line, for text `size`: pdf.js starts a new text item only
 * at a gap wider than 0.6 em (or a font change) and OpenResume merges items closer than about a
 * character's width, so 0.7 em keeps them two fields. 8 pt, the date's gap, is the floor.
 */
export const fieldGap = (size) => Math.max(8, size * 0.7);

/**
 * How far below the title's baseline a field in another size sits, pt. Poppler does not join text
 * of two sizes into one line, and orders two lines on one baseline as it pleases: it read a long
 * certification's dates before the last line of its name. A third of a point lower reads after it,
 * and no one sees it.
 */
const BELOW_PT = 0.3;

/**
 * The lineHeight (a multiple of its font size) that sets a field in `small` style on the baseline
 * of the text in `big` style beside it (lineBox styles; `big` may list several runs), in a row
 * that aligns its items' bottoms: react-pdf draws a baseline its line's ascent below the box's top,
 * so two bottom-aligned boxes share one only when both reach as far below it — `big`'s box less
 * its ascent, plus `small`'s ascent (less BELOW_PT when the sizes differ). The Sidebar card's
 * smaller date sat 1.6 pt high without it, 4.9 pt beside a wrapped title.
 */
export function onBaselineOf(big, small) {
  const b = lineBox(big);
  const s = lineBox(small);
  const below = Math.abs(b.ascent - s.ascent) > 0.01 ? BELOW_PT : 0;
  return (b.height - b.ascent + s.ascent - below) / small.fontSize;
}

/**
 * A row whose `left` side fills the line: flex 1 (basis 0) keeps the fields on its right whole —
 * react-pdf 4 reads flexShrink 0 as 1 (VM3-9). Bottom-aligned: a field on the right sits on the
 * left side's last line, and a field taller than a one-line left side lowers it to its baseline.
 */
export function EndRow({ left, children }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <View style={{ flex: 1 }}>{left}</View>
      {children}
    </View>
  );
}

/** A field at an EndRow's right end, on the last line of the text beside it, `gap` from what precedes it. */
export const endField = (text, style, gap) => (text ? <Text style={{ ...style, marginLeft: gap, alignSelf: 'flex-end' }}>{text}</Text> : null);

/** The "·" before a field of `style` on one line: a run of its own, in its size and line height, `gap` from the field before it. */
export const fieldSep = (style, color, gap) => (
  <Text style={{ fontSize: style.fontSize, ...(style.lineHeight ? { lineHeight: style.lineHeight } : {}), color, marginLeft: gap }}>·</Text>
);

/**
 * One centred line of fields, wrapping between them, not inside a run of two: `first`, then — when
 * there is a `date` — a "·" run and the date, each `gap` from the one before. Bottom-aligned, so
 * `dateStyle`'s lineHeight (onBaselineOf) sets the date on `first`'s baseline, as at an EndRow's end.
 */
export function CentredLine({ first, date, dateStyle, sepColor, gap }) {
  if (!date) return first || null;
  const dateText = <Text style={{ ...dateStyle, textAlign: 'center', ...(first ? { marginLeft: gap } : {}) }}>{date}</Text>;
  if (!first) return dateText;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-end' }}>
      {first}
      {fieldSep(dateStyle, sepColor, gap)}
      {dateText}
    </View>
  );
}

// Reusable item header: bold primary + optional sub-line + location + date. Supports centering.
// `loc` renders in a distinctly lighter shade than `sub`, matching the Canvas templates' two-tone
// convention (subtitle darker, location lighter); it is its own run wherever it prints (see top).
export function ItemHeader({ primary, sub, loc, dateStr, settings, titleStyle = 'stacked', italicSub = false, centered = false }) {
  const textColor  = settings?.textColor  || '#1a1a1a';
  const accent     = settings?.accentColor || '#2563eb';
  const baseSize   = settings?.fontSizeBase || 11;
  const entrySize  = baseSize + (settings?.fontSizeEntryDelta ?? 0);
  const isModern   = settings?._template === 'modern';
  const isSidebar  = settings?._template === 'sidebar';
  const shade      = shadesOf(settings);
  const subColor   = isModern  ? tint(accent, 0.85)
    : isSidebar ? tint(accent, 0.8)
    : shade.sub;
  const textAlign  = centered ? 'center' : 'left';
  const fontStyle  = italicSub ? 'italic' : 'normal';
  const oneLine = titleStyle === 'sidebyside' || titleStyle === 'inline';
  // The two-column Sidebar's page (not its ATS-safe single column, which prints Classic's) sets a
  // lineHeight every text without one inherits: lineHeightValue at the base size.
  const sidebarPage = headerTemplateId(settings?._template, settings) === 'sidebar';
  const pageLine   = sidebarPage ? baseSize * (settings?.lineHeightValue ?? 1.5) : undefined;
  const font       = settings?._pdfFontFamily;
  const primaryBox = { fontFamily: font, fontSize: entrySize, fontWeight: 'bold', lineHeight: pageLine };
  const subBox     = { fontFamily: font, fontSize: baseSize, lineHeight: pageLine };
  const fieldBox   = { fontFamily: font, fontSize: baseSize };
  // A field on the title's line (the date) and on the sub's (the location).
  const onTitle    = onBaselineOf(oneLine ? [primaryBox, subBox] : primaryBox, fieldBox);
  const onSub      = onBaselineOf(subBox, fieldBox);
  const subStyle   = { fontSize: baseSize, color: subColor, fontStyle, textAlign };
  const locStyle   = { fontSize: baseSize, color: shade.muted, fontStyle, textAlign };
  const dateStyle  = { fontSize: baseSize, color: getDateColor(settings), lineHeight: onTitle };
  const gap        = fieldGap(baseSize);
  // Keep the header with at least two lines of what follows it (react-pdf moves it otherwise).
  const keep = { wrap: false, minPresenceAhead: Math.round(baseSize * (settings?.lineHeightValue ?? 1.5) * 2) };
  const primaryText = <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: textColor, textAlign }}>{primary}</Text>;
  // Title "Inline": the primary, then the sub after " — " (", " for an italic sub), in one text.
  const inlineText = primary || sub ? (
    <Text style={{ fontSize: entrySize, color: textColor, textAlign }}>
      <Text style={{ fontWeight: 'bold' }}>{primary}</Text>
      {sub ? <Text style={subStyle}>{italicSub ? ', ' : ' — '}{sub}</Text> : null}
    </Text>
  ) : null;
  const dateField = endField(dateStr, dateStyle, gap);
  // A one-line title's location: right-aligned on a line of its own under the date.
  const locUnder  = loc ? <EndRow left={null}>{endField(loc, locStyle, gap)}</EndRow> : null;

  // Unbreakable, and kept with what follows (`keep`): primary/sub/date never split or orphan.
  if (centered) {
    const locLine = loc ? <Text style={{ ...locStyle, marginTop: 1 }}>{loc}</Text> : null;
    const line = { date: dateStr, dateStyle, sepColor: shade.muted, gap };
    return (
      <View {...keep} style={{ alignItems: 'center', marginBottom: 2 }}>
        <CentredLine first={oneLine ? inlineText : (primary ? primaryText : null)} {...line} />
        {!oneLine && sub ? <Text style={subStyle}>{sub}</Text> : null}
        {locLine}
      </View>
    );
  }

  if (titleStyle === 'sidebyside') {
    return (
      <View {...keep}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 6 }}>
            <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: textColor }}>{primary}</Text>
            {sub ? <Text style={subStyle}>{sub}</Text> : null}
          </View>
          {dateField}
        </View>
        {locUnder}
      </View>
    );
  }

  if (titleStyle === 'inline') {
    return (
      <View {...keep}>
        <EndRow left={inlineText}>{dateField}</EndRow>
        {locUnder}
      </View>
    );
  }

  return (
    <View {...keep}>
      <EndRow left={primaryText}>{dateField}</EndRow>
      {sub || loc ? (
        <EndRow left={sub ? <Text style={subStyle}>{sub}</Text> : null}>{endField(loc, { ...locStyle, lineHeight: onSub }, gap)}</EndRow>
      ) : null}
    </View>
  );
}
