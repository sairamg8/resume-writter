import { Document, Page, View, Text } from '@react-pdf/renderer';
import { getPageStyle, getDocumentProps } from './shared/PdfPage';
import { PdfRichText } from './shared/PdfRichText';
import { PdfContactRow } from './shared/PdfContact';
import { solid, textShades } from './shared/pdfColors';
import { PdfPhoto } from './shared/PdfPhoto';
import { getPdfPhotoStyle } from './shared/pdfPhoto';
import { letterBlock, letterContactFormat, letterHiddenFields, letterSignature } from '@/utils/coverLetter';
import { photoTextAlignItems } from '@/constants/templates';
import { hasRichText } from '@/utils/richText';
import { contactItems } from '@/utils/contacts';
import { A4_WIDTH_PT, MM_TO_PT } from './shared/pdfUnits';

/** Space under the date, the recipient block and the subject. */
const BLOCK_GAP = 12;

export function CoverLetterTemplatePDF({ data }) {
  const { personal = {}, settings = {}, coverLetter = {} } = data;
  const cl = coverLetter || {};

  const accent    = settings.accentColor    || '#2563eb';
  const textColor = settings.textColor      || '#1e293b';
  // Names in the Text colour, contacts and the designation in its grey: a custom Text colour
  // reaches every line of the letter (R1-13), as it does the résumé's sections (f37a9f5).
  const meta      = textShades(textColor).meta;
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
      color={meta}
    />
  );

  const photoStyle = { ...getPdfPhotoStyle(settings, accent, 'cover'), marginRight: 10 };
  const photoEl = photoSrc ? <PdfPhoto src={photoSrc} style={photoStyle} /> : null;

  // Beside the contacts ('right', the default) the name and photo take at most 60 % of the
  // header, so a long title wraps there instead of pushing the contacts past the margin (and,
  // at a column of no width, making react-pdf throw on an icon). In points, on the name block:
  // react-pdf lays text out once, at the first width it is measured with, so a cap on the row
  // or a box that shrinks later does not re-wrap it.
  const headerWidth = A4_WIDTH_PT - 2 * (settings.marginH ?? 18) * MM_TO_PT;
  const nameCap = fieldsPos === 'right' && contactItems(personal, hidden).length
    ? 0.6 * headerWidth - (photoEl ? photoStyle.width + photoStyle.marginRight : 0)
    : undefined;

  const nameBlock = (
    <View style={{ minWidth: 0, maxWidth: nameCap }}>
      <Text style={{ fontSize: nameSize, fontWeight: 'bold', color: textColor, lineHeight: 1.2 }}>
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
    // 'right' — default: name+photo on left (at most 60 %: nameCap), contact on right
    return (
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: photoAlign }}>
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
              <Text style={{ ...blockLine, fontWeight: 'bold' }}>{block.recipientName}</Text>
            ) : null}
            {block.recipientTitle ? <Text style={blockLine}>{block.recipientTitle}</Text> : null}
            {block.company ? <Text style={blockLine}>{block.company}</Text> : null}
          </View>
        ) : null}
        {block.subject ? (
          <Text style={{ ...blockLine, fontWeight: 'bold', marginBottom: BLOCK_GAP }}>{block.subject}</Text>
        ) : null}

        {/* Body — an empty editor ('<p><br></p>') is no body: no blank gap, and the preview's hint (R1-11) */}
        {hasRichText(cl.body) ? (
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

        {/* Closing and signature stay together on one page, as in the Word letter (R1-6) */}
        <View wrap={false}>
          <Text style={{ fontSize: baseSize, color: textColor, lineHeight: lineH }}>
            {sig.closing}
          </Text>
          <View style={{ marginTop: sigGap }}>
            {sig.name ? (
              <Text style={{ fontSize: baseSize, fontWeight: 'bold', color: textColor, lineHeight: 1.3 }}>{sig.name}</Text>
            ) : null}
            {sig.designation ? (
              <Text style={{ fontSize: baseSize, color: meta, lineHeight: 1.3 }}>{sig.designation}</Text>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}
