import { View } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { PdfRichText } from './PdfRichText';
import { hasRichText } from '@/utils/richText';
import { printedEntries } from '@/utils/entryPrints';
import { contactHref } from '@/utils/contacts';
import { formatDate } from '@/utils/dates';
import { tint } from './pdfColors';
import { ContactValue } from './PdfContact';
import { wrappedLines } from './pdfMeasure';
import { headPresence, itemHeadPresence } from './PdfItemHeader';
import { CSS_PX_TO_PT, DEFAULT_ITEM_GAP_PX } from './pdfUnits';
import {
  SPACER,
  SectionTitleOf,
  RenderColGrid,
  ItemHeader,
  RenderBullets,
  getColumnWidth,
  entryTextWidth,
  shadesOf,
  belowDescription,
} from './PdfSections';

export function ReferencesSection({ section, settings, marginBottom, spaceBefore, itemGap, centered }) {
  const s = section.settings || {};
  const cols = s.columns || 2;
  const baseSize  = settings?.fontSizeBase || 11;
  const textColor = settings?.textColor   || '#1a1a1a';
  const accent    = settings?.accentColor || '#2563eb';
  const shade     = shadesOf(settings);
  const visibleItems = printedEntries(section);
  const alignStyle = centered ? { textAlign: 'center' } : {};
  // A card is unbreakable: its title keeps the first row's tallest card with it — each field's lines,
  // wrapped at the card's text width (a Grids cell's, less its padding and border), one more, its padding
  // — or the title was left alone at a page's foot, its cards on the next page (T9: a long Compact résumé
  // at Letter). Counted as one line a field, a card whose job title and company wrapped was taller than
  // that, and the title stayed while the card moved on (R5-HUNT4-PDF-REFERENCES-TITLE-PRESENCE-UNMEASURED).
  const font = settings?._pdfFontFamily;
  const nameBox = { fontFamily: font, fontSize: baseSize, fontWeight: 'bold' };
  const textBox = { fontFamily: font, fontSize: baseSize };
  const cardWidth = entryTextWidth(settings, cols) - 11;
  const lines = (item) => wrappedLines(item.name, nameBox, cardWidth)
    + [item.jobTitle, item.company, item.relationship, item.email, item.phone].reduce((n, f) => n + wrappedLines(f, textBox, cardWidth), 0);
  const firstRow = visibleItems.slice(0, cols);
  const card = firstRow.length ? headPresence({ lines: Math.max(...firstRow.map(lines)), styles: [nameBox, textBox], extra: 12 }) : 0;

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <SectionTitleOf section={section} settings={settings} centered={centered} presence={card} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: itemGap }}>
        {visibleItems.map((item, i) => (
          <View key={i} style={{ width: getColumnWidth(cols), padding: 5, borderWidth: 0.5, borderColor: '#e5e7eb', borderRadius: 3, alignItems: centered ? 'center' : 'flex-start' }} wrap={false}>
            <Text style={{ fontSize: baseSize, fontWeight: 'bold', color: textColor, ...alignStyle }}>{item.name}</Text>
            {item.jobTitle      && <Text style={{ fontSize: baseSize, color: shade.sub, ...alignStyle }}>{item.jobTitle}</Text>}
            {item.company       && <Text style={{ fontSize: baseSize, color: shade.sub, ...alignStyle }}>{item.company}</Text>}
            {item.relationship  && <Text style={{ fontSize: baseSize, color: shade.meta, fontStyle: 'italic', ...alignStyle }}>{item.relationship}</Text>}
            {item.email         && <Text style={{ fontSize: baseSize, color: accent, marginTop: 2, ...alignStyle }}><ContactValue value={item.email} href={contactHref('email', item)} style={{ color: accent }} /></Text>}
            {item.phone         && <Text style={{ fontSize: baseSize, color: shade.meta, ...alignStyle }}><ContactValue value={item.phone} href={contactHref('phone', item)} style={{ color: shade.meta }} /></Text>}
          </View>
        ))}
      </View>
    </View>
  );
}

const CHIP_GAP_PT = 3;
const DEFAULT_ITEM_GAP_PT = DEFAULT_ITEM_GAP_PX * CSS_PX_TO_PT;

/**
 * The chips sit 3 pt apart at the default Between Items (6 pt, Normal) — the skill tags' gap, so the
 * two kinds of chip look alike — and move with Spacing in proportion, as the Sidebar's do (R2-6).
 * They took the whole item gap, twice the tags' spacing (R4-DOUT-15).
 */
export function InterestsSection({ section, settings, marginBottom, spaceBefore, itemGap, centered }) {
  const baseSize = settings?.fontSizeBase || 11;
  const accent   = settings?.accentColor || '#2563eb';
  const visibleItems = printedEntries(section);
  const allInterests = visibleItems.flatMap(item =>
    (item.interests || '').split(',').map(s => s.trim()).filter(Boolean)
  );

  return (
    <View style={{ marginBottom, marginTop: spaceBefore }}>
      {SPACER}
      <SectionTitleOf section={section} settings={settings} centered={centered} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: (CHIP_GAP_PT * itemGap) / DEFAULT_ITEM_GAP_PT, justifyContent: centered ? 'center' : 'flex-start' }}>
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
  const showDates  = s.showDates !== false;
  const entrySize  = (settings?.fontSizeBase || 11) + (settings?.fontSizeEntryDelta ?? 0);
  const lineH      = settings?.lineHeightValue || 1.5;
  const visibleItems = printedEntries(section);
  const cols       = s.columns || 1;
  const accent     = settings?.accentColor || '#2563eb';
  const isModern   = settings?._template === 'modern';
  const body       = shadesOf(settings).body;
  // An entry's header fields, as ItemHeader prints them.
  const head = (item) => ({
    primary: item.title || '',
    sub: item.subtitle || undefined,
    loc: item.location || undefined,
    dateStr: showDates ? formatDate(item.date || '', settings) : '',
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
