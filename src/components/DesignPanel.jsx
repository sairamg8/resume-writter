import { useState } from 'react';
import { ATS_DEFAULTS } from '@/utils/defaultData';
import { DesignSection, NumberRow } from '@/components/DesignPanelShared';
import { ColorsSection } from '@/components/DesignPanelColors';
import { TypographySection } from '@/components/DesignPanelTypography';

const TEMPLATES = [
  { id: 'executive', label: 'Executive', desc: 'ATS-friendly · Clean accent headings · Vibrant', ats: true },
  { id: 'classic',   label: 'Classic',   desc: 'ATS-friendly · Two-column header', ats: true },
  { id: 'modern',    label: 'Modern',    desc: 'Bold accent header · Full-width layout' },
  { id: 'minimal',   label: 'Minimal',   desc: 'ATS-friendly · Clean & whitespace-first', ats: true },
  { id: 'sidebar',   label: 'Sidebar',   desc: 'Colored left sidebar layout' },
];

const COLOR_KEYS      = ['accentColor', 'textColor', 'sidebarBg', 'headerTextColor', 'nameColor', 'jobTitleColor'];
const TYPOGRAPHY_KEYS = ['font', 'fontSize', 'fontSizeBase', 'fontSizeNameDelta', 'fontSizeSectionDelta', 'fontSizeEntryDelta', 'customFont', 'iconSize'];
const SPACING_KEYS    = ['lineHeightValue', 'marginV', 'marginH', 'sectionGap', 'itemGap'];
const HEADING_KEYS    = ['headingStyle', 'sectionTitleCase', 'sectionBorderWidth', 'sectionBorderColor'];

export default function DesignPanel({ resume, updateSetting, setTemplate, resetSettings }) {
  const settings = resume.settings || {};
  const [confirmReset, setConfirmReset] = useState(false);

  function resetSection(keys) {
    keys.forEach(k => { if (k in ATS_DEFAULTS) updateSetting(k, ATS_DEFAULTS[k]); });
  }

  return (
    <div className="space-y-3 py-2">

      <DesignSection title="Template" defaultOpen>
        <div className="space-y-1.5">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => setTemplate(t.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                resume.template === t.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div
                className={`w-8 h-10 rounded shrink-0 flex flex-col gap-0.5 p-1 ${resume.template === t.id ? 'opacity-100' : 'opacity-40'}`}
                style={{ backgroundColor: resume.template === t.id ? settings.accentColor || '#2563eb' : '#94a3b8' }}
              >
                <div className="h-1 bg-white/60 rounded-sm w-full" />
                <div className="h-0.5 bg-white/40 rounded-sm w-3/4" />
                <div className="h-0.5 bg-white/30 rounded-sm w-full mt-0.5" />
                <div className="h-0.5 bg-white/30 rounded-sm w-5/6" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className={`text-sm font-medium ${resume.template === t.id ? 'text-blue-700' : 'text-gray-700'}`}>{t.label}</p>
                  {t.ats && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-emerald-100 text-emerald-700">ATS</span>}
                </div>
                <p className="text-[10px] text-gray-400">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </DesignSection>

      <ColorsSection resume={resume} settings={settings} updateSetting={updateSetting} onReset={() => resetSection(COLOR_KEYS)} />

      <TypographySection settings={settings} updateSetting={updateSetting} onReset={() => resetSection(TYPOGRAPHY_KEYS)} />

      <DesignSection title="Spacing" onReset={() => resetSection(SPACING_KEYS)}>
        <div className="space-y-3">
          <NumberRow label="Line Height" value={settings.lineHeightValue ?? 1.5} onChange={v => updateSetting('lineHeightValue', v)} min={1.0} max={3.0} step={0.1} />
          <div className="h-px bg-gray-100" />
          <NumberRow label="Top / Bottom margin" value={settings.marginV ?? 14} onChange={v => updateSetting('marginV', v)} min={0} max={40} step={1} unit="mm" />
          <NumberRow label="Left / Right margin" value={settings.marginH ?? 18} onChange={v => updateSetting('marginH', v)} min={0} max={40} step={1} unit="mm" />
          <div className="h-px bg-gray-100" />
          <NumberRow label="Between Sections" value={settings.sectionGap ?? 16} onChange={v => updateSetting('sectionGap', v)} min={0} max={60} step={1} unit="px" />
          <NumberRow label="Between Items" value={settings.itemGap ?? 12} onChange={v => updateSetting('itemGap', v)} min={0} max={40} step={1} unit="px" />
        </div>
      </DesignSection>

      <DesignSection title="Section Headings" onReset={() => resetSection(HEADING_KEYS)}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Title case</span>
          <div className="flex gap-1">
            {[{ value: 'upper', label: 'ABC' }, { value: 'normal', label: 'Abc' }].map(opt => (
              <button
                key={opt.value}
                onClick={() => updateSetting('sectionTitleCase', opt.value)}
                className={`px-3 py-1 text-xs font-semibold rounded border transition-all ${
                  (settings.sectionTitleCase || 'upper') === opt.value
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-200 text-gray-500 hover:border-blue-300'
                }`}
              >{opt.label}</button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Border thickness</span>
          <div className="flex items-center gap-1">
            <button onClick={() => updateSetting('sectionBorderWidth', Math.max(1, (settings.sectionBorderWidth ?? 1) - 1))} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 hover:bg-gray-100 text-base leading-none">−</button>
            <input type="number" min={1} max={8} value={settings.sectionBorderWidth ?? 1} onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) updateSetting('sectionBorderWidth', Math.min(8, Math.max(1, v))); }} className="w-10 text-center text-xs font-medium text-gray-700 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 h-6" />
            <button onClick={() => updateSetting('sectionBorderWidth', Math.min(8, (settings.sectionBorderWidth ?? 1) + 1))} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 hover:bg-gray-100 text-base leading-none">+</button>
            <span className="text-[11px] text-gray-400 ml-1">px</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Border color</span>
          <div className="flex items-center gap-2">
            <input type="color" value={settings.sectionBorderColor || settings.accentColor || '#374151'} onChange={e => updateSetting('sectionBorderColor', e.target.value)} className="h-6 w-10 rounded border border-gray-200 cursor-pointer p-0.5" title="Pick border color" />
            <span className="text-[11px] text-gray-400 font-mono">{settings.sectionBorderColor || 'accent'}</span>
            {settings.sectionBorderColor && (
              <button onClick={() => updateSetting('sectionBorderColor', '')} className="text-[11px] text-gray-400 hover:text-gray-600" title="Reset to accent color">↺</button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {[
            { value: 'ruled',     label: 'Ruled' },
            { value: 'leftbar',   label: 'Left bar' },
            { value: 'line',      label: 'Line after' },
            { value: 'underline', label: 'Underline' },
            { value: 'box',       label: 'Boxed' },
            { value: 'plain',     label: 'Plain' },
          ].map(opt => {
            const active = (settings.headingStyle || 'ruled') === opt.value;
            const accent = settings.accentColor || '#374151';
            return (
              <button key={opt.value} onClick={() => updateSetting('headingStyle', opt.value)} className={`px-2 py-2 rounded-lg border text-left transition-all ${active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="mb-1">
                  {opt.value === 'ruled'     && <div><span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: '#374151' }}>ABC</span><div className="h-px mt-0.5" style={{ backgroundColor: '#e5e7eb' }} /></div>}
                  {opt.value === 'leftbar'   && <div className="flex items-center gap-1"><div className="w-0.5 self-stretch rounded-full" style={{ backgroundColor: accent }} /><span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: '#374151' }}>ABC</span></div>}
                  {opt.value === 'line'      && <div className="flex items-center gap-1"><span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: accent }}>ABC</span><span className="flex-1 h-px" style={{ backgroundColor: accent + '60' }} /></div>}
                  {opt.value === 'underline' && <div className="pb-0.5 inline-block" style={{ borderBottom: `1.5px solid ${accent}` }}><span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: accent }}>ABC</span></div>}
                  {opt.value === 'box'       && <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color: accent, backgroundColor: accent + '18' }}>ABC</span>}
                  {opt.value === 'plain'     && <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: accent }}>ABC</span>}
                </div>
                <span className={`text-[10px] ${active ? 'text-blue-700 font-medium' : 'text-gray-500'}`}>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </DesignSection>

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-amber-800">Reset Design Settings</p>
            <p className="text-[10px] text-amber-600 mt-0.5">
              {confirmReset
                ? 'This will reset all design settings to ATS defaults. Resume content is kept.'
                : 'Resets font, colors, spacing, and layout settings to ATS-safe defaults.'}
            </p>
          </div>
          {confirmReset ? (
            <div className="flex gap-1.5 shrink-0">
              <button onClick={() => { resetSettings?.(); setConfirmReset(false); }} className="px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">Yes, Reset</button>
              <button onClick={() => setConfirmReset(false)} className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmReset(true)} className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-colors shrink-0">Reset</button>
          )}
        </div>
      </div>
    </div>
  );
}
