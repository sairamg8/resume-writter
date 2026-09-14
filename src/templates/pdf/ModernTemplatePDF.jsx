import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { getPageStyle, getDocumentProps } from './shared/PdfPage';
import { SectionRouter, getEffectiveSpacing, getVisibleSections } from './shared/PdfSections';
import { PdfRichText } from './shared/PdfRichText';
import { hasRichText } from '@/utils/richText';
import { PdfIcon } from './shared/PdfIcons';
import { ContactValue } from './shared/PdfContact';
import { contactItems } from '@/utils/contacts';
import { getPdfPhotoStyle } from './shared/pdfPhoto';
import { MODERN_HEADER_PAD_X_PT, MODERN_HEADER_PAD_Y_PT, pxToPt } from './shared/pdfUnits';

const CSS_ICON_SCALE = 0.9;

/** The banner's contact row — the same values and links as every template (contactItems). */
function HeaderContact({ personal, settings, textColor }) {
  const baseSize = settings?.fontSizeBase || 11;
  const iconPt   = Math.max(7, Math.round((settings?.iconSize ?? 9) * CSS_ICON_SCALE));
  const textSize = baseSize - 1.5;
  const items = contactItems(personal);

  if (!items.length) return null;
  // Canvas: gap-x-4 gap-y-0.5 → 16px / 2px
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: pxToPt(16), rowGap: pxToPt(2), marginTop: 4 }}>
      {items.map(({ key, value, href }) => (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <PdfIcon setId="refined" field={key} size={iconPt} color={textColor} />
          <ContactValue value={value} href={href} style={{ fontSize: textSize, color: textColor, lineHeight: 1.2 }} />
        </View>
      ))}
    </View>
  );
}

export function ModernTemplatePDF({ data }) {
  const { personal, sections = [], settings = {} } = data;
  const {
    accentColor: accent,
    fontSizeBase: baseSize,
    nameColor,
    jobTitleColor,
    lineHeightValue: lineH,
    sectionGap,
  } = settings;
  const nameSize  = baseSize + (settings.fontSizeNameDelta  ?? 8);
  const entrySize = baseSize + (settings.fontSizeEntryDelta ?? 0);
  const hidden    = personal?.hiddenFields || [];
  const headerText = settings.headerTextColor || '#ffffff';
  // Canvas summary uses opacity 0.85 on header text
  const summaryColor = headerText === '#ffffff' || headerText === '#fff'
    ? 'rgba(255,255,255,0.85)'
    : headerText;

  const pageStyle = getPageStyle(settings);

  return (
    <Document {...getDocumentProps(personal)}>
      <Page size="A4" style={pageStyle} wrap>
        <View style={{
          backgroundColor: accent,
          borderRadius: 2,
          paddingTop: MODERN_HEADER_PAD_Y_PT,
          paddingBottom: MODERN_HEADER_PAD_Y_PT,
          paddingHorizontal: MODERN_HEADER_PAD_X_PT,
          marginBottom: sectionGap,
        }} wrap={false}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: pxToPt(16) }}>
            {personal?.photo && !hidden.includes('photo') && (
              <Image src={personal.photo} style={getPdfPhotoStyle(settings, '#ffffff', 'modern')} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: nameSize, fontWeight: 'bold', color: nameColor, marginBottom: 1, lineHeight: 1.2 }}>
                {personal?.name || 'Your Name'}
              </Text>
              {personal?.title && (
                <Text style={{ fontSize: entrySize, color: jobTitleColor, marginBottom: 2, lineHeight: 1.2, opacity: 0.9 }}>
                  {personal.title}
                </Text>
              )}
              <HeaderContact personal={personal} settings={settings} textColor={headerText} />
            </View>
          </View>
          {!hidden.includes('summary') && personal?.summary &&
           hasRichText(personal.summary) && (
            <View style={{ marginTop: 8 }}>
              <PdfRichText
                html={personal.summary}
                style={{ fontSize: baseSize, color: summaryColor, lineHeight: lineH }}
              />
            </View>
          )}
        </View>

        {getVisibleSections(sections).visible.map((section, index, list) => {
          const { marginBottom, spaceBefore, itemGap } = getEffectiveSpacing(section, settings, {
            isLast: index === list.length - 1,
          });
          return (
            <SectionRouter
              key={section.id}
              section={section}
              settings={settings}
              spaceBefore={spaceBefore}
              marginBottom={marginBottom}
              itemGap={itemGap}
            />
          );
        })}
      </Page>
    </Document>
  );
}
