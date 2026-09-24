import { View } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { PdfRichText } from './PdfRichText';
import { ContactValue } from './PdfContact';
import { pxToPt } from './pdfUnits';
import { breakLinks } from './pdfFontLoader';
import { hasRichText, safeHref } from '@/utils/richText';
import { dateRange, formatDate } from '@/utils/dates';
import {
  SPACER,
  SectionTitleOf,
  RenderColGrid,
  ItemHeader,
  RenderBullets,
  getColumnWidth,
  getDateColor,
  shadesOf,
} from './PdfSections';
import { CentredLine, EndRow, endField, fieldGap, onBaselineOf, wordRoom } from './PdfItemHeader';

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
  const shade      = shadesOf(settings);

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <SectionTitleOf section={section} settings={settings} centered={centered} />
      <RenderColGrid
        items={visibleItems}
        cols={cols}
        gap={itemGap}
        renderItem={(item) => {
          const dateStr = showDates ? dateRange(item.date, item.expiry, settings) : '';
          const font = settings?._pdfFontFamily;
          const onName = onBaselineOf([{ fontFamily: font, fontSize: entrySize, fontWeight: 'bold' }, { fontFamily: font, fontSize: entrySize }], { fontFamily: font, fontSize: baseSize });
          const nameLine = (
            // A link that does not fit its line breaks inside it rather than run out (R2-105).
            <Text style={{ fontSize: entrySize, color: textColor, textAlign }} hyphenationCallback={item.url ? breakLinks : undefined}>
              <Text style={{ fontWeight: 'bold' }}>{item.name || item.title}</Text>
              {item.issuer ? <Text style={{ color: shade.sub, fontStyle: italicSubs ? 'italic' : 'normal' }}>{' — '}{item.issuer}</Text> : null}
              {item.credentialId ? <Text style={{ color: shade.muted }}>{` · ID: ${item.credentialId}`}</Text> : null}
              {item.url ? <Text style={{ color: accent }}>{' · '}<ContactValue value={item.urlLabel || item.url} href={safeHref(item.url)} style={{ color: accent }} /></Text> : null}
            </Text>
          );
          // The name line's widest word, which the date wraps under rather than prints over (R3-002).
          // Not the link's: it breaks where it must (breakLinks).
          const nameBox = { fontFamily: font, fontSize: entrySize };
          const nameMin = wordRoom([item.name || item.title, { ...nameBox, fontWeight: 'bold' }], [item.issuer, nameBox],
            [item.credentialId && `ID: ${item.credentialId}`, nameBox]);
          if (centered) {
            return (
              <View style={{ alignItems: 'center' }}>
                {nameLine}
                {dateStr ? <Text style={{ fontSize: baseSize, color: dateColor, marginTop: 1, textAlign }}>{dateStr}</Text> : null}
              </View>
            );
          }
          return (
            // The date on the name line's LAST line and its baseline, so a name that wraps reads whole (ATS-5).
            <EndRow left={nameLine} leftMin={nameMin}>{endField(dateStr, { fontSize: baseSize, color: dateColor, textAlign, lineHeight: onName }, 8)}</EndRow>
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
  // Left: stretched, so the date row spans the entry and puts the date at its right end.
  const flexAlign  = centered ? 'center' : 'stretch';
  const textAlign  = centered ? 'center' : 'left';
  const isModern   = settings?._template === 'modern';
  const dateColor  = getDateColor(settings);
  const shade      = shadesOf(settings);

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <SectionTitleOf section={section} settings={settings} centered={centered} />
      <RenderColGrid
        items={visibleItems}
        cols={cols}
        gap={itemGap}
        renderItem={(item) => {
          const dateStr = showDates ? dateRange(item.startDate, item.endDate, settings) : '';
          // The name alone on the first line with the date, as a job's header prints it: a parser reads
          // a project's header as its first line (ATS-2). Technologies and link on the line under it.
          // Unbreakable and kept with two lines of what follows, as ItemHeader keeps a job's header.
          const name = <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: textColor, textAlign }}>{item.name}</Text>;
          const font = settings?._pdfFontFamily;
          const dateStyle = { fontSize: baseSize, color: dateColor, lineHeight: onBaselineOf({ fontFamily: font, fontSize: entrySize, fontWeight: 'bold' }, { fontFamily: font, fontSize: baseSize }) };
          return (
            <View>
              <View wrap={false} minPresenceAhead={Math.round(baseSize * (settings?.lineHeightValue ?? 1.5) * 2)} style={{ alignItems: flexAlign, marginBottom: 2 }}>
                {centered
                  ? <CentredLine first={item.name ? name : null} date={dateStr} dateStyle={dateStyle} sepColor={shade.muted} gap={fieldGap(baseSize)} />
                  : <EndRow left={name} leftMin={wordRoom([item.name, { fontFamily: font, fontSize: entrySize, fontWeight: 'bold' }])}>{endField(dateStr, dateStyle, fieldGap(baseSize))}</EndRow>}
                {item.technologies || item.url ? (
                  <Text style={{ fontSize: baseSize, color: shade.meta, textAlign }} hyphenationCallback={item.url ? breakLinks : undefined}>
                    {item.technologies}
                    {item.url ? <Text style={{ color: accent }}>{item.technologies ? ' · ' : ''}<ContactValue value={item.url} href={safeHref(item.url)} style={{ color: accent }} /></Text> : null}
                  </Text>
                ) : null}
              </View>
              {hasRichText(item.description) && (
                <PdfRichText html={item.description} style={{ fontSize: entrySize - 0.5, color: shade.body, lineHeight: lineH, marginTop: 2, textAlign }} />
              )}
              <RenderBullets bullets={item.bullets} style={{ fontSize: entrySize - 0.5, color: shade.body, lineHeight: lineH, textAlign }} accent={accent} isModern={isModern} template={settings?._template} />
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
  const sub       = shadesOf(settings).sub;
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  // Centred: each "English  Native" pair is centred in its column. Left: the language at the
  // left edge, the proficiency at the right — on Compact beside it, a grid cell of one item with its
  // label (T9), two runs a field's gap apart. Rows are spaced by the item gap alone.
  const pair = centered
    ? { justifyContent: 'center', gap: pxToPt(8) }
    : settings?._template === 'compact' ? { justifyContent: 'flex-start', gap: fieldGap(baseSize) }
    : { justifyContent: 'space-between', paddingRight: 12 };

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <SectionTitleOf section={section} settings={settings} centered={centered} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: itemGap }}>
        {visibleItems.map((item, i) => (
          <View key={i} style={{ width: getColumnWidth(cols), flexDirection: 'row', ...pair }}>
            <Text style={{ fontSize: baseSize, fontWeight: 'bold', color: textColor }}>{item.language}</Text>
            {item.proficiency && <Text style={{ fontSize: baseSize, color: sub }}>{item.proficiency}</Text>}
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
  const lineH      = settings?.lineHeightValue || 1.5;
  const visibleItems = (section.items || []).filter(i => i.visible !== false);
  const cols       = s.columns || 1;
  const flexAlign  = centered ? 'center' : 'flex-start';
  const textAlign  = centered ? 'center' : 'left';
  const dateColor  = getDateColor(settings);
  const sub        = shadesOf(settings).sub;

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
              <Text style={{ fontSize: baseSize, color: sub, fontStyle: italicSubs ? 'italic' : 'normal', textAlign }}>{item.issuer}</Text>
            )}
            {showDates && formatDate(item.date || '', settings) ? <Text style={{ fontSize: baseSize, color: dateColor, marginTop: 1, textAlign }}>{formatDate(item.date || '', settings)}</Text> : null}
            {hasRichText(item.description) && (
              <PdfRichText html={item.description} style={{ fontSize: baseSize, color: sub, lineHeight: lineH, marginTop: 1, textAlign }} />
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
  const body       = shadesOf(settings).body;

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <SectionTitleOf section={section} settings={settings} centered={centered} />
      <RenderColGrid
        items={visibleItems}
        cols={cols}
        gap={itemGap}
        renderItem={(item) => {
          const dateStr = showDates ? dateRange(item.startDate, item.endDate, settings) : '';
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
                <PdfRichText html={item.description} style={{ fontSize: entrySize - 0.5, color: body, lineHeight: lineH, marginTop: 2, textAlign: centered ? 'center' : 'left' }} />
              )}
              <RenderBullets bullets={item.bullets} style={{ fontSize: entrySize - 0.5, color: body, lineHeight: lineH, textAlign: centered ? 'center' : 'left' }} accent={accent} isModern={isModern} template={settings?._template} />
            </View>
          );
        }}
      />
    </View>
  );
}
