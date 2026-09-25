import { Document, Page, View } from '@react-pdf/renderer';
import { Text } from './shared/PdfText';
import { getPageStyle, getDocumentProps, pageMargins } from './shared/PdfPage';
import { PdfRunningHeader } from './shared/PdfRunningHeader';
import { headerRowWidth, PdfContactRow } from './shared/PdfContact';
import { LinkGround } from './shared/PdfLinkStyle';
import { fitFontSize } from './shared/pdfMeasure';
import { SectionRouter, getEffectiveSpacing, getVisibleSections } from './shared/PdfSections';
import { PdfRichText } from './shared/PdfRichText';
import { hasRichText } from '@/utils/richText';
import { getPdfPhotoStyle } from './shared/pdfPhoto';
import { PdfPhoto } from './shared/PdfPhoto';
import { textShades } from './shared/pdfColors';
import { MM_TO_PT } from './shared/pdfUnits';
import { letterheadLook, headerTitleSize } from './shared/letterhead';
import { bannerPadY, bannerStripPt } from './shared/bannerBand';
import { photoTextAlignItems } from '@/constants/templates';
import { pageSizeOf } from '@/constants/pageSize';

/**
 * Banner — a bold, modern page whose header is a solid band of the accent running edge to edge across
 * the top of the paper: the name, job title and contacts (and the photo, ringed in white) are reversed
 * out of it in the header text colour, and every page after the first carries a thin strip of the same
 * colour along its top edge. Below the band the page is white and one column; the summary opens it
 * under the band, and each section title is a filled accent chip with the title reversed out of it
 * (Boxed, the style picking Banner sets; the other five print as on every template). The body keeps to
 * the Text colour, the dates in its grey (getDateColor): the colour is the band's and the chips'. Unlike Modern,
 * whose banner is a rounded box inside the margins with the summary on it and no header controls, the
 * band here bleeds to the paper's edges while its text keeps the page margins, so it lines up with the
 * body — and it takes every Header Customization control: alignment, Stack or Inline, the header rule
 * (drawn on the band in its text colour), contact style, layout and spacing, photo and its position.
 * ATS: the band and chips are fills, not text; the header reads name, title, contacts in order, and the
 * body is the shared single column (SectionRouter), each entry's role, company, location and dates
 * separate runs (PdfItemHeader.jsx, ATS-1, ATS-2, ATS-5); unset, a job leads with the role
 * (TEMPLATE_SECTION_DEFAULTS). Rated "good", as Modern: the same text flow under a coloured header
 * ground. The Word résumé prints the header on the page (no band) and the chips as shaded headings;
 * the cover letter's letterhead takes the band (letterhead.js LOOKS.banner).
 */
export function BannerTemplatePDF({ data }) {
  const { personal, sections = [], settings = {} } = data;
  const {
    accentColor: accent,
    textColor,
    fontSizeBase: baseSize,
    nameColor,
    jobTitleColor,
    lineHeightValue: lineH,
  } = settings;
  const nameSize  = baseSize + (settings.fontSizeNameDelta  ?? 8);
  const entrySize = headerTitleSize(settings); // the job title's (R2-146)
  const hidden    = personal?.hiddenFields || [];

  const centered     = (settings.headerAlign || 'left') === 'center';
  const headerLayout = settings.headerLayout || 'stack';
  const g            = settings.headerGaps; // the header's spacing, pt (TEMPLATES' headerGaps)
  // The band's colours for its contacts and their marks, as the letter's letterhead prints them.
  const band         = letterheadLook('banner', settings);
  const onBand       = band.contacts;
  const photoStyle   = getPdfPhotoStyle(settings, '#ffffff', 'modern');
  // The width the contacts are laid out in: what the photo beside them leaves (2 Grid sizes its cells with it).
  const contactWidth = headerRowWidth(settings, personal, { photoWidth: photoStyle.width, gap: g.photoTextGap, centered });
  // A word of the name wider than the row prints at the largest size that holds it, as Classic's does.
  const name    = personal?.name || 'Your Name';
  const nameFit = fitFontSize(name, { fontFamily: settings._pdfFontFamily, fontSize: nameSize, fontWeight: 'bold' }, contactWidth);
  const align   = centered ? 'center' : 'left';

  // The fill runs from the paper's top and side edges; the text keeps the page margins (as the letter's band).
  const { v, h } = pageMargins(settings);
  const bleedTop  = v * MM_TO_PT;
  const bleedSide = h * MM_TO_PT;
  const strip     = bannerStripPt(v);
  // Header Customization → Header Bottom Border: on the band under the text, in the band's text colour,
  // as the letter's letterhead draws it (LOOKS.banner). On, the text is padded by its Text ↔ Border gap
  // even at a Thickness no rule is drawn at (an import's -3), as getHeaderBorderStyle pads Classic's.
  const [bandRule] = band.rules;
  const rule = settings.showHeaderBorder ? {
    ...(bandRule ? { borderBottomWidth: bandRule.width, borderBottomColor: bandRule.color } : {}),
    paddingBottom: g.headerRuleGap,
  } : {};
  const summary = !hidden.includes('summary') && personal?.summary && hasRichText(personal.summary);

  const nameText = (
    <Text style={{ fontSize: nameFit, fontWeight: 'bold', color: nameColor, lineHeight: 1.2, ...(headerLayout === 'inline' ? {} : { textAlign: align }) }}>
      {name}
    </Text>
  );
  const nameBlock = headerLayout === 'inline' ? (
    <View style={{
      flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline',
      gap: settings.headerInlineGap ?? 6, justifyContent: centered ? 'center' : 'flex-start',
    }}>
      {nameText}
      {personal?.title && (
        <Text style={{ fontSize: entrySize, color: jobTitleColor, fontWeight: 500, lineHeight: 1.2 }}>{personal.title}</Text>
      )}
    </View>
  ) : (
    <View style={centered ? { alignSelf: 'stretch' } : undefined}>
      {nameText}
      {personal?.title && (
        <Text style={{ fontSize: entrySize, color: jobTitleColor, fontWeight: 500, marginTop: g.nameTitleGap, textAlign: align, lineHeight: 1.2 }}>
          {personal.title}
        </Text>
      )}
    </View>
  );

  return (
    <Document {...getDocumentProps(personal)}>
      <Page size={pageSizeOf(settings)} style={getPageStyle(settings)} wrap>
        {/* Pages 2+: the band carried on as a strip along the paper's top edge (under the band on page 1). */}
        {strip > 0 && <View fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, height: strip, backgroundColor: accent }} />}
        {/* First text on every page: after page 1 it prints "Name · Page 2" (ATS-7), below the strip. */}
        <PdfRunningHeader personal={personal} settings={settings} insetPt={strip} />

        {/* On the band a link's Accent is the tint of it that reads there (Design → Links, R2-147). */}
        <LinkGround.Provider value={accent}>
        <View style={{ paddingBottom: bannerPadY(settings), marginBottom: summary ? g.summaryGap : g.headerGapBelow }} wrap={false}>
          <View style={{ position: 'absolute', top: -bleedTop, left: -bleedSide, right: -bleedSide, bottom: 0, backgroundColor: accent }} />
          <View style={rule}>
            <View style={{
              flexDirection: centered ? 'column' : 'row',
              alignItems: centered ? 'center' : photoTextAlignItems(settings),
              gap: g.photoTextGap,
            }}>
              {personal?.photo && !hidden.includes('photo') && <PdfPhoto src={personal.photo} style={photoStyle} />}
              <View style={centered ? { alignItems: 'center', alignSelf: 'stretch' } : { flex: 1 }}>
                {nameBlock}
                <PdfContactRow personal={personal} settings={settings} gaps={g} width={contactWidth} color={onBand} markColor={band.marks} />
              </View>
            </View>
          </View>
        </View>
        </LinkGround.Provider>

        {summary && (
          <View style={{ marginBottom: g.headerGapBelow }}>
            <PdfRichText
              html={personal.summary}
              style={{ fontSize: baseSize, color: textShades(textColor).body, lineHeight: lineH, textAlign: align }}
            />
          </View>
        )}

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
