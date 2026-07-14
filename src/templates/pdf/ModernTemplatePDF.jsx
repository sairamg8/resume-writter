import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { getPageStyle, getDocumentProps } from './shared/PdfPage';
import { SectionRouter, getEffectiveSpacing } from './shared/PdfSections';
import { PdfRichText } from './shared/PdfRichText';
import { MailIcon, PhoneIcon, MapPinIcon, GlobeIcon, LinkedinPdfIcon, GithubPdfIcon } from './shared/PdfIcons';
import { getPdfPhotoStyle } from './shared/pdfPhoto';
import { MODERN_HEADER_PAD_X_PT, MODERN_HEADER_PAD_Y_PT, pxToPt } from './shared/pdfUnits';

const CSS_ICON_SCALE = 0.9;

function HeaderContact({ personal, settings, textColor }) {
  const hidden   = personal?.hiddenFields || [];
  const baseSize = settings?.fontSizeBase || 11;
  const iconPt   = Math.max(7, Math.round((settings?.iconSize ?? 9) * CSS_ICON_SCALE));
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
  // Canvas: gap-x-4 gap-y-0.5 → 16px / 2px
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: pxToPt(16), rowGap: pxToPt(2), marginTop: 4 }}>
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
  const nameSize  = baseSize + (settings.fontSizeNameDelta  ?? 8);
  const entrySize = baseSize + (settings.fontSizeEntryDelta ?? 0);
  const hidden    = personal?.hiddenFields || [];
  const headerText = settings.headerTextColor || '#ffffff';
  // Canvas summary uses opacity 0.85 on header text
  const summaryColor = headerText === '#ffffff' || headerText === '#fff'
    ? 'rgba(255,255,255,0.85)'
    : headerText;

  const pageStyle = getPageStyle(settings);

  return (
    <Document {...getDocumentProps(personal)}>
      <Page size="A4" style={pageStyle} wrap>
        <View style={{
          backgroundColor: accent,
          borderRadius: 2,
          paddingTop: MODERN_HEADER_PAD_Y_PT,
          paddingBottom: MODERN_HEADER_PAD_Y_PT,
          paddingHorizontal: MODERN_HEADER_PAD_X_PT,
          marginBottom: sectionGap,
        }} wrap={false}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: pxToPt(16) }}>
            {personal?.photo && !hidden.includes('photo') && (
              <Image src={personal.photo} style={getPdfPhotoStyle(settings, '#ffffff', 'modern')} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: nameSize, fontWeight: 'bold', color: nameColor, marginBottom: 1, lineHeight: 1.2 }}>
                {personal?.name || 'Your Name'}
              </Text>
              {personal?.title && (
                <Text style={{ fontSize: entrySize, color: jobTitleColor, marginBottom: 2, lineHeight: 1.2, opacity: 0.9 }}>
                  {personal.title}
                </Text>
              )}
              <HeaderContact personal={personal} settings={settings} textColor={headerText} />
            </View>
          </View>
          {!hidden.includes('summary') && personal?.summary &&
           personal.summary.replace(/<[^>]*>/g, '').trim() && (
            <View style={{ marginTop: 8 }}>
              <PdfRichText
                html={personal.summary}
                style={{ fontSize: baseSize, color: summaryColor, lineHeight: lineH }}
              />
            </View>
          )}
        </View>

        {sections.map((section) => {
          if (section.visible === false) return null;
          const { marginBottom, spaceBefore, itemGap } = getEffectiveSpacing(section, settings);
          return (
            <View key={section.id} style={spaceBefore != null ? { marginTop: spaceBefore } : undefined} wrap>
              <SectionRouter section={section} settings={settings} marginBottom={marginBottom} itemGap={itemGap} />
            </View>
          );
        })}
      </Page>
    </Document>
  );
}
