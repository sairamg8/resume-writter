import { DesignSection, SegmentControl } from '@/components/DesignPanelShared';

/**
 * Design → Page numbers (settings.pageNumbers, R2-147): "Page 1 of 2" at the foot of every page of
 * the résumé, in the PDF (= the preview, PdfPageNumbers) and the Word export's footer. Off, which
 * every résumé storing none prints, adds nothing. The cover letter, the Markdown and the ATS text
 * print none.
 */
export function PageNumbersSection({ settings, updateSetting, onReset }) {
  return (
    <DesignSection title="Page numbers" onReset={onReset}>
      <SegmentControl
        options={[{ label: 'Off', value: false }, { label: 'Page 1 of 2', value: true }]}
        value={settings.pageNumbers === true}
        onChange={v => updateSetting('pageNumbers', v)}
      />
      <p className="text-[11px] text-gray-400 leading-relaxed">
        At the bottom right of every page, inside the bottom margin, which grows to 10 mm if it is smaller.
      </p>
    </DesignSection>
  );
}
