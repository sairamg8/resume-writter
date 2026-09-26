import { View } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { sectionHeadingLook, SHORT_RULE_EM, titleTracking } from './sectionHeadingLook';
import { sectionIconMark } from './PdfIcons';
import { headingBorderExtraPt, upperSectionTitles } from '@/constants/templates';

/** Keystone's bar at its boxed titles' left edge, pt: Boxed takes no Border thickness (headingBorderControls). */
const KEYSTONE_EDGE = 3;

export function PdfSectionTitle({
  title,
  headingStyle = 'line',
  accent = '#2563eb',
  sectionTitleCase = 'upper',
  sectionSize = 11,
  borderColor = '',
  sectionBorderWidth = 1,
  centered = false,
  template = '',
  lineHeightValue = 1.5,
  presence = 50,
  letterSpacingPct = null,
  pageSidePt = 0,
  icon = null,
  face = {},
}) {
  const label = upperSectionTitles(sectionTitleCase) ? title.toUpperCase() : title;
  const look = sectionHeadingLook({ template, headingStyle, accent, borderColor });
  // Lectern centres every section title; the section's Alignment still places its entries.
  if (look.center) centered = true;
  const textAlignment = centered ? { textAlign: 'center' } : {};
  // Design → Title Spacing, or 0.7 pt unset — narrower below 11.7 pt so small titles still extract as words.
  const letterSpacing = titleTracking(sectionSize, letterSpacingPct);
  // The title in the accent, or neutral dark grey where the template's style prints it so (sectionHeadingLook).
  // `face`: Typography → Heading Font's family, {} while unset (pdfFaces.js headingFace, R2-146).
  const titleText = { ...face, fontSize: sectionSize, fontWeight: 'bold', color: look.text, letterSpacing, lineHeight: lineHeightValue, ...textAlignment };

  // Never leave a heading alone at the bottom of a page: it moves unless `presence` points of
  // the section fit below it. (Works because SPACER gives the title a previous sibling.)
  const keepWithNext = { wrap: false, minPresenceAhead: presence };

  // Design → Section Headings → Icons (R2-147): `icon`, a section type, prints its icon before the
  // words in the title's colour and size — null prints the title exactly as before. In a row that
  // centres its children (Left bar, Line after) the icon is one more child; where the title stands
  // alone (Ruled, Underline, Boxed, Plain) it and the icon share a row, the icon at the middle of
  // the first line, and the words wrap beside it.
  const inRow = sectionIconMark({ type: icon, size: sectionSize, color: look.text });
  const titled = (style) => (icon ? (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: centered ? 'center' : 'flex-start' }}>
      {sectionIconMark({ type: icon, size: sectionSize, color: look.text, lineHeight: lineHeightValue })}
      <Text style={{ ...style, flexShrink: 1 }}>{label}</Text>
    </View>
  ) : <Text style={style}>{label}</Text>);

  // The designed layouts' own marks (sectionHeadingLook's `variant`, R2-138 B2): fills around the one title run.
  const rule = (extra) => <View style={{ height: sectionBorderWidth, backgroundColor: look.ruled, ...extra }} />;
  if (look.variant === 'framed' || look.variant === 'overline') {
    // Gridline: the title between two hairlines. Broadsheet: a rule over the title, as a newspaper heads a column.
    return (
      <View {...keepWithNext} style={{ marginBottom: 6 }}>
        {rule({ marginBottom: 1 })}
        {titled(titleText)}
        {look.variant === 'framed' && rule({ marginTop: 2 })}
      </View>
    );
  }
  if (look.variant === 'dotted' || look.variant === 'double') {
    // Registry: a dotted underline, a ledger's ruling. Chronicle: a double one, a masthead's.
    const under = { borderBottomWidth: sectionBorderWidth, borderBottomColor: look.underline };
    return (
      <View {...keepWithNext} style={{ marginBottom: 6, ...under, borderBottomStyle: look.variant, paddingBottom: look.variant === 'double' ? 1.5 : 2 }}>
        <View style={look.variant === 'double' ? { ...under, paddingBottom: 1.5 } : undefined}>
          {titled(titleText)}
        </View>
      </View>
    );
  }
  if (look.variant === 'soft') {
    // Linen: an underline only as long as the title.
    return (
      <View {...keepWithNext} style={{ flexDirection: 'row', justifyContent: centered ? 'center' : 'flex-start', marginBottom: 6 }}>
        <View style={{ borderBottomWidth: sectionBorderWidth, borderBottomColor: look.underline, paddingBottom: 2, maxWidth: '100%' }}>
          {titled(titleText)}
        </View>
      </View>
    );
  }
  if (look.variant === 'edge' || look.variant === 'bleed') {
    // Keystone: the tinted box with a bar of Border colour at its left edge. Banded: the box's tint runs to
    // the paper's edges (a fill behind the heading), the title on the page's margin.
    const edge = look.variant === 'edge';
    return (
      <View {...keepWithNext} style={{
        backgroundColor: edge ? look.box : undefined, paddingVertical: 3, paddingHorizontal: edge ? 6 : 0, marginBottom: 6,
        ...(edge ? { borderLeftWidth: KEYSTONE_EDGE, borderLeftColor: look.bar } : {}),
      }}>
        {!edge && <View style={{ position: 'absolute', top: 0, bottom: 0, left: -pageSidePt, right: -pageSidePt, backgroundColor: look.box }} />}
        {titled(titleText)}
      </View>
    );
  }

  if (headingStyle === 'ruled') {
    return (
      <View {...keepWithNext} style={{ marginBottom: 6 }}>
        {titled(titleText)}
        <View style={{ height: sectionBorderWidth, backgroundColor: look.ruled, marginTop: 2 }} />
      </View>
    );
  }
  if (headingStyle === 'underline') {
    return (
      <View {...keepWithNext} style={{ marginBottom: 6, borderBottomWidth: sectionBorderWidth, borderBottomColor: look.underline, paddingBottom: 2 }}>
        {titled(titleText)}
      </View>
    );
  }
  if (headingStyle === 'leftbar') {
    return (
      <View {...keepWithNext} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: centered ? 'center' : 'flex-start', marginBottom: 6 }}>
        {/* The bar prints wider than the stored thickness; the panel shows that width (headingBorderExtraPt) */}
        <View style={{ width: sectionBorderWidth + headingBorderExtraPt(headingStyle), backgroundColor: look.bar, alignSelf: 'stretch', marginRight: 6 }} />
        {inRow}
        <Text style={titleText}>{label}</Text>
      </View>
    );
  }
  if (headingStyle === 'box' && look.chip) {
    // Banner: a chip as wide as the title, filled, the title reversed out of it (sectionHeadingLook).
    return (
      <View {...keepWithNext} style={{ flexDirection: 'row', justifyContent: centered ? 'center' : 'flex-start', marginBottom: 6 }}>
        <View style={{ backgroundColor: look.box, paddingVertical: 1, paddingHorizontal: 7, borderRadius: 2, maxWidth: '100%' }}>
          {titled(titleText)}
        </View>
      </View>
    );
  }
  if (headingStyle === 'box') {
    return (
      <View {...keepWithNext} style={{ backgroundColor: look.box, paddingVertical: 3, paddingHorizontal: 6, marginBottom: 6, borderRadius: 2 }}>
        {titled(titleText)}
      </View>
    );
  }
  if (headingStyle === 'line' && look.short) {
    // Compact: a short rule after the title on its line (both sides of a centred one), not to the column's end.
    const rule = <View style={{ width: sectionSize * SHORT_RULE_EM, height: sectionBorderWidth, backgroundColor: look.line }} />;
    return (
      <View {...keepWithNext} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: centered ? 'center' : 'flex-start', gap: 6, marginBottom: 6 }}>
        {centered && rule}
        {sectionIconMark({ type: icon, size: sectionSize, color: look.text, gap: false })}
        <Text style={{ ...titleText, flexShrink: 1 }}>{label}</Text>
        {rule}
      </View>
    );
  }
  if (headingStyle === 'line') {
    return (
      <View {...keepWithNext} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        {centered && <View style={{ flex: 1, height: sectionBorderWidth, backgroundColor: look.line, marginRight: 8 }} />}
        {inRow}
        <Text style={{ ...titleText, marginRight: centered ? 0 : 8 }}>{label}</Text>
        <View style={{ flex: 1, height: sectionBorderWidth, backgroundColor: look.line, marginLeft: centered ? 8 : 0 }} />
      </View>
    );
  }
  // plain
  return (
    <View {...keepWithNext}>
      {titled({ ...titleText, marginBottom: 6 })}
    </View>
  );
}


