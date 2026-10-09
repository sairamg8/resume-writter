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
import { printedEntries } from '@/utils/entryPrints';
import { dateRange, endDateOf, formatDate, startDateOf } from '@/utils/dates';
import {
  SPACER,
  SectionTitleOf,
  RenderColGrid,
  ItemHeader,
  RenderBullets,
  getColumnWidth,
  entryTextWidth,
  getDateColor,
  shadesOf,
  belowDescription,
} from './PdfSections';
import { CentredLine, EndRow, centredLines, endField, endRowLines, fieldGap, headPresence, headerKeep, itemHeadPresence, onBaselineOf, wordRoom } from './PdfItemHeader';
import { wrappedLines } from './pdfMeasure';

export function CertificationsSection({ section, settings, marginBottom, spaceBefore, itemGap, italicSubs, centered }) {
  const s        = section.settings || {};
  const showDates = s.showDates !== false;
  const entrySize  = (settings?.fontSizeBase || 11) + (settings?.fontSizeEntryDelta ?? 0);
  const baseSize   = settings?.fontSizeBase || 11;
  const textColor  = settings?.textColor  || '#1a1a1a';
  const accent     = settings?.accentColor || '#2563eb';
  const visibleItems = printedEntries(section);
  const cols       = s.columns || 1;
  const textAlign  = centered ? 'center' : 'left';
  const dateColor  = getDateColor(settings);
  const shade      = shadesOf(settings);
  const font       = settings?._pdfFontFamily;
  // The title keeps the first certification, unbreakable: its name line (name, issuer, ID and link)
  // wrapped at the entry's width (a Grids cell's), measured in the name's bolder face, so it errs on
  // more lines — the date at its last line's end, or centred, on a line of its own under it. With only
  // its own three lines, a name line that wrapped onto four left the title alone at the foot of a page
  // while the certification moved on (R5-HUNT3-CERTIFICATIONS-TITLE-NO-PRESENCE).
  const first      = visibleItems[0];
  const headBox    = { fontFamily: font, fontSize: entrySize, fontWeight: 'bold' };
  const dateBox    = { fontFamily: font, fontSize: baseSize };
  const headLines  = (item) => {
    const width = entryTextWidth(settings, cols);
    const date = showDates ? dateRange(item.date, item.expiry, settings) : '';
    const text = [[item.name || item.title, item.issuer].filter(Boolean).join(' — '),
      item.credentialId && `ID: ${item.credentialId}`, item.url && (item.urlLabel || item.url)].filter(Boolean).join(' · ');
    return centered ? Math.max(1, wrappedLines(text, headBox, width)) + (date ? 1 : 0)
      : Math.max(1, endRowLines({ text, box: headBox, end: date, endBox: dateBox, gap: 8, width }));
  };
  const presence   = first ? headPresence({ lines: headLines(first), styles: [headBox, dateBox], extra: centered ? 1 : 0 }) : 0;

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
          const dateStr = showDates ? dateRange(item.date, item.expiry, settings) : '';
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
  const visibleItems = printedEntries(section);
  const cols       = s.columns || 1;
  // Left: stretched, so the date row spans the entry and puts the date at its right end.
  const flexAlign  = centered ? 'center' : 'stretch';
  const textAlign  = centered ? 'center' : 'left';
  const isModern   = settings?._template === 'modern';
  const dateColor  = getDateColor(settings);
  const shade      = shadesOf(settings);
  const font       = settings?._pdfFontFamily;
  // The title keeps the first project's header — its name and date, its technologies and link — and the
  // lines it keeps with it (R2-047), each wrapped at the entry's width (a Grids cell's): the name with
  // the date at its last line's right end (centred, after a " · "), then the technologies and link on
  // one line. Counted as one line each, long technologies with a link that wrapped onto a third line
  // left the title alone at the foot of a page while the project moved on (R4-DOUT-04).
  const first      = visibleItems[0];
  const nameBox    = { fontFamily: font, fontSize: entrySize, fontWeight: 'bold' };
  const metaBox    = { fontFamily: font, fontSize: baseSize };
  // What a project's header keeps under it for its description's first block, when that never splits.
  const belowOf    = (item) => belowDescription(settings, item.description, entrySize - 0.5, lineH, cols);
  const headLines  = (item) => {
    const width = entryTextWidth(settings, cols);
    const date = showDates ? dateRange(startDateOf(item), endDateOf(item, settings), settings) : '';
    const gap = fieldGap(baseSize);
    const name = centered ? centredLines({ text: item.name, box: nameBox, date, dateBox: metaBox, gap, width })
      : Math.max(1, endRowLines({ text: item.name || '', box: nameBox, end: date, endBox: metaBox, gap, width }));
    return name + wrappedLines([item.technologies, item.url].filter(Boolean).join(' · '), metaBox, width);
  };
  const presence   = first ? headPresence({
    lines: headLines(first),
    styles: [nameBox, metaBox],
    keep: headerKeep(settings, belowOf(first)),
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
              <View wrap={false} minPresenceAhead={headerKeep(settings, belowOf(item))} style={{ alignItems: flexAlign, marginBottom: 2 }}>
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
  const visibleItems = printedEntries(section);
  // Section Options → Level (R2-147): Dots or Bar drawn in front of a known proficiency's word, in the
  // accent on a faint track of it (the skill bars' pair); Text (unset) prints the word alone, as before.
  const levelStyle = languageLevelStyle(s);
  const accent    = settings?.accentColor || '#2563eb';
  // Centred: each "English  Native" pair is centred in its column. Left: the language at the
  // left edge, the proficiency at the right — on Compact beside it, a grid cell of one item with its
  // label (T9), two runs a field's gap apart. Rows are spaced by the item gap alone. The proficiency
  // ends at its cell's edge: the right column's (and a single column's) flush with the right margin,
  // in line with the dates (R4-DOUT-14); the cells' 48% widths already leave the gutter between them.
  // A pair too wide for its cell (a narrow column: the Sidebar's Mixed columns at a small Width,
  // R2-147-col) puts the proficiency on the line under the language: the two were shrunk to fit and
  // textkit broke "Portuguese" inside the word. One that fits prints as it always has.
  const pair = centered
    ? { justifyContent: 'center', columnGap: pxToPt(8), flexWrap: 'wrap' }
    : settings?._template === 'compact' ? { justifyContent: 'flex-start', columnGap: fieldGap(baseSize), flexWrap: 'wrap' }
    : { justifyContent: 'space-between', columnGap: fieldGap(baseSize), flexWrap: 'wrap' };

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
  const visibleItems = printedEntries(section);
  const cols       = s.columns || 1;
  const flexAlign  = centered ? 'center' : 'flex-start';
  const textAlign  = centered ? 'center' : 'left';
  const dateColor  = getDateColor(settings);
  const sub        = shadesOf(settings).sub;
  const font       = settings?._pdfFontFamily;
  const dateOf     = (item) => (showDates ? formatDate(item.date || '', settings) : '');
  // An award's title, issuer and date keep two lines of its description with them; with none, no keep:
  // react-pdf would move the block to make room for lines that never come.
  const keepOf     = (item) => (hasRichText(item.description) ? headerKeep(settings, belowDescription(settings, item.description, baseSize, lineH, cols)) : 0);
  // The section's title keeps the first award's block and what the block keeps with it: its own three
  // lines were less, and it was left alone at the foot of a page while that block moved on (R2-047).
  // The title and issuer each wrapped at the entry's width (a Grids cell's), as Projects' header is
  // (R4-DOUT-04): counted as one line each, a title that wrapped onto a third line took more than the
  // spare line, and the section title stayed alone while the award moved on (R5-HUNT3-AWARDS-TITLE-KEEP-UNMEASURED).
  const first      = visibleItems[0];
  const titleBox   = { fontFamily: font, fontSize: entrySize, fontWeight: 'bold' };
  const issuerBox  = { fontFamily: font, fontSize: baseSize };
  const width      = entryTextWidth(settings, cols);
  const presence   = first ? headPresence({
    lines: Math.max(1, wrappedLines(first.title, titleBox, width)) + wrappedLines(first.issuer, issuerBox, width) + (dateOf(first) ? 1 : 0),
    styles: [titleBox, issuerBox],
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
  const visibleItems = printedEntries(section);
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
    below: belowDescription(settings, item.description, entrySize - 0.5, lineH, cols),
  });
  // The title keeps the first entry's header and the lines it keeps with it (R2-047).
  const presence = visibleItems.length ? itemHeadPresence({ ...head(visibleItems[0]), settings, titleStyle, centered, width: entryTextWidth(settings, cols) }) : 0;

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
