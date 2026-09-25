import { View } from '@react-pdf/renderer';
import { PdfDesignedDocument, PdfDesignedHeader } from './shared/PdfDesigned';
import { LINEN_STITCH } from './shared/designedMarks';

/**
 * Linen — soft and open: picking it (and Reset) brings Lato, title-case section titles and a looser Line
 * Height (TEMPLATES.linen.style); a short accent stitch sits over the name, and each title is underlined only
 * as far as it runs (Underline's `soft` mark, sectionHeadingLook). The header is Classic's, with every Header
 * Customization control (PdfDesignedHeader). ATS: certified — one column; the marks are fills.
 */
export function LinenTemplatePDF({ data }) {
  const s = data.settings || {};
  const centered = (s.headerAlign || 'left') === 'center';
  const stitch = <View style={{ ...LINEN_STITCH, backgroundColor: s.accentColor, marginBottom: 8, alignSelf: centered ? 'center' : 'flex-start' }} />;
  return <PdfDesignedDocument data={data} header={<PdfDesignedHeader personal={data.personal} settings={s} top={stitch} />} />;
}
