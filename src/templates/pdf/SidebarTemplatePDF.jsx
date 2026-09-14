import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { PdfSectionTitle } from './shared/PdfSection';
import { getEffectiveSpacing, SPACER } from './shared/PdfSections';
import { PdfRichText } from './shared/PdfRichText';
import { hasRichText } from '@/utils/richText';
import { getDocumentProps } from './shared/PdfPage';
import { getPdfPhotoStyle } from './shared/pdfPhoto';
import { PdfPhoto } from './shared/PdfPhoto';
import { CSS_PX_TO_PT, tracking } from './shared/pdfUnits';
import { PdfContactIcon } from './shared/PdfContactIcon';
import { ContactValue } from './shared/PdfContact';
import { contactItems } from '@/utils/contacts';
import { SIDEBAR_TYPES, SideSectionTitle, renderSideSection, SidebarMainSectionRouter } from './shared/PdfSidebarSections';
import { sidebarShades } from './shared/pdfColors';

const CONTACT_LABELS = { email: 'Email', phone: 'Phone', location: 'Location', website: 'Website', linkedin: 'LinkedIn', github: 'GitHub' };

/** A contact in the dark column: icon and label in the column's label colour, not the accent. */
function SideContactRow({ field, label, value, href, iconPt, settings, shades }) {
  return (
    <View style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3.5, marginBottom: 1 }}>
        <PdfContactIcon field={field} settings={settings} size={iconPt} color={shades.label} />
        <Text style={{ fontSize: 8, fontWeight: 'bold', color: shades.label, letterSpacing: tracking(8, 0.8), lineHeight: 1.2 }}>
          {label.toUpperCase()}
        </Text>
      </View>
      <ContactValue value={value} href={href} style={{ fontSize: 9, color: shades.value, paddingLeft: iconPt + 3.5, lineHeight: 1.2 }} />
    </View>
  );
}

export function SidebarTemplatePDF({ data }) {
  const { personal, sections = [], settings = {} } = data;
  const {
    accentColor: accent,
    textColor,
    fontSizeBase: baseSize,
    nameColor,
    jobTitleColor,
    lineHeightValue: lineH,
  } = settings;
  const vMm        = settings.marginV ?? 14;
  const hMm        = settings.marginH ?? 18;
  const sidebarBg  = settings.sidebarBg || '#1e293b';
  const side       = sidebarShades(sidebarBg); // the column's colours on its background (R2-2)
  const nameSize   = baseSize + (settings.fontSizeNameDelta ?? 8);
  const entrySize  = baseSize + (settings.fontSizeEntryDelta ?? 0);
  const sectionGap = settings.sectionGap ?? 12;
  const hidden     = personal?.hiddenFields || [];

  const visibleSections = sections.filter(s => s.visible !== false);
  const sidebarSections = visibleSections.filter(s => SIDEBAR_TYPES.has(s.type));
  const mainSections    = visibleSections.filter(s => !SIDEBAR_TYPES.has(s.type));

  // Canvas: SideContact uses `st.iconSize ?? 8` as CSS px; PDF points ≈ px * 0.75
  const sideIconPt     = Math.max(6, Math.round((settings?.iconSize ?? 8) * CSS_PX_TO_PT));
  const sideSectionGap = sectionGap;

  // Classic's photo scaled for the ~38% column by ONE factor, so every Photo → Height option
  // keeps its shape (Square 1:1, Tall 1:1.4, Portrait 1:1.8). Capping width and height
  // separately at 90 pt made Tall and Portrait print the same box (R3-1). The width cap keeps a
  // photo inside the column; a circle's radius follows the scaled width.
  const classicPhoto = getPdfPhotoStyle(settings, accent, 'classic', { lightBorder: true });
  const photoScale = Math.min(0.55, 90 / classicPhoto.width);
  const sidePhoto = {
    ...classicPhoto,
    width: classicPhoto.width * photoScale,
    height: classicPhoto.height * photoScale,
    borderRadius: Math.min(classicPhoto.borderRadius, (classicPhoto.width * photoScale) / 2),
    marginBottom: 10,
  };

  const contacts = contactItems(personal);

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
      <Page size="A4" style={pageStyle} wrap>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '38%', backgroundColor: sidebarBg }} fixed />

        <View style={{
          width: '38%',
          backgroundColor: 'transparent',
          paddingLeft: `${hMm}mm`,
          paddingRight: 10,
          color: side.strong,
        }}>
          <View style={{ marginBottom: sideSectionGap, alignItems: 'center' }} wrap={false}>
            {personal?.photo && !hidden.includes('photo') && (
              <PdfPhoto src={personal.photo} style={sidePhoto} />
            )}
            <Text style={{
              fontSize: nameSize, fontWeight: 'bold', color: nameColor,
              textAlign: 'center', marginBottom: 2, lineHeight: 1.2,
            }}>
              {personal?.name}
            </Text>
            {personal?.title && (
              <Text style={{
                fontSize: entrySize, color: jobTitleColor,
                textAlign: 'center', marginBottom: 6, lineHeight: 1.2,
              }}>
                {personal.title}
              </Text>
            )}
          </View>

          {contacts.length > 0 && (
            <View style={{ marginBottom: sideSectionGap }}>
              <SideSectionTitle title="Contact" shades={side} />
              <View style={{ marginTop: 2 }}>
                {contacts.map(item => (
                  <SideContactRow
                    key={item.key}
                    field={item.key}
                    label={CONTACT_LABELS[item.key]}
                    value={item.value}
                    href={item.href}
                    iconPt={sideIconPt}
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
                {renderSideSection(section, marginBottom, ig, accent, side)}
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
