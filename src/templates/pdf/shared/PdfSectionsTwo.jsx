import { View, Text } from '@react-pdf/renderer';
import { PdfRichText } from './PdfRichText';
import { Value } from './PdfContact';
import { hasRichText, safeHref } from '@/utils/richText';
import {
  SPACER,
  SectionTitleOf,
  RenderColGrid,
  ItemHeader,
  RenderBullets,
  getColumnWidth,
  getDateColor,
} from './PdfSections';

export function CertificationsSection({ section, settings, marginBottom, spaceBefore, itemGap, italicSubs, centered }) {
  const s        = section.settings || {};
  const showDates = s.showDates !== false;
  const entrySize  = (settings?.fontSizeBase || 11) + (settings?.fontSizeEntryDelta ?? 0);
  const baseSize   = settings?.fontSizeBase || 11;
  const textColor  = settings?.textColor  || '#1a1a1a';
  const accent     = settings?.accentColor || '#2563eb';
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  const cols       = s.columns || 1;
  const textAlign  = centered ? 'center' : 'left';
  const dateColor  = getDateColor(settings);

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <SectionTitleOf section={section} settings={settings} centered={centered} />
      <RenderColGrid
        items={visibleItems}
        cols={cols}
        gap={itemGap}
        renderItem={(item) => {
          const dateStr = showDates ? [item.date, item.expiry ? ` – ${item.expiry}` : ''].filter(Boolean).join('') : '';
          const nameLine = (
            <Text style={{ fontSize: entrySize, color: textColor, textAlign }}>
              <Text style={{ fontWeight: 'bold' }}>{item.name || item.title}</Text>
              {item.issuer ? <Text style={{ color: '#4b5563', fontStyle: italicSubs ? 'italic' : 'normal' }}>{' — '}{item.issuer}</Text> : null}
              {item.credentialId ? <Text style={{ color: '#9ca3af' }}>{` · ID: ${item.credentialId}`}</Text> : null}
              {item.url ? <Text style={{ color: accent }}>{' · '}<Value item={{ value: item.urlLabel || item.url, href: safeHref(item.url) }} style={{ color: accent }} /></Text> : null}
            </Text>
          );
          if (centered) {
            return (
              <View style={{ alignItems: 'center' }}>
                {nameLine}
                {dateStr ? <Text style={{ fontSize: baseSize, color: dateColor, marginTop: 1, textAlign }}>{dateStr}</Text> : null}
              </View>
            );
          }
          return (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>{nameLine}</View>
              {dateStr ? <Text style={{ fontSize: baseSize, color: dateColor, flexShrink: 0, marginLeft: 8, textAlign }}>{dateStr}</Text> : null}
            </View>
          );
        }}
      />
    </View>
  );
}

export function ProjectsSection({ section, settings, marginBottom, spaceBefore, itemGap, centered }) {
  const s        = section.settings || {};
  const showDates = s.showDates !== false;
  const entrySize  = (settings?.fontSizeBase || 11) + (settings?.fontSizeEntryDelta ?? 0);
  const baseSize   = settings?.fontSizeBase || 11;
  const textColor  = settings?.textColor   || '#1a1a1a';
  const accent     = settings?.accentColor || '#2563eb';
  const lineH      = settings?.lineHeightValue || 1.5;
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  const cols       = s.columns || 1;
  const flexAlign  = centered ? 'center' : 'flex-start';
  const textAlign  = centered ? 'center' : 'left';
  const isModern   = settings?._template === 'modern';
  const dateColor  = getDateColor(settings);

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <SectionTitleOf section={section} settings={settings} centered={centered} />
      <RenderColGrid
        items={visibleItems}
        cols={cols}
        gap={itemGap}
        renderItem={(item) => {
          const sd = item.startDate || '';
          const ed = item.endDate   || '';
          const dateStr = showDates && (sd || ed) ? `${sd}${ed ? ` – ${ed}` : ''}` : '';
          return (
            <View>
              <View style={{ alignItems: flexAlign, marginBottom: 2 }}>
                <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: textColor, textAlign }}>
                  {item.name}
                  {item.technologies ? <Text style={{ fontSize: baseSize, color: '#6b7280', fontWeight: 'normal' }}>{` · ${item.technologies}`}</Text> : null}
                  {item.url          ? <Text style={{ fontSize: baseSize, color: accent,    fontWeight: 'normal' }}>{' · '}<Value item={{ value: item.url, href: safeHref(item.url) }} style={{ color: accent }} /></Text> : null}
                </Text>
                {dateStr ? <Text style={{ fontSize: baseSize, color: dateColor, marginTop: 1, textAlign }}>{dateStr}</Text> : null}
              </View>
              {hasRichText(item.description) && (
                <PdfRichText html={item.description} style={{ fontSize: entrySize - 0.5, color: '#333333', lineHeight: lineH, marginTop: 2, textAlign }} />
              )}
              <RenderBullets bullets={item.bullets} style={{ fontSize: entrySize - 0.5, color: '#333333', lineHeight: lineH, textAlign }} accent={accent} isModern={isModern} template={settings?._template} />
            </View>
          );
        }}
      />
    </View>
  );
}

export function LanguagesSection({ section, settings, marginBottom, spaceBefore, itemGap, centered }) {
  const s        = section.settings || {};
  const cols     = s.columns || 2;
  const baseSize = settings?.fontSizeBase || 11;
  const textColor = settings?.textColor   || '#1a1a1a';
  const visibleItems = (section.items || []).filter(i => i.visible !== false);

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <SectionTitleOf section={section} settings={settings} centered={centered} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: itemGap }}>
        {visibleItems.map((item, i) => (
          <View key={i} style={{ width: getColumnWidth(cols), flexDirection: 'row', justifyContent: 'space-between', paddingRight: 12, marginBottom: 3 }}>
            <Text style={{ fontSize: baseSize, fontWeight: 'bold', color: textColor }}>{item.language}</Text>
            {item.proficiency && <Text style={{ fontSize: baseSize, color: '#4b5563' }}>{item.proficiency}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

export function AwardsSection({ section, settings, marginBottom, spaceBefore, itemGap, italicSubs, centered }) {
  const s        = section.settings || {};
  const showDates = s.showDates !== false;
  const entrySize  = (settings?.fontSizeBase || 11) + (settings?.fontSizeEntryDelta ?? 0);
  const baseSize   = settings?.fontSizeBase || 11;
  const textColor  = settings?.textColor   || '#1a1a1a';
  const accent     = settings?.accentColor || '#2563eb';
  const lineH      = settings?.lineHeightValue || 1.5;
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  const cols       = s.columns || 1;
  const flexAlign  = centered ? 'center' : 'flex-start';
  const textAlign  = centered ? 'center' : 'left';
  const dateColor  = getDateColor(settings);

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <SectionTitleOf section={section} settings={settings} centered={centered} />
      <RenderColGrid
        items={visibleItems}
        cols={cols}
        gap={itemGap}
        renderItem={(item) => (
          <View style={{ alignItems: flexAlign }}>
            <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: textColor, textAlign }}>{item.title}</Text>
            {item.issuer && (
              <Text style={{ fontSize: baseSize, color: '#4b5563', fontStyle: italicSubs ? 'italic' : 'normal', textAlign }}>{item.issuer}</Text>
            )}
            {showDates && item.date ? <Text style={{ fontSize: baseSize, color: dateColor, marginTop: 1, textAlign }}>{item.date}</Text> : null}
            {hasRichText(item.description) && (
              <PdfRichText html={item.description} style={{ fontSize: baseSize, color: '#4b5563', lineHeight: lineH, marginTop: 1, textAlign }} />
            )}
          </View>
        )}
      />
    </View>
  );
}

export function VolunteeringSection({ section, settings, marginBottom, spaceBefore, itemGap, italicSubs, centered }) {
  const s        = section.settings || {};
  const showDates = s.showDates    !== false;
  const showLoc   = s.showLocation !== false;
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
          const sd = item.startDate || '';
          const ed = item.endDate   || '';
          const dateStr = showDates && (sd || ed) ? `${sd}${ed ? ` – ${ed}` : ''}` : '';
          const loc = showLoc && item.location ? item.location : '';
          return (
            <View>
              <ItemHeader
                primary={item.role}
                sub={item.org || undefined}
                loc={loc || undefined}
                dateStr={dateStr}
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
