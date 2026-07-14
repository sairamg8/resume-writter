import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { getPageStyle } from './shared/PdfPage';
import { PdfContactRow } from './shared/PdfContact';
import { SectionRouter, getEffectiveSpacing } from './shared/PdfSections';
import { PdfRichText } from './shared/PdfRichText';

function hexAlpha(hex, a) {
  return hex + Math.round(a * 255).toString(16).padStart(2, '0');
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
    borderWidth: br === 'none' ? 0 : 1,
    borderColor: br === 'none' ? 'transparent' : br === 'thin' ? '#e5e7eb' : accent,
    objectFit: 'cover',
  };
}

export function MinimalTemplatePDF({ data }) {
  const { personal, sections = [], settings = {} } = data;
  const {
    accentColor: accent,
    textColor,
    fontSizeBase: baseSize,
    nameColor,
    jobTitleColor,
    lineHeightValue: lineH,
    sectionGap,
  } = settings;
  const nameSize      = baseSize + (settings.fontSizeNameDelta  ?? 8);
  const entrySize     = baseSize + (settings.fontSizeEntryDelta ?? 0);
  const hidden        = personal?.hiddenFields  || [];

  const headerAlign  = settings.headerAlign || 'left';
  const headerLayout = settings.headerLayout || 'stack';
  const centered     = headerAlign === 'center';

  const photoTextAlign = settings.photoTextAlign || 'center';
  const alignItemsVal = photoTextAlign === 'bottom' ? 'flex-end' : photoTextAlign === 'center' ? 'center' : 'flex-start';

  // Name + Title block — Minimal uses light weight (300) for name
  const nameBlock = headerLayout === 'inline' ? (
    <View style={{
      flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline',
      gap: settings.headerInlineGap ?? 8,
      justifyContent: centered ? 'center' : 'flex-start',
    }}>
      <Text style={{ fontSize: nameSize, fontWeight: 300, color: nameColor, letterSpacing: -0.3, lineHeight: 1.2 }}>
        {personal?.name || 'Your Name'}
      </Text>
      {personal?.title && (
        <Text style={{ fontSize: entrySize, color: jobTitleColor, fontWeight: 500, lineHeight: 1.2 }}>
          {personal.title}
        </Text>
      )}
    </View>
  ) : (
    <View>
      <Text style={{ fontSize: nameSize, fontWeight: 300, color: nameColor, letterSpacing: -0.3, textAlign: centered ? 'center' : 'left', lineHeight: 1.2 }}>
        {personal?.name || 'Your Name'}
      </Text>
      {personal?.title && (
        <Text style={{ fontSize: entrySize, color: jobTitleColor, marginTop: 1, textAlign: centered ? 'center' : 'left', lineHeight: 1.2 }}>
          {personal.title}
        </Text>
      )}
    </View>
  );

  const pageStyle = getPageStyle(settings);

  return (
    <Document
      title={personal?.name ? `${personal.name} Resume` : 'Resume'}
      author={personal?.name || ''}
      creator="FlowCV"
      producer="FlowCV"
    >
      <Page size="A4" style={pageStyle}>
        {/* Header — light name weight (300) */}
        <View style={{ marginBottom: sectionGap }}>
          <View style={{
            flexDirection: centered ? 'column' : 'row',
            alignItems: centered ? 'center' : alignItemsVal,
            gap: 10,
          }}>
            {personal?.photo && !hidden.includes('photo') && (
              <Image src={personal.photo} style={getPhotoStyle(settings, accent)} />
            )}
            <View style={centered ? { alignItems: 'center' } : {}}>
              {nameBlock}
              <PdfContactRow personal={personal} settings={settings} />
            </View>
          </View>

          {!hidden.includes('summary') && personal?.summary &&
           personal.summary.replace(/<[^>]*>/g, '').trim() && (
            <View style={{
              marginTop: 6,
              borderLeftWidth: 2,
              borderLeftColor: hexAlpha(accent, 0.4),
              paddingLeft: 8,
            }}>
              <PdfRichText
                html={personal.summary}
                style={{ fontSize: baseSize - 0.5, color: '#555555', lineHeight: lineH, fontStyle: 'italic', textAlign: centered ? 'center' : 'left' }}
              />
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
