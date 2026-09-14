import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { getPageStyle, getDocumentProps, getHeaderBorderStyle } from './shared/PdfPage';
import { PdfContactRow } from './shared/PdfContact';
import { SectionRouter, getEffectiveSpacing, getVisibleSections } from './shared/PdfSections';
import { PdfRichText } from './shared/PdfRichText';
import { hasRichText } from '@/utils/richText';
import { getPdfPhotoStyle } from './shared/pdfPhoto';
import { HEADER_MARGIN_BOTTOM_PT } from './shared/pdfUnits';
import { solid } from './shared/pdfColors';


export function MinimalTemplatePDF({ data }) {
  const { personal, sections = [], settings = {} } = data;
  const {
    accentColor: accent,
    textColor,
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
  // Off unless the user turns it on (the Minimal design has no header rule).
  const headerBorderStyle = getHeaderBorderStyle(settings);

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
      <Text style={{ fontSize: nameSize, fontWeight: 300, color: nameColor, letterSpacing: -0.3, lineHeight: 1.2 }}>
        {personal?.name || 'Your Name'}
      </Text>
      {personal?.title && (
        <Text style={{ fontSize: entrySize, color: jobTitleColor, fontWeight: 500, lineHeight: 1.2 }}>
          {personal.title}
        </Text>
      )}
    </View>
  ) : (
    <View style={centered ? { alignSelf: 'stretch' } : undefined}>
      <Text style={{
        fontSize: nameSize, fontWeight: 300, color: nameColor, letterSpacing: -0.3,
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
            <View style={centered ? { alignItems: 'center', alignSelf: 'stretch' } : { flex: 1 }}>
              {nameBlock}
              <PdfContactRow personal={personal} settings={settings} />
            </View>
          </View>

          {!hidden.includes('summary') && personal?.summary &&
           hasRichText(personal.summary) && (
            <View style={{
              marginTop: 6,
              borderLeftWidth: 2,
              borderLeftColor: solid(accent, 0.4),
              paddingLeft: 8,
            }}>
              <PdfRichText
                html={personal.summary}
                style={{
                  fontSize: baseSize,
                  color: '#555555',
                  lineHeight: lineH,
                  fontStyle: 'italic',
                  textAlign: centered ? 'center' : 'left',
                }}
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
