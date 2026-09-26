import { View } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { PdfRichText } from './PdfRichText';
import { ContactValue } from './PdfContact';
import { pxToPt } from './pdfUnits';
import { breakLinks } from './pdfFontLoader';
import { tint } from './pdfColors';
import { PdfLevel } from './PdfLevel';
import { languageLevel, languageLevelStyle } from '@/utils/languageLevel';
import { hasRichText, safeHref } from '@/utils/richText';
import { dateRange, endDateOf, formatDate, startDateOf } from '@/utils/dates';
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
import { CentredLine, EndRow, endField, fieldGap, headPresence, headerKeep, itemHeadPresence, onBaselineOf, wordRoom } from './PdfItemHeader';

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
      <RenderColGrid
        title={<SectionTitleOf section={section} settings={settings} centered={centered} />}
        settings={settings}
        items={visibleItems}
        cols={cols}
        gap={itemGap}
        renderItem={(item) => {
          const dateStr = showDates ? dateRange(item.date, item.expiry, settings) : '';
          const font = settings?._pdfFontFamily;
          const onName = onBaselineOf([{ fontFamily: font, fontSize: entrySize, fontWeight: 'bold' }, { fontFamily: font, fontSize: entrySize }], { fontFamily: font, fontSize: baseSize });
          // Each separator only between two fields that print: a certification with no name starts at its
          // issuer, or its ID, never at a dangling ' — ' or ' · ' (R4-DOUT-17).
          const certName = item.name || item.title;
          const nameLine = (
            // A link that does not fit its line breaks inside it rather than run out (R2-105).
            <Text style={{ fontSize: entrySize, color: textColor, textAlign }} hyphenationCallback={item.url ? breakLinks : undefined}>
              {certName ? <Text style={{ fontWeight: 'bold' }}>{certName}</Text> : null}
              {item.issuer ? <Text style={{ color: shade.sub, fontStyle: italicSubs ? 'italic' : 'normal' }}>{certName ? ' — ' : ''}{item.issuer}</Text> : null}
              {item.credentialId ? <Text style={{ color: shade.muted }}>{`${certName || item.issuer ? ' · ' : ''}ID: ${item.credentialId}`}</Text> : null}
              {item.url ? <Text style={{ color: accent }}>{certName || item.issuer || item.credentialId ? ' · ' : ''}<ContactValue value={item.urlLabel || item.url} href={safeHref(item.url)} style={{ color: accent }} /></Text> : null}
            </Text>
          );
          // The name line's widest word, which the date wraps under rather than prints over (R3-002).
          // Not the link's: it breaks where it must (breakLinks).
          const nameBox = { fontFamily: font, fontSize: entrySize };
          const nameMin = wordRoom([item.name || item.title, { ...nameBox, fontWeight: 'bold' }], [item.issuer, nameBox],
            [item.credentialId && `ID: ${item.credentialId}`, nameBox]);
          // Unbreakable: a name that wraps never leaves its date on the page before it (R2-049).
          if (centered) {
            return (
              <View wrap={false} style={{ alignItems: 'center' }}>
                {nameLine}
                {dateStr ? <Text style={{ fontSize: baseSize, color: dateColor, marginTop: 1, textAlign }}>{dateStr}</Text> : null}
              </View>
            );
          }
          return (
            // The date on the name line's LAST line and its baseline, so a name that wraps reads whole (ATS-5).
            <View wrap={false}>
              <EndRow left={nameLine} leftMin={nameMin}>{endField(dateStr, { fontSize: baseSize, color: dateColor, textAlign, lineHeight: onName }, 8)}</EndRow>
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
  // Left: stretched, so the date row spans the entry and puts the date at its right end.
  const flexAlign  = centered ? 'center' : 'stretch';
  const textAlign  = centered ? 'center' : 'left';
  const isModern   = settings?._template === 'modern';
  const dateColor  = getDateColor(settings);
  const shade      = shadesOf(settings);
  const font       = settings?._pdfFontFamily;
  // The title keeps the first project's header — its name and date, its technologies and link — and the
  // lines it keeps with it (R2-047).
  const first      = visibleItems[0];
  const presence   = first ? headPresence({
    lines: 1 + (first.technologies || first.url ? 1 : 0),
    styles: [{ fontFamily: font, fontSize: entrySize, fontWeight: 'bold' }, { fontFamily: font, fontSize: baseSize }],
    keep: headerKeep(settings),
    extra: 2,
  }) : 0;

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <RenderColGrid
        title={<SectionTitleOf section={section} settings={settings} centered={centered} presence={presence} />}
        settings={settings}
        items={visibleItems}
        cols={cols}
        gap={itemGap}
        renderItem={(item) => {
          const dateStr = showDates ? dateRange(startDateOf(item), endDateOf(item, settings), settings) : '';
          // The name alone on the first line with the date, as a job's header prints it: a parser reads
          // a project's header as its first line (ATS-2). Technologies and link on the line under it.
          // Unbreakable and kept with two lines of what follows, as ItemHeader keeps a job's header.
          const name = <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: textColor, textAlign }}>{item.name}</Text>;
          const dateStyle = { fontSize: baseSize, color: dateColor, lineHeight: onBaselineOf({ fontFamily: font, fontSize: entrySize, fontWeight: 'bold' }, { fontFamily: font, fontSize: baseSize }) };
          return (
            <View>
              <View wrap={false} minPresenceAhead={headerKeep(settings)} style={{ alignItems: flexAlign, marginBottom: 2 }}>
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
  // Section Options → Level (R2-147): Dots or Bar drawn in front of a known proficiency's word, in the
  // accent on a faint track of it (the skill bars' pair); Text (unset) prints the word alone, as before.
  const levelStyle = languageLevelStyle(s);
  const accent    = settings?.accentColor || '#2563eb';
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
            {levelStyle && languageLevel(item.proficiency) ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: pxToPt(6) }}>
                <PdfLevel level={languageLevel(item.proficiency)} style={levelStyle} size={baseSize * 0.5} fill={accent} track={tint(accent, 0x20 / 255)} />
                <Text style={{ fontSize: baseSize, color: sub }}>{item.proficiency}</Text>
              </View>
            ) : item.proficiency && <Text style={{ fontSize: baseSize, color: sub }}>{item.proficiency}</Text>}
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
  const font       = settings?._pdfFontFamily;
  const dateOf     = (item) => (showDates ? formatDate(item.date || '', settings) : '');
  // An award's title, issuer and date keep two lines of its description with them; with none, no keep:
  // react-pdf would move the block to make room for lines that never come.
  const keepOf     = (item) => (hasRichText(item.description) ? headerKeep(settings) : 0);
  // The section's title keeps the first award's block and what the block keeps with it: its own three
  // lines were less, and it was left alone at the foot of a page while that block moved on (R2-047).
  const first      = visibleItems[0];
  const presence   = first ? headPresence({
    lines: 1 + (first.issuer ? 1 : 0) + (dateOf(first) ? 1 : 0),
    styles: [{ fontFamily: font, fontSize: entrySize, fontWeight: 'bold' }, { fontFamily: font, fontSize: baseSize }],
    keep: keepOf(first),
    extra: dateOf(first) ? 1 : 0,
  }) : 0;

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <RenderColGrid
        title={<SectionTitleOf section={section} settings={settings} centered={centered} presence={presence} />}
        settings={settings}
        items={visibleItems}
        cols={cols}
        gap={itemGap}
        renderItem={(item) => (
          <View style={{ alignItems: flexAlign }}>
            {/* Title, issuer and date unbreakable and kept with two lines of a description, as ItemHeader
                keeps a job's header: an award's title is never left alone at a page foot (R2-049). */}
            <View wrap={false} minPresenceAhead={keepOf(item)} style={{ alignItems: flexAlign }}>
              <Text style={{ fontSize: entrySize, fontWeight: 'bold', color: textColor, textAlign }}>{item.title}</Text>
              {item.issuer && (
                <Text style={{ fontSize: baseSize, color: sub, fontStyle: italicSubs ? 'italic' : 'normal', textAlign }}>{item.issuer}</Text>
              )}
              {dateOf(item) ? <Text style={{ fontSize: baseSize, color: dateColor, marginTop: 1, textAlign }}>{dateOf(item)}</Text> : null}
            </View>
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
  // An entry's header fields, as ItemHeader prints them.
  const head = (item) => ({
    primary: item.role,
    sub: item.org || undefined,
    loc: (showLoc && item.location ? item.location : '') || undefined,
    dateStr: showDates ? dateRange(startDateOf(item), endDateOf(item, settings), settings) : '',
  });
  // The title keeps the first entry's header and the lines it keeps with it (R2-047).
  const presence = visibleItems.length ? itemHeadPresence({ ...head(visibleItems[0]), settings, titleStyle, centered }) : 0;

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <RenderColGrid
        title={<SectionTitleOf section={section} settings={settings} centered={centered} presence={presence} />}
        settings={settings}
        items={visibleItems}
        cols={cols}
        gap={itemGap}
        renderItem={(item) => {
          return (
            <View>
              <ItemHeader
                {...head(item)}
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
