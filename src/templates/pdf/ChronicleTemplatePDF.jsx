import { View } from '@react-pdf/renderer';
import { PdfDesignedDocument, PdfDesignedHeader } from './shared/PdfDesigned';
import { CHRONICLE_RULES } from './shared/designedMarks';

/**
 * Chronicle — a newspaper's masthead: picking it (and Reset) brings PT Serif (TEMPLATES.chronicle.style),
 * the header closes on a thick-and-thin rule in the accent, and each section title sits on a double rule
 * (Underline's `double` mark, sectionHeadingLook). The header is Classic's, with every Header Customization
 * control (PdfDesignedHeader); the body is the shared single column. ATS: certified — the rules are fills.
 */
export function ChronicleTemplatePDF({ data }) {
  const s = data.settings || {};
  const { thick, thin, gap } = CHRONICLE_RULES;
  const rules = (
    <View style={{ marginTop: 10 }}>
      <View style={{ height: thick, backgroundColor: s.accentColor }} />
      <View style={{ height: thin, backgroundColor: s.accentColor, marginTop: gap }} />
    </View>
  );
  return <PdfDesignedDocument data={data} header={<PdfDesignedHeader personal={data.personal} settings={s} bottom={rules} />} />;
}
