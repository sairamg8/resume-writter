import { View } from '@react-pdf/renderer';
import { PdfDesignedDocument, PdfDesignedHeader } from './shared/PdfDesigned';
import { GRID_HAIRLINE, gridHairlineColor } from './shared/designedMarks';

/**
 * Gridline — a page ruled like a grid: a hairline over the name and another under the header, and every
 * section title between two hairlines (Ruled's `framed` mark, sectionHeadingLook), all in the accent at half
 * strength. The header is Classic's, with every Header Customization control (PdfDesignedHeader); the body
 * is the shared single column. ATS: certified, as Classic — the hairlines are fills, not text, so every
 * reader extracts name → title → contacts → summary, each section title whole and each entry's fields as
 * runs of their own (tests/pdf/42-ats-fields, tests/pdf/99-designed-layouts).
 */
export function GridlineTemplatePDF({ data }) {
  const s = data.settings || {};
  const hairline = (style) => <View style={{ height: GRID_HAIRLINE, backgroundColor: gridHairlineColor(s.accentColor), ...style }} />;
  return (
    <PdfDesignedDocument
      data={data}
      header={<PdfDesignedHeader personal={data.personal} settings={s} top={hairline({ marginBottom: 8 })} bottom={hairline({ marginTop: 10 })} />}
    />
  );
}
