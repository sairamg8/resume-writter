import { View } from '@react-pdf/renderer';
import { PdfDesignedDocument, PdfDesignedHeader } from './shared/PdfDesigned';
import { LECTERN_RULE } from './shared/designedMarks';

/**
 * Lectern — a page set on its centre line: picking it (and Reset) centres the header (TEMPLATES.lectern
 * .style, Text Alignment "Center"), a short accent rule stands centred under it, and every section title is
 * centred between two rules (Line after, centred; sectionHeadingLook's `center`) — the entries keep the
 * section's own Alignment, so their dates stay at the right where a parser reads them. The header is
 * Classic's, with every Header Customization control (PdfDesignedHeader). ATS: certified — one column; the
 * rules are fills.
 */
export function LecternTemplatePDF({ data }) {
  const s = data.settings || {};
  const centered = (s.headerAlign || 'left') === 'center';
  const rule = <View style={{ ...LECTERN_RULE, backgroundColor: s.accentColor, marginTop: 10, alignSelf: centered ? 'center' : 'flex-start' }} />;
  return <PdfDesignedDocument data={data} header={<PdfDesignedHeader personal={data.personal} settings={s} bottom={rule} />} />;
}
