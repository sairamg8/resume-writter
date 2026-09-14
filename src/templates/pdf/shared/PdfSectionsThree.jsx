import { View, Text } from '@react-pdf/renderer';
import { PdfRichText } from './PdfRichText';
import { hasRichText } from '@/utils/richText';
import { tint } from './pdfColors';
import {
  SPACER,
  SectionTitleOf,
  RenderColGrid,
  ItemHeader,
  RenderBullets,
  getColumnWidth,
} from './PdfSections';

export function ReferencesSection({ section, settings, marginBottom, spaceBefore, itemGap, centered }) {
  const s = section.settings || {};
  const cols = s.columns || 2;
  const baseSize  = settings?.fontSizeBase || 11;
  const textColor = settings?.textColor   || '#1a1a1a';
  const accent    = settings?.accentColor || '#2563eb';
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  const alignStyle = centered ? { textAlign: 'center' } : {};

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <SectionTitleOf section={section} settings={settings} centered={centered} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: itemGap }}>
        {visibleItems.map((item, i) => (
          <View key={i} style={{ width: getColumnWidth(cols), padding: 5, borderWidth: 0.5, borderColor: '#e5e7eb', borderRadius: 3, alignItems: centered ? 'center' : 'flex-start' }} wrap={false}>
            <Text style={{ fontSize: baseSize, fontWeight: 'bold', color: textColor, ...alignStyle }}>{item.name}</Text>
            {item.jobTitle      && <Text style={{ fontSize: baseSize, color: '#4b5563', ...alignStyle }}>{item.jobTitle}</Text>}
            {item.company       && <Text style={{ fontSize: baseSize, color: '#4b5563', ...alignStyle }}>{item.company}</Text>}
            {item.relationship  && <Text style={{ fontSize: baseSize, color: '#6b7280', fontStyle: 'italic', ...alignStyle }}>{item.relationship}</Text>}
            {item.email         && <Text style={{ fontSize: baseSize, color: accent, marginTop: 2, ...alignStyle }}>{item.email}</Text>}
            {item.phone         && <Text style={{ fontSize: baseSize, color: '#6b7280', ...alignStyle }}>{item.phone}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

export function InterestsSection({ section, settings, marginBottom, spaceBefore, itemGap, centered }) {
  const baseSize = settings?.fontSizeBase || 11;
  const accent   = settings?.accentColor || '#2563eb';
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  const allInterests = visibleItems.flatMap(item =>
    (item.interests || '').split(',').map(s => s.trim()).filter(Boolean)
  );

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <SectionTitleOf section={section} settings={settings} centered={centered} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: itemGap, justifyContent: centered ? 'center' : 'flex-start' }}>
        {allInterests.map((interest, i) => (
          <View key={i} style={{ backgroundColor: tint(accent, 0x12 / 255), borderRadius: 3, paddingHorizontal: 6, paddingVertical: 1 }}>
            <Text style={{ fontSize: baseSize, color: accent }}>{interest}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function CustomSection({ section, settings, marginBottom, spaceBefore, itemGap, italicSubs, centered }) {
  const s        = section.settings || {};
  const titleStyle = s.titleStyle || 'stacked';
  const entrySize  = (settings?.fontSizeBase || 11) + (settings?.fontSizeEntryDelta ?? 0);
  const lineH      = settings?.lineHeightValue || 1.5;
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  const cols       = s.columns || 1;
  const accent     = settings?.accentColor || '#2563eb';
  const isModern   = settings?._template === 'modern';

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <SectionTitleOf section={section} settings={settings} centered={centered} />
      <RenderColGrid
        items={visibleItems}
        cols={cols}
        gap={itemGap}
        renderItem={(item) => {
          return (
            <View>
              <ItemHeader
                primary={item.title || ''}
                sub={item.subtitle || undefined}
                loc={item.location || undefined}
                dateStr={item.date || ''}
                settings={settings}
                titleStyle={titleStyle}
                italicSub={italicSubs}
                centered={centered}
              />
              {hasRichText(item.description) && (
                <PdfRichText html={item.description} style={{ fontSize: entrySize - 0.5, color: '#333333', lineHeight: lineH, marginTop: 2, textAlign: centered ? 'center' : 'left' }} />
              )}
              <RenderBullets bullets={item.bullets} style={{ fontSize: entrySize - 0.5, color: '#333333', lineHeight: lineH, textAlign: centered ? 'center' : 'left' }} accent={accent} isModern={isModern} template={settings?._template} />
            </View>
          );
        }}
      />
    </View>
  );
}
