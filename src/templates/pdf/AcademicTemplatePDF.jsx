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

/**
 * Academic — a scholarly curriculum vitae rather than a one-page résumé: the kind of page a
 * researcher, lecturer or doctoral candidate sends, where education and publications lead and the
 * CV runs to as many pages as the record needs. Picking it (and Reset) brings its type and
 * spacing (TEMPLATES.academic.style): a serif (Source Serif 4), the name centred over the
 * position — the job title, in italic, in the Text colour's grey — and the contacts on one centred
 * line; section titles in small capitals —
 * capitals at the body's own size, in the accent, over a full-width hairline in a lighter tone of
 * it (Ruled; sectionHeadingLook); and a dense measure (Line Height 1.35, 12 px between sections,
 * 6 px between items, 12 pt under the header). Every
 * entry is the shared single column (SectionRouter): its title bold with its dates flush right on
 * that first line, the institution or company under it in italic with the location flush right
 * (PdfItemHeader.jsx), a post leading with the position (TEMPLATE_SECTION_DEFAULTS). Colour is
 * kept to the titles and their hairlines: dates print in the Text grey (getDateColor).
 * Unlike Classic — sans-serif, left-aligned, company first, dates in the accent — and Executive —
 * sans-serif, titles as typed, entries on one line — it reads as a scholar's CV; the header takes
 * every Header Customization control (alignment, Stack or Inline, the rule, contact style, layout,
 * icons and spacing, photo and its position), and every other control applies as on Classic.
 * Multi-page: headings never end a page (PdfSectionTitle keeps them with what follows), entry
 * headers keep two lines of their text with them, and an entry longer than a page splits between
 * its lines. It carries no running header or page numbers: a line repeated on every page lands in
 * the middle of an entry in the text an ATS reads (pdftotext, pdf.js), as a heading drawn as small
 * capitals of two sizes would split the title into two words — so its small capitals are one size.
 * Its default section order — education and publications first — is the Academic CV starter's
 * (starterAcademic.js); picking the template never reorders a résumé's sections.
 * ATS: rated certified, as Classic — one linear column on the white page; the name, position and
 * contacts read in that order, each field of an entry a run of its own (ATS-1, ATS-2, ATS-5).
 * OpenResume's own code reads the demo's every post — title, institution, dates, bullets — exactly,
 * and its profile and education as on Classic.
 */
export function AcademicTemplatePDF({ data }) {
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
  const align        = centered ? 'center' : 'left';
  const g            = settings.headerGaps; // the header's spacing, pt (TEMPLATES' headerGaps)
  // Off unless the résumé turns it on (Academic's letterhead draws its own hairline instead).
  const headerBorderStyle = getHeaderBorderStyle(settings);
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
  // The position under the name, in italic: a CV's affiliation line.
  const title = { fontSize: entrySize, color: jobTitleColor, fontStyle: 'italic', lineHeight: 1.2 };
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
        {/* Before the page's content: react-pdf repeats a fixed element only from where it stands on. */}
        <PdfPageNumbers settings={settings} />
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
              italicSubs
            />
          );
        })}
      </Page>
    </Document>
  );
}
