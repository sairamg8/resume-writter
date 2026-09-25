import { Document, Page, View } from '@react-pdf/renderer';
import { Text } from './shared/PdfText';
import { PdfPageNumbers, getPageStyle, getDocumentProps } from './shared/PdfPage';
import { PdfRunningHeader } from './shared/PdfRunningHeader';
import { SectionRouter, getEffectiveSpacing, getVisibleSections } from './shared/PdfSections';
import { PdfRichText } from './shared/PdfRichText';
import { hasRichText } from '@/utils/richText';
import { PdfContactIcon } from './shared/PdfContactIcon';
import { ContactValue, headerRowWidth } from './shared/PdfContact';
import { bannerContactPt } from './shared/contactSize';
import { fitFontSize } from './shared/pdfMeasure';
import { contactItems } from '@/utils/contacts';
import { getPdfPhotoStyle } from './shared/pdfPhoto';
import { PdfPhoto } from './shared/PdfPhoto';
import { opacityFor } from './shared/pdfColors';
import { MODERN_HEADER_PAD_X_PT, MODERN_HEADER_PAD_Y_PT } from './shared/pdfUnits';
import { photoTextAlignItems } from '@/constants/templates';
import { pageSizeOf } from '@/constants/pageSize';

const CSS_ICON_SCALE = 0.9;

/**
 * The banner's contact row: the same values, links and icons (the chosen pack, or the image
 * uploaded for a field) as every other template. `gaps`: the header's spacing, pt (headerGaps).
 */
function HeaderContact({ personal, settings, textColor, gaps }) {
  // Not rounded to whole points: 15 and 16 px both printed 14 pt, a step that changed nothing (R2-123).
  const iconPt   = Math.max(7, (settings?.iconSize ?? 9) * CSS_ICON_SCALE);
  const textSize = bannerContactPt(settings); // the Word export's contact size on Modern too
  const items = contactItems(personal);

  if (!items.length) return null;
  // Canvas: gap-x-4 gap-y-0.5 → 16px / 2px, the template's own Between contacts / rows (headerGaps)
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: gaps.contactGapX, rowGap: gaps.contactGapY, marginTop: gaps.titleContactsGap }}>
      {items.map(({ key, value, href }) => (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: gaps.iconTextGap }}>
          <PdfContactIcon field={key} settings={settings} size={iconPt} color={textColor} />
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
  const g         = settings.headerGaps; // the header's spacing, pt (TEMPLATES' headerGaps)
  const headerText = settings.headerTextColor || '#ffffff';
  // The summary prints at 85% of the header text colour, the title at 90% of its colour, however
  // the colour is written (#fff, white, rgb(…)); its own alpha multiplies in (FIDB-11, R5-9).
  const summaryOpacity = opacityFor(headerText, 0.85);

  const photoStyle = getPdfPhotoStyle(settings, '#ffffff', 'modern');
  // The name's row on the banner: what the photo beside it and the banner's padding leave. A word
  // of it wider than that has nowhere to break, and react-pdf drew it off the banner and the
  // paper: it prints at the largest size that holds it.
  const name = personal?.name || 'Your Name';
  const nameRow = headerRowWidth(settings, personal, { photoWidth: photoStyle.width, gap: g.photoTextGap }) - 2 * MODERN_HEADER_PAD_X_PT;
  const nameFit = fitFontSize(name, { fontFamily: settings._pdfFontFamily, fontSize: nameSize, fontWeight: 'bold' }, nameRow);

  const pageStyle = getPageStyle(settings);

  return (
    <Document {...getDocumentProps(personal)}>
      <Page size={pageSizeOf(settings)} style={pageStyle} wrap>
        {/* First on every page: after page 1 it prints "Name · Page 2" (ATS-7). */}
        <PdfRunningHeader personal={personal} settings={settings} />
        <View style={{
          backgroundColor: accent,
          borderRadius: 2,
          paddingTop: MODERN_HEADER_PAD_Y_PT,
          paddingBottom: MODERN_HEADER_PAD_Y_PT,
          paddingHorizontal: MODERN_HEADER_PAD_X_PT,
          marginBottom: sectionGap,
        }}>
          {/* Breakable: a summary longer than a page continues on the next, on the banner's colour (R2-046);
              the name row never splits. Photo → Text Position, as Classic, Minimal and Executive take it (R3-0). */}
          <View style={{ flexDirection: 'row', alignItems: photoTextAlignItems(settings), gap: g.photoTextGap }} wrap={false}>
            {personal?.photo && !hidden.includes('photo') && (
              <PdfPhoto src={personal.photo} style={photoStyle} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: nameFit, fontWeight: 'bold', color: nameColor, marginBottom: personal?.title ? g.nameTitleGap : 1, lineHeight: 1.2 }}>
                {name}
              </Text>
              {personal?.title && (
                <Text style={{ fontSize: entrySize, color: jobTitleColor, marginBottom: 2, lineHeight: 1.2, opacity: opacityFor(jobTitleColor, 0.9) }}>
                  {personal.title}
                </Text>
              )}
              <HeaderContact personal={personal} settings={settings} textColor={headerText} gaps={g} />
            </View>
          </View>
          {!hidden.includes('summary') && personal?.summary &&
           hasRichText(personal.summary) && (
            <View style={{ marginTop: 8 }}>
              <PdfRichText
                html={personal.summary}
                style={{ fontSize: baseSize, color: headerText, opacity: summaryOpacity, lineHeight: lineH }}
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
        <PdfPageNumbers settings={settings} />
      </Page>
    </Document>
  );
}
