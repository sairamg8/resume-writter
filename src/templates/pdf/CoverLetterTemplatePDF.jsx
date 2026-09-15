import { Document, Page, View } from '@react-pdf/renderer';
import { Text } from './shared/PdfText';
import { getPageStyle, getDocumentProps } from './shared/PdfPage';
import { PdfRichText } from './shared/PdfRichText';
import { letterGrey, letterheadLook } from './shared/letterhead';
import { CoverLetterHeader } from './CoverLetterHeaderPDF';
import { letterBlock, letterContactFormat, letterHiddenFields, letterSignature } from '@/utils/coverLetter';
import { hasRichText } from '@/utils/richText';
import { pageSizeOf } from '@/constants/pageSize';

/** Space under the date, the recipient block and the subject. */
const BLOCK_GAP = 12;

export function CoverLetterTemplatePDF({ data }) {
  const { personal = {}, settings = {}, coverLetter = {} } = data;
  const cl = coverLetter || {};

  const textColor = settings.textColor      || '#1e293b';
  // The letter's text in the Text colour, the designation in its grey (the contacts', R9-13): a
  // custom Text colour reaches every line of it (R1-13), as it does the résumé's sections
  // (f37a9f5). The letterhead's colours are the résumé header's (letterheadLook).
  const grey      = letterGrey(textColor);
  const baseSize  = settings.fontSizeBase   || 11;
  const lineH     = settings.lineHeightValue || 1.5;

  // The letterhead takes the résumé template's look: its band or rule, colours and alignment (FIDB-51).
  const look = letterheadLook(data.template, settings);

  const sig    = letterSignature(cl, personal);
  const sigGap = sig.wide ? 24 : 8;

  const block     = letterBlock(cl, settings);
  const blockLine = { fontSize: baseSize, color: textColor, lineHeight: 1.3 };

  const pageStyle = getPageStyle({
    ...settings,
    _pdfFontFamily: settings._pdfFontFamily || 'NotoSans',
  });

  return (
    <Document
      {...getDocumentProps(personal)}
      title={personal?.name ? `${personal.name} Cover Letter` : 'Cover Letter'}
      subject="Cover Letter"
    >
      <Page size={pageSizeOf(settings)} style={{ ...pageStyle, color: textColor }}>
        <CoverLetterHeader
          look={look}
          personal={personal}
          settings={settings}
          cl={cl}
          hidden={letterHiddenFields(cl, personal)}
          contacts={letterContactFormat(cl, settings)}
        />

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
              <Text style={{ fontSize: baseSize, color: grey, lineHeight: 1.3 }}>{sig.designation}</Text>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}
