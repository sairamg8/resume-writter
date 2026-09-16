import { View } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { solid, tint } from './pdfColors';
import { tracking } from './pdfUnits';
import { headingBorderExtraPt, upperSectionTitles } from '@/constants/templates';

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
}) {
  const label = upperSectionTitles(sectionTitleCase) ? title.toUpperCase() : title;
  const bc = borderColor || accent;
  const textAlignment = centered ? { textAlign: 'center' } : {};
  // 0.7 pt tracking, narrower below 11.7 pt so small titles still extract as words (tracking()).
  const letterSpacing = tracking(sectionSize, 0.7);
  const accentText  = { fontSize: sectionSize, fontWeight: 'bold', color: accent, letterSpacing, lineHeight: lineHeightValue, ...textAlignment };
  const neutralText = { fontSize: sectionSize, fontWeight: 'bold', color: '#374151', letterSpacing, lineHeight: lineHeightValue, ...textAlignment };

  // Resolve whether the heading text color should be accent or neutral dark gray
  let useAccentText = true;
  if (template === 'minimal') {
    if (headingStyle === 'underline' || headingStyle === 'ruled' || headingStyle === 'leftbar') {
      useAccentText = false;
    }
  } else if (template === 'classic' || template === 'sidebar') {
    if (headingStyle === 'ruled' || headingStyle === 'leftbar') {
      useAccentText = false;
    }
  }

  const titleText = useAccentText ? accentText : neutralText;

  // Rule and box colours per template. Rules and boxes are fills (translucency allowed);
  // the underline is a border, so it is made opaque (see pdfColors.js).
  const ruledColor = template === 'modern' ? (borderColor || tint(accent, 0x30 / 255))
    : template === 'minimal' ? (borderColor || '#d1d5db')
    : template === 'executive' ? (borderColor || '#d1d5db')
    : (borderColor || '#e5e7eb'); // classic, sidebar
  const lineColor = template === 'modern' ? (borderColor || tint(accent, 0x30 / 255))
    : template === 'minimal' ? (borderColor || '#d1d5db')
    : template === 'executive' ? tint(bc, 0x50 / 255)
    : (borderColor || tint(accent, 0x40 / 255)); // classic, sidebar
  const boxBg = template === 'modern' ? tint(accent, 0x14 / 255)
    : template === 'minimal' ? tint(bc, 0x12 / 255)
    : tint(bc, 0x14 / 255); // executive, classic, sidebar

  // Never leave a heading alone at the bottom of a page: it moves unless `presence` points of
  // the section fit below it. (Works because SPACER gives the title a previous sibling.)
  const keepWithNext = { wrap: false, minPresenceAhead: presence };

  if (headingStyle === 'ruled') {
    return (
      <View {...keepWithNext} style={{ marginBottom: 6 }}>
        <Text style={titleText}>{label}</Text>
        <View style={{ height: sectionBorderWidth, backgroundColor: ruledColor, marginTop: 2 }} />
      </View>
    );
  }
  if (headingStyle === 'underline') {
    const underlineColor = solid(template === 'minimal' ? (borderColor || '#e5e7eb') : bc);
    return (
      <View {...keepWithNext} style={{ marginBottom: 6, borderBottomWidth: sectionBorderWidth, borderBottomColor: underlineColor, paddingBottom: 2 }}>
        <Text style={titleText}>{label}</Text>
      </View>
    );
  }
  if (headingStyle === 'leftbar') {
    return (
      <View {...keepWithNext} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: centered ? 'center' : 'flex-start', marginBottom: 6 }}>
        {/* The bar prints wider than the stored thickness; the panel shows that width (headingBorderExtraPt) */}
        <View style={{ width: sectionBorderWidth + headingBorderExtraPt(headingStyle), backgroundColor: bc, alignSelf: 'stretch', marginRight: 6 }} />
        <Text style={titleText}>{label}</Text>
      </View>
    );
  }
  if (headingStyle === 'box') {
    return (
      <View {...keepWithNext} style={{ backgroundColor: boxBg, paddingVertical: 3, paddingHorizontal: 6, marginBottom: 6, borderRadius: 2 }}>
        <Text style={titleText}>{label}</Text>
      </View>
    );
  }
  if (headingStyle === 'line') {
    return (
      <View {...keepWithNext} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        {centered && <View style={{ flex: 1, height: sectionBorderWidth, backgroundColor: lineColor, marginRight: 8 }} />}
        <Text style={{ ...titleText, marginRight: centered ? 0 : 8 }}>{label}</Text>
        <View style={{ flex: 1, height: sectionBorderWidth, backgroundColor: lineColor, marginLeft: centered ? 8 : 0 }} />
      </View>
    );
  }
  // plain
  return (
    <View {...keepWithNext}>
      <Text style={{ ...titleText, marginBottom: 6 }}>{label}</Text>
    </View>
  );
}


