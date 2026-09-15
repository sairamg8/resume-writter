import { useId } from 'react';
import { DesignSection } from '@/components/DesignPanelShared';
import { DATE_FORMATS, DEFAULT_DATE_FORMAT, dateFormatOf, formatDate } from '@/utils/dates';

/** The date each choice is shown on, as the picker stores one. */
const SAMPLE = 'Jan 2024';

const optionLabel = (id) => {
  if (id === DEFAULT_DATE_FORMAT) return 'As entered';
  const sample = formatDate(SAMPLE, { dateFormat: id });
  return id === 'YYYY' ? `${sample} (year only)` : sample;
};

/**
 * Design → Dates: the résumé's Date format (PAR-06, src/utils/dates.js) — every dated entry of the
 * PDF and the Word export, and the cover letter's date. As entered, which every résumé storing no
 * format prints, shows each date as it was picked or imported.
 */
export function DatesSection({ settings, updateSetting, onReset }) {
  const id = useId();
  return (
    <DesignSection title="Dates" onReset={onReset}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-xs text-gray-600">Date format</label>
        <select
          id={id}
          value={dateFormatOf(settings)}
          onChange={e => updateSetting('dateFormat', e.target.value)}
          className="px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {DATE_FORMATS.map(f => <option key={f} value={f}>{optionLabel(f)}</option>)}
        </select>
      </div>
      <p className="text-[11px] text-gray-400 leading-relaxed">
        Every date on the résumé, and the cover letter&apos;s date. Text that is not a month and year, like &ldquo;Summer 2020&rdquo;, prints as typed.
      </p>
    </DesignSection>
  );
}
