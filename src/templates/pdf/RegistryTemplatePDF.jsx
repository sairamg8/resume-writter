import { View } from '@react-pdf/renderer';
import { PdfDesignedDocument, PdfDesignedHeader } from './shared/PdfDesigned';
import { REGISTRY_BAR, REGISTRY_BAR_GAP } from './shared/designedMarks';

/**
 * Registry — a ledger's page: a solid accent bar across the column over the name, section titles over a
 * dotted rule (Underline's `dotted` mark, sectionHeadingLook), and each job leading with the role
 * (TEMPLATE_SECTION_DEFAULTS). The header is Classic's, with every Header Customization control
 * (PdfDesignedHeader); the body is the shared single column. ATS: certified — the bar and the dots are fills.
 */
export function RegistryTemplatePDF({ data }) {
  const s = data.settings || {};
  return (
    <PdfDesignedDocument
      data={data}
      header={<PdfDesignedHeader personal={data.personal} settings={s} top={<View style={{ height: REGISTRY_BAR, backgroundColor: s.accentColor, marginBottom: REGISTRY_BAR_GAP }} />} />}
    />
  );
}
