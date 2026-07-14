import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { PdfSectionTitle } from './shared/PdfSection';
import { getEffectiveSpacing } from './shared/PdfSections';
import { PdfRichText } from './shared/PdfRichText';
import { MailIcon, PhoneIcon, MapPinIcon, GlobeIcon, LinkedinPdfIcon, GithubPdfIcon } from './shared/PdfIcons';

import { SIDEBAR_TYPES, SideSectionTitle, renderSideSection, SidebarMainSectionRouter } from './shared/PdfSidebarSections';

// Custom stacked contact details row aligned perfectly with canvas
function SideContactRow({ Icon, label, display, accent, iconPt }) {
  return (
    <View style={{ marginBottom: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3.5, marginBottom: 1 }}>
        <Icon size={iconPt} color={accent || '#94a3b8'} />
        <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#94a3b8', letterSpacing: 0.8, lineHeight: 1.2 }}>{label.toUpperCase()}</Text>
      </View>
      <Text style={{ fontSize: 9, color: '#cbd5e1', paddingLeft: iconPt + 3.5, lineHeight: 1.2 }}>{display}</Text>
    </View>
  );
}

// Helper to compute photo styles in PDF points
function getPhotoStyle(settings, accent) {
  const sh = settings?.photoShape || 'circle';
  const sz = settings?.photoSize || 'md';
  const br = settings?.photoBorder || 'accent';
  const ph = settings?.photoHeight || 'match';

  const w = sz === 'sm' ? 40 : sz === 'lg' ? 65 : 50;
  const h = sh === 'circle' ? w : ph === 'tall' ? Math.round(w * 1.4) : ph === 'taller' ? Math.round(w * 1.8) : w;

  return {
    width: w,
    height: h,
    borderRadius: sh === 'rounded' ? 6 : sh === 'square' ? 1 : w / 2,
    borderWidth: br === 'none' ? 0 : 1.5,
    borderColor: br === 'none' ? 'transparent' : br === 'thin' ? 'rgba(255,255,255,0.25)' : accent,
    objectFit: 'cover',
    marginBottom: 10,
  };
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
  const vMm           = settings.marginV        ?? 14;
  const hMm           = settings.marginH        ?? 18;
  const sidebarBg     = settings.sidebarBg      || '#1e293b';
  const nameSize      = baseSize + (settings.fontSizeNameDelta  ?? 8);
  const entrySize     = baseSize + (settings.fontSizeEntryDelta ?? 0);
  const sectionGap    = settings.sectionGap ?? 12;
  const itemGap       = settings.itemGap    ?? 9;
  const hidden        = personal?.hiddenFields  || [];

  const visibleSections = sections.filter(s => s.visible !== false);
  const sidebarSections = visibleSections.filter(s =>  SIDEBAR_TYPES.has(s.type));
  const mainSections    = visibleSections.filter(s => !SIDEBAR_TYPES.has(s.type));

  const sideIconPt = Math.max(7, Math.round((settings?.iconSize ?? 11) * 0.72));
  const sideSectionGap = Math.round(sectionGap);
  const sideItemGap    = Math.round(itemGap);

  const contactItems = [
    { key: 'email',    Icon: MailIcon,        label: 'Email',    val: personal?.email,    display: personal?.email },
    { key: 'phone',    Icon: PhoneIcon,       label: 'Phone',    val: personal?.phone,    display: personal?.phone },
    { key: 'location', Icon: MapPinIcon,      label: 'Location', val: personal?.location, display: personal?.location },
    { key: 'website',  Icon: GlobeIcon,       label: 'Website',  val: personal?.website,  display: personal?.websiteLabel || personal?.website },
    { key: 'linkedin', Icon: LinkedinPdfIcon, label: 'LinkedIn', val: personal?.linkedin, display: personal?.linkedinLabel || personal?.linkedin },
    { key: 'github',   Icon: GithubPdfIcon,   label: 'GitHub',   val: personal?.github,   display: personal?.githubLabel  || personal?.github },
  ].filter(({ key, val }) => !hidden.includes(key) && val);

  const pageStyle = StyleSheet.create({
    page: {
      fontFamily: settings._pdfFontFamily || 'NotoSans',
      padding:    0,
      flexDirection: 'row',
      fontSize:   baseSize,
      lineHeight: lineH,
      backgroundColor: 'white',
    }
  }).page;

  return (
    <Document
      title={personal?.name ? `${personal.name} Resume` : 'Resume'}
      author={personal?.name || ''}
      creator="FlowCV"
      producer="FlowCV"
    >
      <Page size="A4" style={pageStyle}>
        {/* Sidebar background painted full-page-height via absolute view */}
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '38%', backgroundColor: sidebarBg }} />

        {/* ── Sidebar column (dark) ── */}
        <View style={{
          width:         '38%',
          backgroundColor: 'transparent',
          paddingTop:    `${vMm}mm`,
          paddingBottom: `${vMm}mm`,
          paddingLeft:   `${hMm}mm`,
          paddingRight:  10,
          color:         '#e2e8f0',
        }}>
          {/* Name + title */}
          <View style={{ marginBottom: sideSectionGap, alignItems: 'center' }}>
            {personal?.photo && !hidden.includes('photo') && (
              <Image src={personal.photo} style={getPhotoStyle(settings, accent)} />
            )}
            <Text style={{ fontSize: nameSize, fontWeight: 'bold', color: nameColor, textAlign: 'center', marginBottom: 2, lineHeight: 1.2 }}>
              {personal?.name}
            </Text>
            {personal?.title && (
              <Text style={{ fontSize: entrySize, color: jobTitleColor, textAlign: 'center', marginBottom: 6, lineHeight: 1.2 }}>
                {personal.title}
              </Text>
            )}
          </View>

          {/* Contact section */}
          {contactItems.length > 0 && (
            <View style={{ marginBottom: sideSectionGap }}>
              <SideSectionTitle title="Contact" />
              <View style={{ marginTop: 2 }}>
                {contactItems.map(item => (
                  <SideContactRow
                    key={item.key}
                    Icon={item.Icon}
                    label={item.label}
                    display={item.display}
                    accent={accent}
                    iconPt={sideIconPt}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Sidebar sections */}
          {sidebarSections.map(section => {
            const ss = section.settings || {};
            const effGap     = ss.spaceAfter != null ? Math.round(ss.spaceAfter * 0.75) : sideSectionGap;
            const effItemGap = ss.itemGap    != null ? Math.round(ss.itemGap    * 0.75) : sideItemGap;
            return (
              <View key={section.id} style={ss.spaceBefore != null ? { marginTop: ss.spaceBefore } : {}}>
                {renderSideSection(section, effGap, effItemGap, accent)}
              </View>
            );
          })}
        </View>

        {/* ── Main column ── */}
        <View style={{
          flex:          1,
          paddingTop:    `${vMm}mm`,
          paddingBottom: `${vMm}mm`,
          paddingLeft:   14,
          paddingRight:  `${hMm}mm`,
          color:         textColor,
        }}>
          {/* Summary */}
          {!hidden.includes('summary') && personal?.summary &&
           personal.summary.replace(/<[^>]*>/g, '').trim() && (
            <View style={{ marginBottom: sectionGap }}>
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
              />
              <PdfRichText html={personal.summary} style={{ fontSize: baseSize - 0.5, color: textColor, lineHeight: lineH }} />
            </View>
          )}

          {/* Main sections */}
          {mainSections.map((section) => {
            const { marginBottom, spaceBefore, itemGap: ig } = getEffectiveSpacing(section, settings);
            return (
              <View key={section.id} style={spaceBefore != null ? { marginTop: spaceBefore } : {}}>
                <SidebarMainSectionRouter section={section} settings={settings} marginBottom={marginBottom} itemGap={ig} />
              </View>
            );
          })}
        </View>
      </Page>
    </Document>
  );
}
