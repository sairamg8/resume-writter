import { View } from '@react-pdf/renderer';
import { PdfDesignedDocument, PdfDesignedHeader } from './shared/PdfDesigned';
import { BROADSHEET_RULE, BROADSHEET_RULE_GAP } from './shared/designedMarks';

/**
 * Broadsheet — a headline: picking it (and Reset) brings a large name (TEMPLATES.broadsheet.style, Full
 * Name 25 pt at the default base) with a heavy rule in the Text colour under it, and each section title
 * under a rule of its own in the accent, as a newspaper heads a column (Ruled's `overline` mark,
 * sectionHeadingLook). The header is Classic's, with every Header Customization control (PdfDesignedHeader).
 * ATS: certified — the rules are fills, drawn between the name and the title runs, never inside one.
 */
export function BroadsheetTemplatePDF({ data }) {
  const s = data.settings || {};
  const rule = <View style={{ height: BROADSHEET_RULE, backgroundColor: s.nameColor || s.textColor, marginVertical: BROADSHEET_RULE_GAP, alignSelf: 'stretch' }} />;
  return <PdfDesignedDocument data={data} header={<PdfDesignedHeader personal={data.personal} settings={s} underName={rule} />} />;
}
