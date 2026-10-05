import { NumberRow, SegmentControl } from '@/components/DesignPanelShared';
import { LAYOUT_OPTIONS, SIDE_WIDTH_PCT, columnsOf, layoutOption, sideWidthOf } from '@/constants/layoutOptions';

/** A choice's buttons as SegmentControl takes them, from the one list the PDF and Word draw (layoutOptions.js). */
const segments = (key) => LAYOUT_OPTIONS[key].map(({ val, label }) => ({ label, value: val }));

/**
 * Design → Template → Layout's column choices for the two-column Sidebar (R2-147-col; the options and
 * what each prints: src/constants/layoutOptions.js). Shown only on the Sidebar's two columns: Single ·
 * ATS-safe prints Classic's page, with no column to place or size, and every other template prints one
 * column. Mixed has its details on a band across the top, so it takes no Details and none is offered.
 * Each control shows what prints: a value no build offered, or none, as its default (layoutOption,
 * sideWidthOf). Each row carries a data-testid the browser walk finds it by (parity-ui-controls).
 */
export function SidebarColumnsLayout({ settings, updateSetting }) {
  const columns = columnsOf(settings);
  return (
    <div className="mt-3 space-y-2.5">
      <div data-testid="layout-columns" className="space-y-1.5">
        <p className="text-xs text-gray-600">Columns</p>
        <SegmentControl options={segments('layoutColumns')} value={columns} onChange={(v) => updateSetting('layoutColumns', v)} />
      </div>
      {columns === 'two' && (
        <div data-testid="layout-details" className="space-y-1.5">
          <p className="text-xs text-gray-600">Details · photo, name and contacts</p>
          <SegmentControl options={segments('layoutDetails')} value={layoutOption('layoutDetails', settings.layoutDetails)} onChange={(v) => updateSetting('layoutDetails', v)} />
        </div>
      )}
      <div data-testid="layout-width">
        <NumberRow
          label={columns === 'mixed' ? 'Left column' : 'Side column'}
          value={sideWidthOf(settings.layoutSideWidth)}
          onChange={(v) => updateSetting('layoutSideWidth', v)}
          min={SIDE_WIDTH_PCT.min}
          max={SIDE_WIDTH_PCT.max}
          step={SIDE_WIDTH_PCT.step}
          unit="%"
        />
      </div>
      <p className="text-[10px] text-gray-400">
        {columns === 'mixed'
          ? 'Mixed: your details on a band across the top, the main sections across the page, then skills, education, languages, certifications, interests and references two to a row, one entry to a line. The width is the left one\'s, % of the paper.'
          : 'Side column: skills, education, languages, certifications, interests and references beside the main sections, with your details at the top of the column — or on a band across the page (Top). The width is the column\'s, % of the paper.'}
      </p>
    </div>
  );
}
