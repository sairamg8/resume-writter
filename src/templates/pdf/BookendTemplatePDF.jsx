import { View } from '@react-pdf/renderer';
import { PdfDesignedDocument, PdfDesignedHeader } from './shared/PdfDesigned';
import { abovePageNumbersPt, pageMargins } from './shared/PdfPage';
import { BOOKEND_FOOT, BOOKEND_RULE } from './shared/designedMarks';

/**
 * Bookend — the header held between two heavy accent rules, and a thin one along the foot of every page,
 * in its bottom margin (a fixed fill, drawn before the page's text; above the page number when Design →
 * Page numbers is on), so each page closes as the header
 * opens. Section titles are followed by a rule to the column's end (Line after). The header is Classic's,
 * with every Header Customization control (PdfDesignedHeader); the body is the shared single column.
 * ATS: certified — the rules are fills; the foot's rule sits in the margin, never between two lines of text.
 */
export function BookendTemplatePDF({ data }) {
  const s = data.settings || {};
  const { v, h } = pageMargins(s);
  const rule = (style) => <View style={{ height: BOOKEND_RULE, backgroundColor: s.accentColor, ...style }} />;
  // The foot's rule is centred in the bottom margin — with Page numbers on, it sits just above their line.
  const footBottom = abovePageNumbersPt(s) ?? `${v / 2}mm`;
  return (
    <PdfDesignedDocument
      data={data}
      marks={<View fixed style={{ position: 'absolute', left: `${h}mm`, right: `${h}mm`, bottom: footBottom, height: BOOKEND_FOOT, backgroundColor: s.accentColor }} />}
      header={<PdfDesignedHeader personal={data.personal} settings={s} top={rule({ marginBottom: 10 })} bottom={rule({ marginTop: 12 })} />}
    />
  );
}
