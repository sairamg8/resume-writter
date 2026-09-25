import { Document, Page, View } from '@react-pdf/renderer';
import { Text } from './PdfText';
import { getDocumentProps, getHeaderBorderStyle, getPageStyle } from './PdfPage';
import { PdfRunningHeader } from './PdfRunningHeader';
import { SectionRouter, getEffectiveSpacing, getVisibleSections } from './PdfSections';
import { headerRowWidth, PdfContactRow } from './PdfContact';
import { fitFontSize } from './pdfMeasure';
import { PdfRichText } from './PdfRichText';
import { hasRichText } from '@/utils/richText';
import { getPdfPhotoStyle } from './pdfPhoto';
import { PdfPhoto } from './PdfPhoto';
import { textShades } from './pdfColors';
import { photoTextAlignItems } from '@/constants/templates';
import { headerTitleSize } from './letterhead';
import { pageSizeOf } from '@/constants/pageSize';

/**
 * The header of the designed layouts (R2-138 B2: Gridline, Registry, Bookend, Lectern, Chronicle, Keystone,
 * Banded, Keel, Linen, Broadsheet): Classic's stacked header — the photo, the name over the job title (or
 * beside it, Inline), the contacts, the summary, the optional bottom rule — with every Header Customization
 * control, and slots where each layout draws its own marks. The marks are fills, never text, so every
 * reader extracts the header as Classic's: name → title → contacts → summary (ATS-1, ATS-2).
 *   top       drawn above the name's row (a bar, a hairline, a rule)
 *   beside    { node, width }: drawn left of the name's block, on its row, `width` pt wide (Keystone's wedge)
 *   underName drawn between the name's block and the contacts (Broadsheet's heavy rule)
 *   bottom    drawn under the summary, inside the header (a closing hairline or double rule)
 *   frame     the header's own box style: a ground, padding, a border at its side
 *   bleed     { top, side } in pt: the frame's ground runs that far past the page margins, to the paper's
 *             edges; the text keeps the margins (Banded's band)
 */
export function PdfDesignedHeader({ personal, settings, top = null, beside = null, underName = null, bottom = null, frame = {}, bleed = null }) {
  const { accentColor: accent, textColor, fontSizeBase: baseSize, nameColor, jobTitleColor, lineHeightValue: lineH } = settings;
  const nameSize  = baseSize + (settings.fontSizeNameDelta ?? 8);
  const entrySize = headerTitleSize(settings); // the job title's (R2-146)
  const hidden    = personal?.hiddenFields || [];

  const centered     = (settings.headerAlign || 'left') === 'center';
  const headerLayout = settings.headerLayout || 'stack';
  const align        = centered ? 'center' : 'left';
  const g            = settings.headerGaps; // the header's spacing, pt (TEMPLATES' headerGaps)
  const headerBorderStyle = getHeaderBorderStyle(settings);
  const photoStyle   = getPdfPhotoStyle(settings, accent, 'classic');
  // What the frame's padding and the mark beside the name take from the row, so the contacts and the name fit.
  const inset = (frame.paddingLeft ?? frame.paddingHorizontal ?? 0) + (frame.paddingRight ?? frame.paddingHorizontal ?? 0)
    + (frame.borderLeftWidth ?? 0) + (beside ? beside.width + g.photoTextGap : 0);
  const contactWidth = headerRowWidth(settings, personal, { photoWidth: photoStyle.width, gap: g.photoTextGap, centered }) - inset;
  // A word of the name wider than the row prints at the largest size that holds it, as Classic's does.
  const name    = personal?.name || 'Your Name';
  const nameFit = fitFontSize(name, { fontFamily: settings._pdfFontFamily, fontSize: nameSize, fontWeight: 'bold' }, contactWidth);

  const nameText = (
    <Text style={{ fontSize: nameFit, fontWeight: 'bold', color: nameColor, lineHeight: 1.2, ...(headerLayout === 'inline' ? {} : { textAlign: align }) }}>
      {name}
    </Text>
  );
  const title = { fontSize: entrySize, color: jobTitleColor, fontWeight: 500, lineHeight: 1.2 };
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
  const summary = !hidden.includes('summary') && personal?.summary && hasRichText(personal.summary);

  return (
    // Breakable: a summary longer than a page continues on the next (R2-046); the name row never splits.
    <View style={[{ marginBottom: g.headerGapBelow }, bleed ? { ...frame, backgroundColor: undefined } : frame, headerBorderStyle]}>
      {bleed && <View style={{ position: 'absolute', top: -bleed.top, left: -bleed.side, right: -bleed.side, bottom: 0, backgroundColor: frame.backgroundColor }} />}
      {top}
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: g.photoTextGap }} wrap={false}>
        {beside?.node}
        <View style={{
          flex: 1,
          flexDirection: centered ? 'column' : 'row',
          alignItems: centered ? 'center' : photoTextAlignItems(settings),
          gap: g.photoTextGap,
        }}>
          {personal?.photo && !hidden.includes('photo') && <PdfPhoto src={personal.photo} style={photoStyle} />}
          <View style={centered ? { alignItems: 'center', alignSelf: 'stretch' } : { flex: 1 }}>
            {nameBlock}
            {underName}
            <PdfContactRow personal={personal} settings={settings} gaps={g} width={contactWidth} />
          </View>
        </View>
      </View>

      {summary && (
        <View style={{ marginTop: g.summaryGap }}>
          <PdfRichText html={personal.summary} style={{ fontSize: baseSize, color: textShades(textColor).body, lineHeight: lineH, textAlign: align }} />
        </View>
      )}
      {bottom}
    </View>
  );
}

/**
 * A designed layout's document: the page, "Name · Page N" first on it after page 1 (ATS-7), the layout's
 * `marks` (fixed fills it repeats on every page, drawn before any text), its `header` and the shared single
 * column of sections (SectionRouter) — headings never end a page, entries move whole or keep two lines of
 * their text with their header, as on Classic. `italicSubs`: an entry's second field in italic.
 */
export function PdfDesignedDocument({ data, header, marks = null, italicSubs = false }) {
  const { personal, sections = [], settings = {} } = data;
  return (
    <Document {...getDocumentProps(personal)}>
      <Page size={pageSizeOf(settings)} style={getPageStyle(settings)} wrap>
        <PdfRunningHeader personal={personal} settings={settings} />
        {marks}
        {header}
        {getVisibleSections(sections).visible.map((section, index, list) => {
          const { marginBottom, spaceBefore, itemGap } = getEffectiveSpacing(section, settings, { isLast: index === list.length - 1 });
          return (
            <SectionRouter
              key={section.id}
              section={section}
              settings={settings}
              spaceBefore={spaceBefore}
              marginBottom={marginBottom}
              itemGap={itemGap}
              italicSubs={italicSubs}
            />
          );
        })}
      </Page>
    </Document>
  );
}
