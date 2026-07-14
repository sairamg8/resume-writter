import { View, Text } from '@react-pdf/renderer';

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
}) {
  const label = sectionTitleCase === 'upper' ? title.toUpperCase() : title;
  const bc = borderColor || accent;
  const textAlignment = centered ? { textAlign: 'center' } : {};
  const accentText  = { fontSize: sectionSize, fontWeight: 'bold', color: accent, letterSpacing: 0.7, lineHeight: lineHeightValue, ...textAlignment };
  const neutralText = { fontSize: sectionSize, fontWeight: 'bold', color: '#374151', letterSpacing: 0.7, lineHeight: lineHeightValue, ...textAlignment };

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

  // Rule/box colors are hand-rolled per template on the Canvas side (each *TemplateHelpers.jsx
  // uses its own fallback/alpha formula), so they must be resolved per template here too rather
  // than sharing one generic constant — a shared constant only happens to match classic/sidebar.
  const ruledColor = template === 'modern' ? (borderColor || accent + '30')
    : template === 'minimal' ? (borderColor || '#d1d5db')
    : template === 'executive' ? (borderColor || '#d1d5db')
    : (borderColor || '#e5e7eb'); // classic, sidebar
  const lineColor = template === 'modern' ? (borderColor || accent + '30')
    : template === 'minimal' ? (borderColor || '#d1d5db')
    : template === 'executive' ? (bc + '50')
    : (borderColor || accent + '40'); // classic, sidebar
  const boxBg = template === 'modern' ? (accent + '14')
    : template === 'minimal' ? (bc + '12')
    : (bc + '14'); // executive, classic, sidebar

  // wrap={false} + minPresenceAhead: keep section title with following content (avoid
  // orphan headings at the bottom of a page that force an extra PDF page vs canvas).
  const keepWithNext = { wrap: false, minPresenceAhead: 28 };

  if (headingStyle === 'ruled') {
    return (
      <View {...keepWithNext} style={{ marginBottom: 6 }}>
        <Text style={titleText}>{label}</Text>
        <View style={{ height: sectionBorderWidth, backgroundColor: ruledColor, marginTop: 2 }} />
      </View>
    );
  }
  if (headingStyle === 'underline') {
    const underlineColor = template === 'minimal' ? (borderColor || '#e5e7eb') : bc;
    return (
      <View {...keepWithNext} style={{ marginBottom: 6, borderBottomWidth: sectionBorderWidth, borderBottomColor: underlineColor, paddingBottom: 2 }}>
        <Text style={titleText}>{label}</Text>
      </View>
    );
  }
  if (headingStyle === 'leftbar') {
    return (
      <View {...keepWithNext} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: centered ? 'center' : 'flex-start', marginBottom: 6 }}>
        <View style={{ width: sectionBorderWidth + 2, backgroundColor: bc, alignSelf: 'stretch', marginRight: 6 }} />
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


