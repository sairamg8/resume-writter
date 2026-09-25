import { Document, Page, View } from '@react-pdf/renderer';
import { Text } from './shared/PdfText';
import { PdfPageNumbers, getPageStyle, getDocumentProps, getHeaderBorderStyle } from './shared/PdfPage';
import { PdfRunningHeader } from './shared/PdfRunningHeader';
import { headerRowWidth, PdfContactRow } from './shared/PdfContact';
import { fitFontSize } from './shared/pdfMeasure';
import { SectionRouter, getEffectiveSpacing, getVisibleSections } from './shared/PdfSections';
import { PdfRichText } from './shared/PdfRichText';
import { hasRichText } from '@/utils/richText';
import { getPdfPhotoStyle } from './shared/pdfPhoto';
import { PdfPhoto } from './shared/PdfPhoto';
import { textShades } from './shared/pdfColors';
import { photoTextAlignItems } from '@/constants/templates';
import { pageSizeOf } from '@/constants/pageSize';
import { headerTitleSize } from './shared/letterhead';

export function ExecutiveTemplatePDF({ data }) {
  const { personal, sections = [], settings = {} } = data;
  const {
    accentColor: accent,
    fontSizeBase: baseSize,
    nameColor,
    jobTitleColor,
    lineHeightValue: lineH,
  } = settings;
  const nameSize  = baseSize + (settings.fontSizeNameDelta  ?? 8);
  const entrySize = headerTitleSize(settings); // the job title's (R2-146)
  const hidden    = personal?.hiddenFields || [];

  const headerAlign  = settings.headerAlign || 'left';
  const headerLayout = settings.headerLayout || 'stack';
  const centered     = headerAlign === 'center';
  const g            = settings.headerGaps; // the header's spacing, pt (TEMPLATES' headerGaps)
  const photoStyle = getPdfPhotoStyle(settings, accent, 'classic');
  // The width the contacts are laid out in: what the photo beside them leaves (2 Grid sizes its cells with it).
  const contactWidth = headerRowWidth(settings, personal, { photoWidth: photoStyle.width, gap: g.photoTextGap, centered });
  // The name has the same row. A word of it wider than the row has nowhere to break, and
  // react-pdf drew it past the margin, off the paper: it prints at the largest size that holds it.
  const name = personal?.name || 'Your Name';
  const nameFit = fitFontSize(name, { fontFamily: settings._pdfFontFamily, fontSize: nameSize, fontWeight: 'bold' }, contactWidth);
  const headerMb     = g.headerGapBelow;
  // Off unless the user turns it on (the Executive design has no header rule).
  const headerBorderStyle = getHeaderBorderStyle(settings);

  const alignItemsVal = photoTextAlignItems(settings); // Photo → Text Position

  const nameBlock = headerLayout === 'inline' ? (
    <View style={{
      flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline',
      gap: settings.headerInlineGap ?? 6,
      justifyContent: centered ? 'center' : 'flex-start',
    }}>
      <Text style={{ fontSize: nameFit, fontWeight: 'bold', color: nameColor, lineHeight: 1.2 }}>
        {name}
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
        fontSize: nameFit, fontWeight: 'bold', color: nameColor,
        textAlign: centered ? 'center' : 'left', lineHeight: 1.2,
      }}>
        {name}
      </Text>
      {personal?.title && (
        <Text style={{
          fontSize: entrySize, color: jobTitleColor, marginTop: g.nameTitleGap,
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
      <Page size={pageSizeOf(settings)} style={pageStyle} wrap>
        {/* First on every page: after page 1 it prints "Name · Page 2" (ATS-7). */}
        <PdfRunningHeader personal={personal} settings={settings} />
        {/* Before the page's content: react-pdf repeats a fixed element only from where it stands on. */}
        <PdfPageNumbers settings={settings} />
        {/* Breakable: a summary longer than a page continues on the next (R2-046); the name row never splits. */}
        <View style={[{ marginBottom: headerMb }, headerBorderStyle]}>
          <View style={{
            flexDirection: centered ? 'column' : 'row',
            alignItems: centered ? 'center' : alignItemsVal,
            gap: g.photoTextGap,
          }} wrap={false}>
            {personal?.photo && !hidden.includes('photo') && (
              <PdfPhoto src={personal.photo} style={photoStyle} />
            )}
            <View style={centered ? { alignItems: 'center', alignSelf: 'stretch' } : { flex: 1 }}>
              {nameBlock}
              <PdfContactRow personal={personal} settings={settings} gaps={g} width={contactWidth} />
            </View>
          </View>

          {!hidden.includes('summary') && personal?.summary &&
           hasRichText(personal.summary) && (
            <View style={{ marginTop: g.summaryGap }}>
              <PdfRichText
                html={personal.summary}
                style={{
                  fontSize: baseSize,
                  color: textShades(settings.textColor).body,
                  lineHeight: lineH,
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
              italicSubs
            />
          );
        })}
      </Page>
    </Document>
  );
}
