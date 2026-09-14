import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { PdfSectionTitle } from './shared/PdfSection';
import { getEffectiveSpacing, SPACER } from './shared/PdfSections';
import { PdfRichText } from './shared/PdfRichText';
import { hasRichText } from '@/utils/richText';
import { getDocumentProps } from './shared/PdfPage';
import { getPdfPhotoStyle } from './shared/pdfPhoto';
import { PdfPhoto } from './shared/PdfPhoto';
import { CSS_PX_TO_PT } from './shared/pdfUnits';
import { PdfContactIcon } from './shared/PdfContactIcon';
import { SIDEBAR_TYPES, SideSectionTitle, renderSideSection, SidebarMainSectionRouter } from './shared/PdfSidebarSections';

// Match canvas SideContact: icons + labels share muted slate (#94a3b8), not accent.
const SIDEBAR_MUTED = '#94a3b8';
const SIDEBAR_CONTACT_VALUE = '#cbd5e1';

function SideContactRow({ field, label, display, iconPt, settings }) {
  return (
    <View style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3.5, marginBottom: 1 }}>
        <PdfContactIcon field={field} settings={settings} size={iconPt} color={SIDEBAR_MUTED} />
        <Text style={{ fontSize: 8, fontWeight: 'bold', color: SIDEBAR_MUTED, letterSpacing: 0.8, lineHeight: 1.2 }}>
          {label.toUpperCase()}
        </Text>
      </View>
      <Text style={{ fontSize: 9, color: SIDEBAR_CONTACT_VALUE, paddingLeft: iconPt + 3.5, lineHeight: 1.2 }}>{display}</Text>
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

  // Classic proportions scaled for the ~38% sidebar column so photos stay proportional
  // to the canvas without overflowing the dark panel.
  const classicPhoto = getPdfPhotoStyle(settings, accent, 'classic', { lightBorder: true });
  const sidePhoto = {
    ...classicPhoto,
    width: Math.min(classicPhoto.width * 0.55, 90),
    height: Math.min(classicPhoto.height * 0.55, 90),
    marginBottom: 10,
  };

  const contactItems = [
    { key: 'email',    label: 'Email',    val: personal?.email,    display: personal?.email },
    { key: 'phone',    label: 'Phone',    val: personal?.phone,    display: personal?.phone },
    { key: 'location', label: 'Location', val: personal?.location, display: personal?.location },
    { key: 'website',  label: 'Website',  val: personal?.website,  display: personal?.websiteLabel || personal?.website },
    { key: 'linkedin', label: 'LinkedIn', val: personal?.linkedin, display: personal?.linkedinLabel || personal?.linkedin },
    { key: 'github',   label: 'GitHub',   val: personal?.github,   display: personal?.githubLabel  || personal?.github },
  ].filter(({ key, val }) => !hidden.includes(key) && val);

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
          color: '#e2e8f0',
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

          {contactItems.length > 0 && (
            <View style={{ marginBottom: sideSectionGap }}>
              <SideSectionTitle title="Contact" />
              <View style={{ marginTop: 2 }}>
                {contactItems.map(item => (
                  <SideContactRow
                    key={item.key}
                    field={item.key}
                    label={item.label}
                    display={item.display}
                    iconPt={sideIconPt}
                    settings={settings}
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
                {renderSideSection(section, marginBottom, ig, accent)}
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
