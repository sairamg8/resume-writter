import { Document, Page, View, StyleSheet } from '@react-pdf/renderer';
import { Text } from './shared/PdfText';
import { PdfSectionTitle } from './shared/PdfSection';
import { getEffectiveSpacing, SPACER, sectionPrints } from './shared/PdfSections';
import { PdfRichText } from './shared/PdfRichText';
import { hasRichText } from '@/utils/richText';
import { MAIN_PAD_LEFT, PdfPageNumbers, bottomMarginMm, getDocumentProps, pageMargins, sideShare } from './shared/PdfPage';
import { PdfRunningHeader } from './shared/PdfRunningHeader';
import { getPdfPhotoStyle } from './shared/pdfPhoto';
import { PdfPhoto } from './shared/PdfPhoto';
import { CSS_PX_TO_PT, MM_TO_PT, tracking } from './shared/pdfUnits';
import { fitFontSize } from './shared/pdfMeasure';
import { headingFace, nameFace, nameFamily } from './shared/pdfFaces';
import { PdfContactIcon } from './shared/PdfContactIcon';
import { LinkGround } from './shared/PdfLinkStyle';
import { CONTACT_LABELS, contactItems } from '@/utils/contacts';
import { SIDEBAR_TYPES, SideSectionTitle, renderSideSection, SidebarMainSectionRouter } from './shared/PdfSidebarSections';
import { SIDE_PAD_RIGHT, SideValue, sideColumnRoom } from './shared/PdfSidebarColumn';
import { SidebarBand } from './shared/PdfSidebarBand';
import { sidebarShades } from './shared/pdfColors';
import { pageBoxPt, pageSizeOf } from '@/constants/pageSize';
import { sidebarLayout } from '@/constants/layoutOptions';
import { ClassicTemplatePDF } from './ClassicTemplatePDF';
import { SIDE_CONTACT_PT } from './shared/contactSize';
import { headerTitleSize } from './shared/letterhead';

/**
 * How far down a page a row of Mixed's short sections may start and still split there, in lines of body
 * text: a row with less room left moves to the next page whole, so its two sections start side by side.
 * A grid row's keep and its section title's (gridRows in PdfSections.jsx): the two titles, the first
 * entries' headers and two lines under them.
 */
const MIXED_ROW_KEEP_LINES = 10;

/** `section` as a Mixed column prints it: one entry to a row, whatever its Grids (inMixedColumns). */
const oneColumn = (section) => ({ ...section, settings: { ...section.settings, columns: 1 } });

/**
 * A contact in the dark column: icon and label in the column's label colour, not the accent. The
 * value, under its label and in line with it, prints whole on one line (wholeValue): a profile link
 * broken at a hyphen no longer matches as a link to a parser. `iconGap`: Icon ↔ Text, pt — between
 * the icon and the label, and the value's indent past the icon. `below`: the space under it, pt.
 */
function SideContactRow({ field, label, value, href, iconPt, iconGap, below, settings, shades }) {
  return (
    <View style={{ marginBottom: below }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: iconGap, marginBottom: 1 }}>
        <PdfContactIcon field={field} settings={settings} size={iconPt} color={shades.label} />
        <Text style={{ fontSize: 8, fontWeight: 'bold', color: shades.label, letterSpacing: tracking(8, 0.8), lineHeight: 1.2 }}>
          {label.toUpperCase()}
        </Text>
      </View>
      <SideValue
        settings={settings}
        value={value}
        href={href}
        style={{ fontSize: SIDE_CONTACT_PT, color: shades.value, paddingLeft: iconPt + iconGap, lineHeight: 1.2 }}
        inset={iconPt + iconGap}
      />
    </View>
  );
}

export function SidebarTemplatePDF({ data }) {
  const { personal, sections = [], settings = {} } = data;

  // ATS-safe layout: a two-column page is read by y-position, so geometry-based extractors
  // (Poppler, and most applicant-tracking pipelines) interleave the dark column with the main one.
  // Poppler orders text by where it sits and nothing else — the drawing order and a tagged PDF's
  // structure tree are both ignored (ATS-3, measured) — so the only fix is geometric: a single linear
  // column — the proven, parse-clean Classic layout, in the résumé's own colours
  // (nameColor/jobTitleColor resolve dark-on-white in this mode, see templateSettings.js).
  if (settings.sidebarSingleColumn) {
    return <ClassicTemplatePDF data={data} />;
  }
  // Design → Template → Layout (layoutOptions.js, R2-147-col): { columns: 'two' | 'mixed', details:
  // 'left' | 'right' | 'top', widthPct }. Nothing stored is 'two', 'left', 38 %: the page as it always was.
  const layout = sidebarLayout('sidebar', settings);

  const {
    accentColor: accent,
    textColor,
    fontSizeBase: baseSize,
    nameColor,
    jobTitleColor,
    lineHeightValue: lineH,
  } = settings;
  const { v: vMm, h: hMm } = pageMargins(settings);
  const sidebarBg  = settings.sidebarBg || '#1e293b';
  const side       = sidebarShades(sidebarBg); // the column's colours on its background (R2-2)
  const nameSize   = baseSize + (settings.fontSizeNameDelta ?? 8);
  const entrySize  = headerTitleSize(settings); // the job title's (R2-146)
  const sectionGap = settings.sectionGap ?? 12;
  const hidden     = personal?.hiddenFields || [];
  const g          = settings.headerGaps; // the header's spacing, pt (TEMPLATES' headerGaps)

  const visibleSections = sections.filter(sectionPrints);
  const sidebarSections = visibleSections.filter(s => SIDEBAR_TYPES.has(s.type));
  const mainSections    = visibleSections.filter(s => !SIDEBAR_TYPES.has(s.type));

  // Canvas: SideContact uses `st.iconSize ?? 8` as CSS px; PDF points ≈ px * 0.75
  // Not rounded to whole points: 10 and 11 px both printed 8 pt, a step that changed nothing (R2-123).
  const sideIconPt     = Math.max(6, (settings?.iconSize ?? 8) * CSS_PX_TO_PT);
  const sideSectionGap = sectionGap;

  // Classic's photo scaled for the ~38% column by ONE factor, so every Photo → Height option
  // keeps its shape (Square 1:1, Tall 1:1.4, Portrait 1:1.8). Capping width and height
  // separately at 90 pt made Tall and Portrait print the same box (R3-1). The 90 pt width cap
  // cannot bind at today's sizes (Large: 150 pt × 0.55 = 82.5 pt): it keeps a larger size, if one
  // is added, inside the column. A circle's radius follows the scaled width; Rounded and Square
  // keep Classic's corners (7.5 / 2.25 pt), as every Sidebar photo has printed (R7-12).
  const classicPhoto = getPdfPhotoStyle(settings, accent, 'classic', { lightBorder: true });
  const photoScale = Math.min(0.55, 90 / classicPhoto.width);
  const sidePhoto = {
    ...classicPhoto,
    width: classicPhoto.width * photoScale,
    height: classicPhoto.height * photoScale,
    borderRadius: Math.min(classicPhoto.borderRadius, (classicPhoto.width * photoScale) / 2),
    marginBottom: g.photoTextGap, // Photo ↔ Text: the photo sits above the name
  };

  const contacts = contactItems(personal);

  // The name's and the job title's room: the column inside its padding. A word of either wider
  // than that has nowhere to break, and react-pdf drew it out of the column over the main one (a
  // 35-letter surname even at the default 19 pt, "Softwareentwicklungsingenieurin" at 11 pt): each
  // prints at the largest size that holds it.
  const room = sideColumnRoom(settings);
  // No name yet prints 'Your Name', as every other template, its Word export and its letterhead do (R4-PDF-04).
  const name = personal?.name || 'Your Name';
  const nameFit = fitFontSize(name, { fontFamily: nameFamily(settings), fontSize: nameSize, fontWeight: 'bold' }, room);
  const titleFit = fitFontSize(personal?.title, { fontFamily: settings._pdfFontFamily, fontSize: entrySize }, room);

  // Top and bottom margins belong to the page, so react-pdf repeats them on every page; a
  // column's own padding applies only where the column starts and ends (pages 2+ used to print
  // from the paper edge). The fixed sidebar background still bleeds to the edges.
  const pageStyle = StyleSheet.create({
    page: {
      fontFamily: settings._pdfFontFamily || 'NotoSans',
      paddingTop: `${vMm}mm`,
      paddingBottom: `${Math.max(0, bottomMarginMm(settings) - 0.5)}mm`,
      paddingLeft: 0,
      paddingRight: 0,
      // Design → Template → Layout (sidebarLayout, R2-147-col): the side column at the left of a row
      // (Details Left, as always), at its right (Right: row-reverse, so the details are still the page's
      // first text drawn and a reader meets the name first), or a band and what follows it, top down.
      flexDirection: layout.details === 'top' ? 'column' : layout.details === 'right' ? 'row-reverse' : 'row',
      fontSize: baseSize,
      lineHeight: lineH,
      backgroundColor: 'white',
    },
  }).page;

  // The side column's share of the paper (Design → Template → Layout → Width, sideShare: 38 % unset).
  const share = sideShare(settings);
  const sidePct = `${share * 100}%`;
  const pageW = pageBoxPt(settings).width;
  const hPt = hMm * MM_TO_PT;
  // With the column on the right, the running header and the page numbers end at the main column's text.
  const mainEndPt = pageW * share + MAIN_PAD_LEFT;

  // Personal Info → Header spacing → Header ↔ First section: the name block ↔ the column's first
  // section, its Contact where it has one (unset, Between Sections).
  const nameBlock = (
    <View style={{ marginBottom: g.headerGapBelow, alignItems: 'center' }} wrap={false}>
      {personal?.photo && !hidden.includes('photo') && (
        <PdfPhoto src={personal.photo} style={sidePhoto} />
      )}
      <Text style={{
        ...nameFace(settings), fontSize: nameFit, fontWeight: 'bold', color: nameColor,
        textAlign: 'center', marginBottom: personal?.title ? g.nameTitleGap : 2, lineHeight: 1.2,
      }}>
        {name}
      </Text>
      {personal?.title && (
        <Text style={{
          fontSize: titleFit, color: jobTitleColor,
          textAlign: 'center', marginBottom: 6, lineHeight: 1.2,
        }}>
          {personal.title}
        </Text>
      )}
    </View>
  );

  const contactBlock = contacts.length > 0 && (
    <View style={{ marginBottom: sideSectionGap }}>
      <SideSectionTitle title="Contact" type="contact" shades={side} titleCase={settings.sectionTitleCase} settings={settings} />
      <View style={{ marginTop: 2 }}>
        {contacts.map((item, i) => (
          <SideContactRow
            key={item.key}
            field={item.key}
            label={CONTACT_LABELS[item.key]}
            value={item.value}
            href={item.href}
            iconPt={sideIconPt}
            iconGap={g.iconTextGap}
            // Between contact rows; the last one's 6 pt is the Contact block's own, above the next section.
            below={i < contacts.length - 1 ? g.contactGapY : 6}
            settings={settings}
            shades={side}
          />
        ))}
      </View>
    </View>
  );

  const sideSectionViews = sidebarSections.map((section, index) => {
    // The main column's rule (Item gap override → spacing preset → global), so the
    // section's Spacing control works in both columns (FIDB-38).
    const { marginBottom, spaceBefore, itemGap: ig } = getEffectiveSpacing(section, settings, {
      isLast: index === sidebarSections.length - 1,
    });
    return (
      <View key={section.id} style={spaceBefore != null ? { marginTop: spaceBefore } : undefined}>
        {SPACER}
        {renderSideSection(section, marginBottom, ig, accent, side, settings.sectionTitleCase, settings)}
      </View>
    );
  });

  const summaryView = !hidden.includes('summary') && personal?.summary &&
   hasRichText(personal.summary) && (
    <View style={{ marginBottom: sectionGap }}>
      {SPACER}
      <PdfSectionTitle
        title="About Me"
        headingStyle={settings.headingStyle}
        accent={accent}
        sectionTitleCase={settings.sectionTitleCase || 'upper'}
        sectionSize={baseSize + (settings.fontSizeSectionDelta ?? 1)}
        borderColor={settings.sectionBorderColor || ''}
        sectionBorderWidth={settings.sectionBorderWidth ?? 1}
        template="sidebar"
        lineHeightValue={settings.lineHeightValue ?? 1.5}
        letterSpacingPct={settings.sectionLetterSpacing}
        icon={settings.sectionIcons ? 'summary' : null}
        face={headingFace(settings)}
        presence={Math.round(baseSize * lineH * 3)}
      />
      <PdfRichText
        html={personal.summary}
        style={{ fontSize: baseSize, color: textColor, lineHeight: lineH }}
      />
    </View>
  );

  // Mixed prints the short sections after the main ones, so the last main section keeps its gap below.
  const mixed = layout.columns === 'mixed';
  const mainSectionViews = mainSections.map((section, index) => {
    const { marginBottom, spaceBefore, itemGap: ig } = getEffectiveSpacing(section, settings, {
      isLast: index === mainSections.length - 1 && !(mixed && sidebarSections.length),
    });
    return (
      <SidebarMainSectionRouter
        key={section.id}
        section={section}
        settings={settings}
        spaceBefore={spaceBefore}
        marginBottom={marginBottom}
        itemGap={ig}
      />
    );
  });

  // The side column: its details on Left and Right (none under a band), then its sections.
  const sideColumn = (
    // On the column a link's Accent is the tint of it that reads there (Design → Links, R2-147).
    <LinkGround.Provider value={sidebarBg}>
    <View style={{
      width: sidePct,
      backgroundColor: 'transparent',
      paddingLeft: layout.details === 'right' ? SIDE_PAD_RIGHT : `${hMm}mm`,
      paddingRight: layout.details === 'right' ? `${hMm}mm` : SIDE_PAD_RIGHT,
      color: side.strong,
    }}>
      {layout.details === 'top' ? SPACER : nameBlock}
      {layout.details === 'top' ? null : contactBlock}
      {sideSectionViews}
    </View>
    </LinkGround.Provider>
  );

  const mainColumn = (
    <View style={{
      flex: 1,
      paddingLeft: layout.details === 'right' ? `${hMm}mm` : MAIN_PAD_LEFT,
      paddingRight: layout.details === 'right' ? MAIN_PAD_LEFT : `${hMm}mm`,
      color: textColor,
    }}>
      {layout.details === 'top' ? SPACER : null}
      {summaryView}
      {mainSectionViews}
    </View>
  );

  // The details on a band across the top (Details Top, and Mixed), in the column's colours.
  const band = (
    <LinkGround.Provider value={sidebarBg}>
      <SidebarBand personal={personal} settings={settings} shades={side} background={sidebarBg} photo={sidePhoto} />
    </LinkGround.Provider>
  );

  if (mixed) {
    // Mixed: the band, the main sections across the page, then the short sections two to a row — the
    // first in a column the side column's width, the second in the rest — each a column of its own,
    // one entry to a row (inMixedColumns), laid out at its own width (_columnWidthPt, mainTextWidthPt).
    const cell = { left: pageW * share - hPt - SIDE_PAD_RIGHT, right: pageW * (1 - share) - MAIN_PAD_LEFT - hPt };
    const rows = [];
    for (let i = 0; i < sidebarSections.length; i += 2) rows.push(sidebarSections.slice(i, i + 2));
    const keep = Math.round(baseSize * lineH * MIXED_ROW_KEEP_LINES);
    const inCell = (section, width, last) => {
      if (!section) return null;
      const { marginBottom, spaceBefore, itemGap: ig } = getEffectiveSpacing(section, settings, { isLast: last });
      return (
        <SidebarMainSectionRouter
          section={oneColumn(section)}
          settings={{ ...settings, _columnWidthPt: width }}
          spaceBefore={spaceBefore}
          marginBottom={marginBottom}
          itemGap={ig}
        />
      );
    };
    return (
      <Document {...getDocumentProps(personal)}>
        <Page size={pageSizeOf(settings)} style={pageStyle} wrap>
          <PdfRunningHeader personal={personal} settings={settings} />
          {band}
          <View style={{ paddingLeft: `${hMm}mm`, paddingRight: `${hMm}mm`, color: textColor }}>
            {SPACER}
            {summaryView}
            {mainSectionViews}
          </View>
          {rows.map((row, r) => (
            // A row of two: led by a mark that keeps MIXED_ROW_KEEP_LINES of it on its page (minPresenceAhead,
            // after SPACER), so a row with less room left moves on whole and its sections start side by side.
            <View key={row[0].id}>
              {SPACER}
              <View minPresenceAhead={keep} />
              <View style={{ flexDirection: 'row', color: textColor }}>
                <View style={{ width: sidePct, paddingLeft: `${hMm}mm`, paddingRight: SIDE_PAD_RIGHT }}>
                  {SPACER}
                  {inCell(row[0], cell.left, r === rows.length - 1)}
                </View>
                <View style={{ flex: 1, paddingLeft: MAIN_PAD_LEFT, paddingRight: `${hMm}mm` }}>
                  {SPACER}
                  {inCell(row[1], cell.right, r === rows.length - 1)}
                </View>
              </View>
            </View>
          ))}
          <PdfPageNumbers settings={settings} />
        </Page>
      </Document>
    );
  }

  if (layout.details === 'top') {
    // Details Top: the band, then the side column and the main column beneath it. The column's fill runs
    // the paper's height on every page, as on Left; on page 1 the band, in the same colour, covers its top.
    return (
      <Document {...getDocumentProps(personal)}>
        <Page size={pageSizeOf(settings)} style={pageStyle} wrap>
          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: sidePct, backgroundColor: sidebarBg }} fixed />
          <PdfRunningHeader personal={personal} settings={settings} left={sidePct} />
          {band}
          <View style={{ flexDirection: 'row' }}>
            {sideColumn}
            {mainColumn}
          </View>
          <PdfPageNumbers settings={settings} />
        </Page>
      </Document>
    );
  }

  if (layout.details === 'right') {
    // Details Right: the side column on the right (row-reverse), its fill along the paper's right edge;
    // the running header and the page numbers end at the main column's text, clear of the column.
    return (
      <Document {...getDocumentProps(personal)}>
        <Page size={pageSizeOf(settings)} style={pageStyle} wrap>
          <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: sidePct, backgroundColor: sidebarBg }} fixed />
          <PdfRunningHeader personal={personal} settings={settings} right={mainEndPt} />
          {sideColumn}
          {mainColumn}
          <PdfPageNumbers settings={settings} right={mainEndPt} />
        </Page>
      </Document>
    );
  }

  // Details Left — every résumé that stores no layout: the page exactly as it always printed.
  return (
    <Document {...getDocumentProps(personal)}>
      <Page size={pageSizeOf(settings)} style={pageStyle} wrap>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: sidePct, backgroundColor: sidebarBg }} fixed />
        {/* First text on every page: after page 1 it prints "Name · Page 2" (ATS-7), over the main column. */}
        <PdfRunningHeader personal={personal} settings={settings} left={sidePct} />
        {sideColumn}
        {mainColumn}
        {/* Last on every page: its footer is the page's last line drawn, after the résumé's own text (R2-147). */}
        <PdfPageNumbers settings={settings} />
      </Page>
    </Document>
  );
}
