import { Document, Page, View } from '@react-pdf/renderer';
import { Text } from './shared/PdfText';
import { PdfPageNumbers, getPageStyle, getDocumentProps, getHeaderBorderStyle } from './shared/PdfPage';
import { PdfRunningHeader } from './shared/PdfRunningHeader';
import { headerRowWidth, PdfContactRow } from './shared/PdfContact';
import { fitFontSize } from './shared/pdfMeasure';
import { getEffectiveSpacing, getVisibleSections } from './shared/PdfSections';
import { TimelineSectionRouter } from './shared/PdfTimelineSections';
import { PdfRichText } from './shared/PdfRichText';
import { hasRichText } from '@/utils/richText';
import { getPdfPhotoStyle } from './shared/pdfPhoto';
import { PdfPhoto } from './shared/PdfPhoto';
import { textShades } from './shared/pdfColors';
import { photoTextAlignItems } from '@/constants/templates';
import { pageSizeOf } from '@/constants/pageSize';
import { headerTitleSize } from './shared/letterhead';

/**
 * Timeline — one column of sans text in which a résumé's history reads as a timeline. A thin accent
 * line runs down the left of every section whose entries have a header (Experience, Education,
 * Volunteering, Projects and custom sections), with a dot on it at each entry; each entry's dates are
 * set above its title in a small bold accent label, so the eye runs down the dates like a time axis,
 * and the entry's text hangs 16 pt in from the line (shared/PdfTimeline.jsx). Skills, Languages,
 * Certifications, Awards, References and Interests have no history to lay out and print as every
 * template prints them. The header is the stacked one Classic prints, so every Header Customization
 * control applies — alignment, Stack or Inline, contact style and layout, header rule, photo, spacing.
 * Contemporary without a banner or a column: the line and dots are drawn shapes, not text, the body
 * is one column in reading order, and the date, title, company and location are separate runs in that
 * order (ATS-1, ATS-2, ATS-5) — so it parses as a single-column résumé does. Unset, a job leads with
 * the role (TEMPLATE_SECTION_DEFAULTS), and headings print Plain in the accent: the rail is the
 * page's one graphic. The Word résumé keeps the shared single-column layout (date at the right tab);
 * the cover letter's letterhead takes a rule in the rail's colour (letterhead.js LOOKS.timeline).
 */
export function TimelineTemplatePDF({ data }) {
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
  const photoStyle   = getPdfPhotoStyle(settings, accent, 'classic');
  // The width the contacts are laid out in: what the photo beside them leaves (2 Grid sizes its cells with it).
  const contactWidth = headerRowWidth(settings, personal, { photoWidth: photoStyle.width, gap: g.photoTextGap, centered });
  // A word of the name wider than the row prints at the largest size that holds it, as Classic's does.
  const name    = personal?.name || 'Your Name';
  const nameFit = fitFontSize(name, { fontFamily: settings._pdfFontFamily, fontSize: nameSize, fontWeight: 'bold' }, contactWidth);
  const align   = centered ? 'center' : 'left';

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
        {/* First on every page: after page 1 it prints "Name · Page 2" (ATS-7). */}
        <PdfRunningHeader personal={personal} settings={settings} />
        {/* Breakable: a summary longer than a page continues on the next (R2-046); the name row never splits. */}
        <View style={[{ marginBottom: g.headerGapBelow }, getHeaderBorderStyle(settings)]}>
          <View style={{
            flexDirection: centered ? 'column' : 'row',
            alignItems: centered ? 'center' : photoTextAlignItems(settings),
            gap: g.photoTextGap,
          }} wrap={false}>
            {personal?.photo && !hidden.includes('photo') && <PdfPhoto src={personal.photo} style={photoStyle} />}
            <View style={centered ? { alignItems: 'center', alignSelf: 'stretch' } : { flex: 1 }}>
              {nameBlock}
              <PdfContactRow personal={personal} settings={settings} gaps={g} width={contactWidth} />
            </View>
          </View>

          {!hidden.includes('summary') && personal?.summary && hasRichText(personal.summary) && (
            <View style={{ marginTop: g.summaryGap }}>
              <PdfRichText
                html={personal.summary}
                style={{ fontSize: baseSize, color: textShades(textColor).body, lineHeight: lineH, textAlign: align }}
              />
            </View>
          )}
        </View>

        {getVisibleSections(sections).visible.map((section, index, list) => {
          const { marginBottom, spaceBefore, itemGap } = getEffectiveSpacing(section, settings, {
            isLast: index === list.length - 1,
          });
          return (
            <TimelineSectionRouter
              key={section.id}
              section={section}
              settings={settings}
              spaceBefore={spaceBefore}
              marginBottom={marginBottom}
              itemGap={itemGap}
            />
          );
        })}
        {/* Last on every page: its footer is the page's last line drawn, after the résumé's own text (R2-147). */}
        <PdfPageNumbers settings={settings} />
      </Page>
    </Document>
  );
}
