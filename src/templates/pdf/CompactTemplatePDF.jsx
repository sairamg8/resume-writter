import { Document, Page, View } from '@react-pdf/renderer';
import { Text } from './shared/PdfText';
import { getPageStyle, getDocumentProps, getHeaderBorderStyle } from './shared/PdfPage';
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

/**
 * Compact — a dense one-page résumé for someone with a long career: as much as fits on a page,
 * still easy to scan. Picking it (and Reset) brings its type and spacing (TEMPLATES.compact.style):
 * 9 pt body text (8.5 pt for the smallest runs — contacts, an education or project description),
 * Line Height 1.3, 12 mm side and 10 mm top and bottom margins, 10 / 5 px between sections / items,
 * and the job title on the name's line (Name & Title Layout "Inline") with the contacts on one line
 * under them. Each section title is an inline heading: the title in the accent in capitals, followed
 * on its own line by a short rule — three times the title's size, in the accent or a picked Border
 * colour, as thick as Border thickness (Line after; sectionHeadingLook's `short`) — where Classic
 * rules the whole column and Academic sets a hairline under a centred serif title. The short
 * sections — skill groups, certifications, awards, languages, references — print as a grid of whole
 * items, two to a row (TEMPLATE_SECTION_DEFAULTS): a cell is one item with its label beside it
 * ("Frontend: React, …", "English  Native", a certification's issuer and date), drawn cell by cell,
 * so pdftotext -raw and pdf.js read the items one after another; the Grids control still sets 1–4.
 * The experience stays one column: its role bold with its dates flush right on that line, the
 * company and location under it (the shared PdfItemHeader, ATS-exact), dates in the Text grey.
 * Unlike Minimal and Classic — 11 pt, airy, one item per line — it trades whitespace for density;
 * the header takes every Header Customization control (alignment, Stack or Inline, the rule,
 * contact style, layout, icons and spacing, photo and its position), and every other control
 * applies as on Classic. The demo résumé fits one page at A4 and at Letter; a longer one runs on:
 * headings never end a page (PdfSectionTitle keeps them with what follows), entry headers keep two
 * lines of their text with them, and a grid row moves or splits cell by cell (RenderColGrid).
 * ATS: rated good, not certified — the experience is one linear column on the white page and reads
 * exactly in every engine, but a grid row's cells share a line, which a line-reading parser takes
 * as one line of two items (each still whole and in order).
 */
export function CompactTemplatePDF({ data }) {
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
  const entrySize = baseSize + (settings.fontSizeEntryDelta ?? 0);
  const hidden    = personal?.hiddenFields || [];

  const centered     = (settings.headerAlign || 'left') === 'center';
  const headerLayout = settings.headerLayout || 'stack';
  const align        = centered ? 'center' : 'left';
  const g            = settings.headerGaps; // the header's spacing, pt (TEMPLATES' headerGaps)
  const headerBorderStyle = getHeaderBorderStyle(settings); // off unless the résumé turns it on
  const photoStyle   = getPdfPhotoStyle(settings, accent, 'classic');
  // The width the contacts are laid out in: what the photo beside them leaves (2 Grid sizes its cells with it).
  const contactWidth = headerRowWidth(settings, personal, { photoWidth: photoStyle.width, gap: g.photoTextGap, centered });
  // A word of the name wider than the row prints at the largest size that holds it, as Classic's does.
  const name    = personal?.name || 'Your Name';
  const nameFit = fitFontSize(name, { fontFamily: settings._pdfFontFamily, fontSize: nameSize, fontWeight: 'bold' }, contactWidth);

  const nameText = (
    <Text style={{ fontSize: nameFit, fontWeight: 'bold', color: nameColor, lineHeight: 1.2, ...(headerLayout === 'inline' ? {} : { textAlign: align }) }}>
      {name}
    </Text>
  );
  const title = { fontSize: entrySize, color: jobTitleColor, fontWeight: 500, lineHeight: 1.2 };
  // Inline (its default): the title on the name's line, a run of its own at the Name & Title gap.
  const nameBlock = headerLayout === 'inline' ? (
    <View style={{
      flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline',
      gap: settings.headerInlineGap ?? 6, justifyContent: centered ? 'center' : 'flex-start',
    }}>
      {nameText}
      {personal?.title && <Text style={title}>{personal.title}</Text>}
    </View>
  ) : (
    <View style={centered ? { alignSelf: 'stretch' } : undefined}>
      {nameText}
      {personal?.title && <Text style={{ ...title, marginTop: g.nameTitleGap, textAlign: align }}>{personal.title}</Text>}
    </View>
  );

  return (
    <Document {...getDocumentProps(personal)}>
      <Page size={pageSizeOf(settings)} style={getPageStyle(settings)} wrap>
        {/* First on every page: after page 1 it prints "Name · Page 2" (ATS-7). */}
        <PdfRunningHeader personal={personal} settings={settings} />
        {/* Breakable: a summary longer than a page continues on the next (R2-046); the name row never splits. */}
        <View style={[{ marginBottom: g.headerGapBelow }, headerBorderStyle]}>
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
