import { DesignSection } from '@/components/DesignPanelShared';
import { SECTION_BORDER_PT } from '@/constants/designNumbers';
import { headingBorderControls, headingBorderExtraPt, upperSectionTitles } from '@/constants/templates';
import { DEFAULTS } from '@/templates/pdf/shared/templateSettings';
import { sectionHeadingLook } from '@/templates/pdf/shared/sectionHeadingLook';

/** The heading styles the panel offers, in the order it lays them out. */
const HEADING_STYLES = [
  { value: 'ruled',     label: 'Ruled' },
  { value: 'leftbar',   label: 'Left bar' },
  { value: 'line',      label: 'Line after' },
  { value: 'underline', label: 'Underline' },
  { value: 'box',       label: 'Boxed' },
  { value: 'plain',     label: 'Plain' },
];

/**
 * Design → Section Headings, without its collapsible frame, so it can be rendered on its own.
 * `template`: the one the PDF prints (Sidebar's side column keeps its own headings).
 *
 * Every control marks what the PDF prints. Where the résumé stores no heading style or title case
 * (older data, an imported file) that is the template's own PDF fallback — Classic's 'line',
 * Executive's normal case — not the 'ruled' / 'upper' the panel marked for every template, which
 * made clicking the marked chip change the PDF (R5-3). The fallbacks are the PDF's (DEFAULTS,
 * templateSettings.js), not the style picking a template stores: an unset Classic heading prints
 * 'line' where picking Classic sets 'ruled'.
 */
export function HeadingControls({ settings, template, updateSetting }) {
  const headingStyle = settings.headingStyle || DEFAULTS[template].headingStyle;
  const titleCase = upperSectionTitles(settings.sectionTitleCase || DEFAULTS[template].sectionTitleCase)
    ? 'upper' : 'normal';
  const borderControls = headingBorderControls(headingStyle);
  // Border thickness in the pt this style prints: Left bar's bar is 2 pt wider than the stored 1–8,
  // so there it shows and sets 3–10 pt, and the stored value keeps its look (ONB-12).
  const extraPt = headingBorderExtraPt(headingStyle);
  const borderPt = Number(settings.sectionBorderWidth ?? 1) + extraPt;
  const setBorderPt = (pt) => updateSetting('sectionBorderWidth', Math.min(SECTION_BORDER_PT.max, Math.max(SECTION_BORDER_PT.min, pt - extraPt)));
  // Boxed as the PDF prints it on this template: Banner's is a filled chip, the title reversed out of it.
  const boxLook = sectionHeadingLook({ template, headingStyle: 'box', accent: settings.accentColor || '#2563eb', borderColor: settings.sectionBorderColor || '' });

  return (
    <>
      {template === 'sidebar' && (
        <p className="text-[11px] text-gray-400 leading-relaxed">
          These style the main column&apos;s headings. The side column keeps its own small headings and rule; only Title case applies there.
        </p>
      )}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">Title case</span>
        <div className="flex gap-1">
          {[{ value: 'upper', label: 'ABC' }, { value: 'normal', label: 'Abc' }].map(opt => (
            <button
              key={opt.value}
              onClick={() => updateSetting('sectionTitleCase', opt.value)}
              className={`px-3 py-1 text-xs font-semibold rounded border transition-all ${
                titleCase === opt.value
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-200 text-gray-500 hover:border-blue-300'
              }`}
            >{opt.label}</button>
          ))}
        </div>
      </div>

      <div className={`flex items-center justify-between ${!borderControls.thickness ? 'opacity-40' : ''}`}>
        <span className="text-xs text-gray-500">Border thickness</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!borderControls.thickness}
            onClick={() => setBorderPt(borderPt - 1)}
            className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 enabled:hover:bg-gray-100 disabled:cursor-not-allowed text-base leading-none"
          >−</button>
          <input
            type="number"
            disabled={!borderControls.thickness}
            aria-label="Section border thickness (pt)"
            min={1 + extraPt}
            max={8 + extraPt}
            value={borderPt}
            onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) setBorderPt(v); }}
            className="w-10 text-center text-xs font-medium text-gray-700 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:bg-gray-50 disabled:cursor-not-allowed h-6"
          />
          <button
            type="button"
            disabled={!borderControls.thickness}
            onClick={() => setBorderPt(borderPt + 1)}
            className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 enabled:hover:bg-gray-100 disabled:cursor-not-allowed text-base leading-none"
          >+</button>
          {/* Points, as the PDF prints it — every saved value keeps its look (VM3-3, as R3-7) */}
          <span className="text-[11px] text-gray-400 ml-1">pt</span>
        </div>
      </div>
      {extraPt > 0 && (
        <p className="text-[11px] text-gray-400 leading-relaxed">A left bar is {extraPt} pt wider than a rule, so it starts at {1 + extraPt} pt.</p>
      )}
      {!borderControls.thickness && headingStyle === 'box' && (
        <p className="text-[11px] text-gray-400 leading-relaxed">
          {boxLook.chip ? 'Boxed has no border line: it prints a filled tag in the Border color.' : 'Boxed has no border line.'}
        </p>
      )}
      {!borderControls.thickness && headingStyle === 'plain' && (
        <p className="text-[11px] text-gray-400 leading-relaxed">Plain has no border.</p>
      )}

      <div className={`flex items-center justify-between ${!borderControls.color ? 'opacity-40' : ''}`}>
        <span className="text-xs text-gray-500">Border color</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            disabled={!borderControls.color}
            value={settings.sectionBorderColor || settings.accentColor || '#374151'}
            onChange={e => updateSetting('sectionBorderColor', e.target.value)}
            className="h-6 w-10 rounded border border-gray-200 cursor-pointer disabled:cursor-not-allowed p-0.5"
            title="Pick border color"
            aria-label="Section border color"
          />
          <span className="text-[11px] text-gray-400 font-mono">{settings.sectionBorderColor || 'accent'}</span>
          {settings.sectionBorderColor && (
            <button
              type="button"
              disabled={!borderControls.color}
              onClick={() => updateSetting('sectionBorderColor', '')}
              className="text-[11px] text-gray-400 enabled:hover:text-gray-600 disabled:cursor-not-allowed"
              title="Reset to accent color"
            >↺</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {HEADING_STYLES.map(opt => {
          const active = headingStyle === opt.value;
          const accent = settings.accentColor || '#374151';
          return (
            <button key={opt.value} onClick={() => updateSetting('headingStyle', opt.value)} className={`px-2 py-2 rounded-lg border text-left transition-all ${active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className="mb-1">
                {opt.value === 'ruled'     && <div><span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: '#374151' }}>ABC</span><div className="h-px mt-0.5" style={{ backgroundColor: '#e5e7eb' }} /></div>}
                {opt.value === 'leftbar'   && <div className="flex items-center gap-1"><div className="w-0.5 self-stretch rounded-full" style={{ backgroundColor: accent }} /><span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: '#374151' }}>ABC</span></div>}
                {opt.value === 'line'      && <div className="flex items-center gap-1"><span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: accent }}>ABC</span><span className="flex-1 h-px" style={{ backgroundColor: accent + '60' }} /></div>}
                {opt.value === 'underline' && <div className="pb-0.5 inline-block" style={{ borderBottom: `1.5px solid ${accent}` }}><span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: accent }}>ABC</span></div>}
                {opt.value === 'box'       && <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={boxLook.chip ? { color: boxLook.text, backgroundColor: boxLook.box } : { color: accent, backgroundColor: accent + '18' }}>ABC</span>}
                {opt.value === 'plain'     && <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: accent }}>ABC</span>}
              </div>
              <span className={`text-[10px] ${active ? 'text-blue-700 font-medium' : 'text-gray-500'}`}>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Design → Section Headings: the controls in the panel's collapsible frame. */
export function HeadingsSection({ settings, template, updateSetting, onReset }) {
  return (
    <DesignSection title="Section Headings" onReset={onReset}>
      <HeadingControls settings={settings} template={template} updateSetting={updateSetting} />
    </DesignSection>
  );
}
