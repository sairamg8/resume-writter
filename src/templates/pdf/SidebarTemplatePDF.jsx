import { Document, Page, View, StyleSheet } from '@react-pdf/renderer';
import { Text } from './shared/PdfText';
import { PdfSectionTitle } from './shared/PdfSection';
import { getEffectiveSpacing, SPACER } from './shared/PdfSections';
import { PdfRichText } from './shared/PdfRichText';
import { hasRichText } from '@/utils/richText';
import { getDocumentProps, pageMargins } from './shared/PdfPage';
import { getPdfPhotoStyle } from './shared/pdfPhoto';
import { PdfPhoto } from './shared/PdfPhoto';
import { CSS_PX_TO_PT, tracking } from './shared/pdfUnits';
import { fitFontSize } from './shared/pdfMeasure';
import { PdfContactIcon } from './shared/PdfContactIcon';
import { CONTACT_LABELS, contactItems } from '@/utils/contacts';
import { SIDEBAR_TYPES, SideSectionTitle, renderSideSection, SidebarMainSectionRouter } from './shared/PdfSidebarSections';
import { SIDE_COL, SIDE_PAD_RIGHT, SideValue, sideColumnRoom } from './shared/PdfSidebarColumn';
import { sidebarShades } from './shared/pdfColors';
import { pageSizeOf } from '@/constants/pageSize';
import { ClassicTemplatePDF } from './ClassicTemplatePDF';

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
        style={{ fontSize: 9, color: shades.value, paddingLeft: iconPt + iconGap, lineHeight: 1.2 }}
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
  const entrySize  = baseSize + (settings.fontSizeEntryDelta ?? 0);
  const sectionGap = settings.sectionGap ?? 12;
  const hidden     = personal?.hiddenFields || [];
  const g          = settings.headerGaps; // the header's spacing, pt (TEMPLATES' headerGaps)

  const visibleSections = sections.filter(s => s.visible !== false);
  const sidebarSections = visibleSections.filter(s => SIDEBAR_TYPES.has(s.type));
  const mainSections    = visibleSections.filter(s => !SIDEBAR_TYPES.has(s.type));

  // Canvas: SideContact uses `st.iconSize ?? 8` as CSS px; PDF points ≈ px * 0.75
  const sideIconPt     = Math.max(6, Math.round((settings?.iconSize ?? 8) * CSS_PX_TO_PT));
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
  const nameFit = fitFontSize(personal?.name, { fontFamily: settings._pdfFontFamily, fontSize: nameSize, fontWeight: 'bold' }, room);
  const titleFit = fitFontSize(personal?.title, { fontFamily: settings._pdfFontFamily, fontSize: entrySize }, room);

  // Top and bottom margins belong to the page, so react-pdf repeats them on every page; a
  // column's own padding applies only where the column starts and ends (pages 2+ used to print
  // from the paper edge). The fixed sidebar background still bleeds to the edges.
  const pageStyle = StyleSheet.create({
    page: {
      fontFamily: settings._pdfFontFamily || 'NotoSans',
      paddingTop: `${vMm}mm`,
      paddingBottom: `${Math.max(0, vMm - 0.5)}mm`,
      paddingLeft: 0,
      paddingRight: 0,
      flexDirection: 'row',
      fontSize: baseSize,
      lineHeight: lineH,
      backgroundColor: 'white',
    },
  }).page;

  return (
    <Document {...getDocumentProps(personal)}>
      <Page size={pageSizeOf(settings)} style={pageStyle} wrap>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${SIDE_COL * 100}%`, backgroundColor: sidebarBg }} fixed />

        <View style={{
          width: `${SIDE_COL * 100}%`,
          backgroundColor: 'transparent',
          paddingLeft: `${hMm}mm`,
          paddingRight: SIDE_PAD_RIGHT,
          color: side.strong,
        }}>
          <View style={{ marginBottom: sideSectionGap, alignItems: 'center' }} wrap={false}>
            {personal?.photo && !hidden.includes('photo') && (
              <PdfPhoto src={personal.photo} style={sidePhoto} />
            )}
            <Text style={{
              fontSize: nameFit, fontWeight: 'bold', color: nameColor,
              textAlign: 'center', marginBottom: personal?.title ? g.nameTitleGap : 2, lineHeight: 1.2,
            }}>
              {personal?.name}
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

          {contacts.length > 0 && (
            <View style={{ marginBottom: sideSectionGap }}>
              <SideSectionTitle title="Contact" shades={side} titleCase={settings.sectionTitleCase} settings={settings} />
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
          )}

          {sidebarSections.map((section, index) => {
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
          })}
        </View>

        <View style={{
          flex: 1,
          paddingLeft: 14,
          paddingRight: `${hMm}mm`,
          color: textColor,
        }}>
          {!hidden.includes('summary') && personal?.summary &&
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
                presence={Math.round(baseSize * lineH * 3)}
              />
              <PdfRichText
                html={personal.summary}
                style={{ fontSize: baseSize, color: textColor, lineHeight: lineH }}
              />
            </View>
          )}

          {mainSections.map((section, index) => {
            const { marginBottom, spaceBefore, itemGap: ig } = getEffectiveSpacing(section, settings, {
              isLast: index === mainSections.length - 1,
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
          })}
        </View>
      </Page>
    </Document>
  );
}
