import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { getPageStyle } from './shared/PdfPage';
import { PdfRichText } from './shared/PdfRichText';
import { PdfContactRow } from './shared/PdfContact';

function getPhotoStyle(settings, accent) {
  const sh = settings?.photoShape || 'circle';
  const sz = settings?.photoSize  || 'md';
  const br = settings?.photoBorder || 'accent';
  const ph = settings?.photoHeight || 'match';
  const w = sz === 'sm' ? 30 : sz === 'lg' ? 48 : 38;
  const h = sh === 'circle' ? w : ph === 'tall' ? Math.round(w * 1.4) : ph === 'taller' ? Math.round(w * 1.8) : w;
  return {
    width: w, height: h,
    borderRadius: sh === 'rounded' ? 5 : sh === 'square' ? 1 : w / 2,
    borderWidth: br === 'none' ? 0 : 1.5,
    borderColor: br === 'none' ? 'transparent' : br === 'thin' ? '#e5e7eb' : accent,
    objectFit: 'cover',
    marginRight: 10,
  };
}

export function CoverLetterTemplatePDF({ data }) {
  const { personal = {}, settings = {}, coverLetter = {} } = data;
  const cl = coverLetter || {};

  const accent    = settings.accentColor    || '#2563eb';
  const textColor = settings.textColor      || '#1e293b';
  const baseSize  = settings.fontSizeBase   || 11;
  const nameSize  = baseSize + (settings.fontSizeNameDelta ?? 8);
  const lineH     = settings.lineHeightValue || 1.5;

  const clContactStyle  = cl.headerStyle    || settings.contactStyle  || 'bar';
  const clContactLayout = cl.headerLayout   || settings.contactLayout || 'justify';
  const fieldsPos       = cl.fieldsPosition || 'right';
  const clHiddenSet     = new Set(cl.hiddenFields ?? []);

  const photoSrc = cl.showPhoto !== false ? (cl.clPhoto || personal?.photo) : null;
  const hidden   = (personal?.hiddenFields || []).concat([...clHiddenSet]);

  const sigName        = cl.signatureName        != null ? cl.signatureName        : (personal?.name  || '');
  const sigDesignation = cl.signatureDesignation != null ? cl.signatureDesignation : (personal?.title || '');
  const sigGap         = cl.signatureSpace === 'wide' ? 24 : 8;

  const pageStyle = getPageStyle({
    ...settings,
    _pdfFontFamily: settings._pdfFontFamily || 'NotoSans',
  });

  const contactEl = (
    <PdfContactRow
      personal={{ ...personal, hiddenFields: hidden }}
      settings={{ ...settings, contactStyle: clContactStyle, contactLayout: clContactLayout }}
      color="#64748b"
    />
  );

  const photoEl = photoSrc ? (
    <Image src={photoSrc} style={getPhotoStyle(settings, accent)} />
  ) : null;

  const nameBlock = (
    <View style={{ minWidth: 0 }}>
      <Text style={{ fontSize: nameSize, fontWeight: 'bold', color: '#0f172a', lineHeight: 1.2 }}>
        {personal?.name || 'Your Name'}
      </Text>
      {personal?.title ? (
        <Text style={{ fontSize: baseSize, color: accent, marginTop: 1 }}>{personal.title}</Text>
      ) : null}
    </View>
  );

  function renderHeader() {
    if (fieldsPos === 'below-name') {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {photoEl}
          <View style={{ flex: 1, minWidth: 0 }}>
            {nameBlock}
            {contactEl ? <View style={{ marginTop: 4 }}>{contactEl}</View> : null}
          </View>
        </View>
      );
    }
    if (fieldsPos === 'below-all') {
      return (
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {photoEl}
            {nameBlock}
          </View>
          {contactEl ? <View style={{ marginTop: 5 }}>{contactEl}</View> : null}
        </View>
      );
    }
    // 'right' — default: name+photo on left, contact on right
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
          {photoEl}
          {nameBlock}
        </View>
        {contactEl ? <View style={{ flex: 1, alignItems: 'flex-end', marginLeft: 12 }}>{contactEl}</View> : null}
      </View>
    );
  }

  return (
    <Document
      title={personal?.name ? `${personal.name} Cover Letter` : 'Cover Letter'}
      author={personal?.name || ''}
      creator="FlowCV"
      producer="FlowCV"
    >
      <Page size="A4" style={{ ...pageStyle, color: textColor }}>
        {/* Header block with accent bottom border */}
        <View style={{ borderBottomWidth: 2.5, borderBottomColor: accent, paddingBottom: 12, marginBottom: 16 }}>
          {renderHeader()}
        </View>

        {/* Body */}
        {cl.body ? (
          <View style={{ marginBottom: 16 }}>
            <PdfRichText html={cl.body} style={{ fontSize: baseSize, color: textColor, lineHeight: lineH }} />
          </View>
        ) : (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: baseSize, color: '#9ca3af', lineHeight: lineH }}>
              {'Dear Hiring Manager,\n\nStart writing your cover letter in the "Cover Letter" tab on the left...\n\nBest regards,\n' + (personal?.name || 'Your Name')}
            </Text>
          </View>
        )}

        {/* Closing / Signature */}
        <View>
          <Text style={{ fontSize: baseSize, color: textColor, lineHeight: lineH }}>
            {cl.closing || 'Sincerely'},
          </Text>
          <View style={{ marginTop: sigGap }}>
            {sigName ? (
              <Text style={{ fontSize: baseSize, fontWeight: 'bold', color: '#0f172a', lineHeight: 1.3 }}>{sigName}</Text>
            ) : null}
            {sigDesignation ? (
              <Text style={{ fontSize: baseSize, color: '#64748b', lineHeight: 1.3 }}>{sigDesignation}</Text>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}
