import { PdfDesignedDocument, PdfDesignedHeader } from './shared/PdfDesigned';
import { KEEL_BAR, KEEL_PAD } from './shared/designedMarks';

/**
 * Keel — an accent bar down the whole left side of the header, the name, title, contacts and summary set
 * off it, and section titles with a bar of their own (Left bar). The header is Classic's, with every Header
 * Customization control (PdfDesignedHeader), less the bar's width. ATS: certified — the bars are fills.
 */
export function KeelTemplatePDF({ data }) {
  const s = data.settings || {};
  return (
    <PdfDesignedDocument
      data={data}
      header={<PdfDesignedHeader personal={data.personal} settings={s} frame={{ borderLeftWidth: KEEL_BAR, borderLeftColor: s.accentColor, paddingLeft: KEEL_PAD }} />}
    />
  );
}
