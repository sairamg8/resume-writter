import { Document, Page, View, Text } from '@react-pdf/renderer';
import { getPageStyle, getDocumentProps } from './shared/PdfPage';
import { PdfRichText } from './shared/PdfRichText';
import { PdfContactRow } from './shared/PdfContact';
import { solid } from './shared/pdfColors';
import { PdfPhoto } from './shared/PdfPhoto';
import { letterBlock, letterContactFormat, letterHiddenFields, letterSignature } from '@/utils/coverLetter';
import { photoTextAlignItems } from '@/constants/templates';

/** Space under the date, the recipient block and the subject. */
const BLOCK_GAP = 12;

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
    borderColor: br === 'none' ? '#ffffff' : br === 'thin' ? '#e5e7eb' : solid(accent),
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

  const contacts  = letterContactFormat(cl, settings);
  const fieldsPos = cl.fieldsPosition || 'right';

  const photoSrc = cl.showPhoto !== false ? (cl.clPhoto || personal?.photo) : null;
  // The panel's "Text Position (relative to photo)": the name block's place beside the photo.
  const photoAlign = photoTextAlignItems(cl); // the letter's own Text Position
  const hidden   = letterHiddenFields(cl, personal);

  const sig    = letterSignature(cl, personal);
  const sigGap = sig.wide ? 24 : 8;

  const block     = letterBlock(cl);
  const blockLine = { fontSize: baseSize, color: textColor, lineHeight: 1.3 };

  const pageStyle = getPageStyle({
    ...settings,
    _pdfFontFamily: settings._pdfFontFamily || 'NotoSans',
  });

  const contactEl = (
    <PdfContactRow
      personal={personal}
      hidden={hidden}
      settings={{ ...settings, contactStyle: contacts.style, contactLayout: contacts.layout }}
      color="#64748b"
    />
  );

  const photoEl = photoSrc ? (
    <PdfPhoto src={photoSrc} style={getPhotoStyle(settings, accent)} />
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
        <View style={{ flexDirection: 'row', alignItems: photoAlign }}>
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
          <View style={{ flexDirection: 'row', alignItems: photoAlign }}>
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
        <View style={{ flexDirection: 'row', alignItems: photoAlign, flexShrink: 0 }}>
          {photoEl}
          {nameBlock}
        </View>
        {contactEl ? <View style={{ flex: 1, alignItems: 'flex-end', marginLeft: 12 }}>{contactEl}</View> : null}
      </View>
    );
  }

  return (
    <Document
      {...getDocumentProps(personal)}
      title={personal?.name ? `${personal.name} Cover Letter` : 'Cover Letter'}
      subject="Cover Letter"
    >
      <Page size="A4" style={{ ...pageStyle, color: textColor }}>
        {/* Header block with accent bottom border */}
        <View style={{ borderBottomWidth: 2.5, borderBottomColor: solid(accent), paddingBottom: 12, marginBottom: 16 }}>
          {renderHeader()}
        </View>

        {/* Date, recipient block, subject — each line only when filled */}
        {block.date ? <Text style={{ ...blockLine, marginBottom: BLOCK_GAP }}>{block.date}</Text> : null}
        {block.recipientName || block.recipientTitle || block.company ? (
          <View style={{ marginBottom: BLOCK_GAP }}>
            {block.recipientName ? (
              <Text style={{ ...blockLine, fontWeight: 'bold', color: '#0f172a' }}>{block.recipientName}</Text>
            ) : null}
            {block.recipientTitle ? <Text style={blockLine}>{block.recipientTitle}</Text> : null}
            {block.company ? <Text style={blockLine}>{block.company}</Text> : null}
          </View>
        ) : null}
        {block.subject ? (
          <Text style={{ ...blockLine, fontWeight: 'bold', marginBottom: BLOCK_GAP }}>{block.subject}</Text>
        ) : null}

        {/* Body */}
        {cl.body ? (
          <View style={{ marginBottom: 16 }}>
            <PdfRichText html={cl.body} style={{ fontSize: baseSize, color: textColor, lineHeight: lineH }} />
          </View>
        ) : data._preview ? (
          // Writing hint for the live preview only — an exported letter never contains it.
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: baseSize, color: '#9ca3af', lineHeight: lineH }}>
              {'Dear Hiring Manager,\n\nStart writing your cover letter in the "Cover Letter" tab on the left...\n\nBest regards,\n' + (personal?.name || 'Your Name')}
            </Text>
          </View>
        ) : null}

        {/* Closing / Signature */}
        <View>
          <Text style={{ fontSize: baseSize, color: textColor, lineHeight: lineH }}>
            {sig.closing}
          </Text>
          <View style={{ marginTop: sigGap }}>
            {sig.name ? (
              <Text style={{ fontSize: baseSize, fontWeight: 'bold', color: '#0f172a', lineHeight: 1.3 }}>{sig.name}</Text>
            ) : null}
            {sig.designation ? (
              <Text style={{ fontSize: baseSize, color: '#64748b', lineHeight: 1.3 }}>{sig.designation}</Text>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}
