import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { getPageStyle, getDocumentProps } from './shared/PdfPage';
import { PdfContactRow } from './shared/PdfContact';
import { SectionRouter, getEffectiveSpacing } from './shared/PdfSections';
import { PdfRichText } from './shared/PdfRichText';
import { getPdfPhotoStyle } from './shared/pdfPhoto';
import { HEADER_BORDER_PAD_PT, HEADER_MARGIN_BOTTOM_PT } from './shared/pdfUnits';

export function ExecutiveTemplatePDF({ data }) {
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

  const headerAlign  = settings.headerAlign || 'left';
  const headerLayout = settings.headerLayout || 'stack';
  const centered     = headerAlign === 'center';
  const headerMb     = Math.max(HEADER_MARGIN_BOTTOM_PT, sectionGap || 0);

  const showHeaderBorder  = settings.showHeaderBorder !== false;
  const headerBorderStyle = showHeaderBorder
    ? {
        borderBottomWidth: settings.headerBorderWidth || 2,
        borderBottomColor: accent,
        paddingBottom: HEADER_BORDER_PAD_PT,
      }
    : {};

  const photoTextAlign = settings.photoTextAlign || 'center';
  const alignItemsVal = photoTextAlign === 'bottom' ? 'flex-end'
    : photoTextAlign === 'center' ? 'center'
      : 'flex-start';

  const nameBlock = headerLayout === 'inline' ? (
    <View style={{
      flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline',
      gap: settings.headerInlineGap ?? 6,
      justifyContent: centered ? 'center' : 'flex-start',
    }}>
      <Text style={{ fontSize: nameSize, fontWeight: 'bold', color: nameColor, lineHeight: 1.2 }}>
        {personal?.name || 'Your Name'}
      </Text>
      {personal?.title && (
        <Text style={{ fontSize: entrySize, color: jobTitleColor, fontWeight: 500, lineHeight: 1.2 }}>
          {personal.title}
        </Text>
      )}
    </View>
  ) : (
    <View>
      <Text style={{
        fontSize: nameSize, fontWeight: 'bold', color: nameColor,
        textAlign: centered ? 'center' : 'left', lineHeight: 1.2,
      }}>
        {personal?.name || 'Your Name'}
      </Text>
      {personal?.title && (
        <Text style={{
          fontSize: entrySize, color: jobTitleColor, marginTop: 1,
          textAlign: centered ? 'center' : 'left', lineHeight: 1.2,
        }}>
          {personal.title}
        </Text>
      )}
    </View>
  );

  const pageStyle = getPageStyle(settings);

  return (
    <Document {...getDocumentProps(personal)}>
      <Page size="A4" style={pageStyle} wrap>
        <View style={[{ marginBottom: headerMb }, headerBorderStyle]} wrap={false}>
          <View style={{
            flexDirection: centered ? 'column' : 'row',
            alignItems: centered ? 'center' : alignItemsVal,
            gap: 10,
          }}>
            {personal?.photo && !hidden.includes('photo') && (
              <Image src={personal.photo} style={getPdfPhotoStyle(settings, accent, 'classic')} />
            )}
            <View style={centered ? { alignItems: 'center', flex: 1 } : { flex: 1 }}>
              {nameBlock}
              <PdfContactRow personal={personal} settings={settings} />
            </View>
          </View>

          {!hidden.includes('summary') && personal?.summary &&
           personal.summary.replace(/<[^>]*>/g, '').trim() && (
            <View style={{ marginTop: 6 }}>
              <PdfRichText
                html={personal.summary}
                style={{
                  fontSize: baseSize,
                  color: '#333333',
                  lineHeight: lineH,
                  textAlign: centered ? 'center' : 'left',
                }}
              />
            </View>
          )}
        </View>

        {sections.map((section) => {
          if (section.visible === false) return null;
          const { marginBottom, spaceBefore, itemGap } = getEffectiveSpacing(section, settings);
          return (
            <View key={section.id} style={spaceBefore != null ? { marginTop: spaceBefore } : undefined} wrap>
              <SectionRouter
                section={section}
                settings={settings}
                marginBottom={marginBottom}
                itemGap={itemGap}
                italicSubs
              />
            </View>
          );
        })}
      </Page>
    </Document>
  );
}
