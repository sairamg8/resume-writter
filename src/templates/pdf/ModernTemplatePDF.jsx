import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { getPageStyle } from './shared/PdfPage';
import { SectionRouter, getEffectiveSpacing } from './shared/PdfSections';
import { PdfRichText } from './shared/PdfRichText';
import { MailIcon, PhoneIcon, MapPinIcon, GlobeIcon, LinkedinPdfIcon, GithubPdfIcon } from './shared/PdfIcons';

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
    borderWidth: br === 'none' ? 0 : 1,
    borderColor: br === 'none' ? 'transparent' : br === 'thin' ? '#e2e8f0' : accent,
    objectFit: 'cover',
  };
}

// Modern: colored accent header band with inline contact icons, then regular sections below
function HeaderContact({ personal, settings, textColor }) {
  const hidden   = personal?.hiddenFields || [];
  const baseSize = settings?.fontSizeBase || 11;
  const iconPt   = Math.max(7, Math.round((settings?.iconSize ?? 9) * 0.9));
  const textSize = baseSize - 1.5;
  const items = [
    { key: 'email',    Icon: MailIcon,        val: personal?.email,    display: personal?.email },
    { key: 'phone',    Icon: PhoneIcon,       val: personal?.phone,    display: personal?.phone },
    { key: 'location', Icon: MapPinIcon,      val: personal?.location, display: personal?.location },
    { key: 'website',  Icon: GlobeIcon,       val: personal?.website,  display: personal?.websiteLabel || personal?.website },
    { key: 'linkedin', Icon: LinkedinPdfIcon, val: personal?.linkedin, display: personal?.linkedinLabel || personal?.linkedin },
    { key: 'github',   Icon: GithubPdfIcon,   val: personal?.github,   display: personal?.githubLabel  || personal?.github },
  ].filter(({ key, val }) => !hidden.includes(key) && val);

  if (!items.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2, marginTop: 4 }}>
      {items.map(({ key, Icon, display }) => (
        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Icon size={iconPt} color={textColor} />
          <Text style={{ fontSize: textSize, color: textColor, lineHeight: 1.2 }}>{display}</Text>
        </View>
      ))}
    </View>
  );
}

export function ModernTemplatePDF({ data }) {
  const { personal, sections = [], settings = {} } = data;
  const {
    accentColor: accent,
    fontSizeBase: baseSize,
    nameColor,
    jobTitleColor,
    lineHeightValue: lineH,
    sectionGap,
  } = settings;
  const nameSize      = baseSize + (settings.fontSizeNameDelta  ?? 8);
  const entrySize     = baseSize + (settings.fontSizeEntryDelta ?? 0);
  const hidden        = personal?.hiddenFields  || [];

  const pageStyle = getPageStyle(settings);

  return (
    <Document
      title={personal?.name ? `${personal.name} Resume` : 'Resume'}
      author={personal?.name || ''}
      creator="FlowCV"
      producer="FlowCV"
    >
      <Page size="A4" style={pageStyle}>
        {/* Colored header band (rendered as a card inside page margins, matching HTML px-6 py-5 rounded-sm) */}
        <View style={{
          backgroundColor: accent,
          borderRadius: 3,
          paddingTop: 14,
          paddingBottom: 14,
          paddingHorizontal: 16,
          marginBottom: sectionGap,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            {personal?.photo && !hidden.includes('photo') && (
              <Image src={personal.photo} style={getPhotoStyle(settings, '#ffffff')} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: nameSize, fontWeight: 'bold', color: nameColor, marginBottom: 1, lineHeight: 1.2 }}>
                {personal?.name}
              </Text>
              {personal?.title && (
                <Text style={{ fontSize: entrySize, color: jobTitleColor, marginBottom: 2, lineHeight: 1.2 }}>
                  {personal.title}
                </Text>
              )}
              <HeaderContact personal={personal} settings={settings} textColor={settings.headerTextColor || '#ffffff'} />
            </View>
          </View>
          {!hidden.includes('summary') && personal?.summary &&
           personal.summary.replace(/<[^>]*>/g, '').trim() && (
            <View style={{ marginTop: 8 }}>
              <PdfRichText html={personal.summary} style={{ fontSize: baseSize - 0.5, color: settings.headerTextColor || '#ffffff', lineHeight: lineH }} />
            </View>
          )}
        </View>

        {/* Body sections */}
        {sections.map((section) => {
          if (section.visible === false) return null;
          const { marginBottom, spaceBefore, itemGap } = getEffectiveSpacing(section, settings);
          return (
            <View key={section.id} style={spaceBefore != null ? { marginTop: spaceBefore } : {}}>
              <SectionRouter section={section} settings={settings} marginBottom={marginBottom} itemGap={itemGap} />
            </View>
          );
        })}
      </Page>
    </Document>
  );
}
