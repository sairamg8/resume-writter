import { useState } from 'react';
import { ATS_DEFAULTS, defaultSettings } from '@/utils/defaultData';
import { contactIconHint, drawsContactIcons, TEMPLATE_PICKER, templateId } from '@/constants/templates';
import { MARGIN_MM } from '@/constants/pageMargins';
import { ITEM_GAP_PX, LINE_HEIGHT, SECTION_GAP_PX } from '@/constants/spacingNumbers';
import { DesignSection, NumberRow } from '@/components/DesignPanelShared';
import { HeadingsSection } from '@/components/DesignPanelHeadings';
import { ColorsSection } from '@/components/DesignPanelColors';
import { TypographySection } from '@/components/DesignPanelTypography';
import { DatesSection } from '@/components/DesignPanelDates';
import {
  ICON_SET_OPTIONS,
  ContactIcon,
  getIconSetId,
} from '@/utils/contactIcons';
import { CONTACT_FIELDS } from '@/utils/contacts';

const COLOR_KEYS      = ['accentColor', 'textColor', 'sidebarBg', 'headerTextColor', 'nameColor', 'jobTitleColor'];
const TYPOGRAPHY_KEYS = ['font', 'fontSize', 'fontSizeBase', 'fontSizeNameDelta', 'fontSizeSectionDelta', 'fontSizeEntryDelta', 'customFont', 'iconSize'];
const SPACING_KEYS    = ['lineHeightValue', 'marginV', 'marginH', 'sectionGap', 'itemGap'];
const HEADING_KEYS    = ['headingStyle', 'sectionTitleCase', 'sectionBorderWidth', 'sectionBorderColor'];
const ICON_KEYS       = ['iconSet', 'iconSize', 'contactStyle'];
const DATE_KEYS       = ['dateFormat'];

export default function DesignPanel({ resume, updateSetting, setTemplate, resetSettings }) {
  const settings = resume.settings || {};
  const current = templateId(resume.template); // the template the PDF prints
  // Modern and Sidebar draw the pack whatever Contact style says, the others only with Icon.
  const drawsIcons = drawsContactIcons(current, settings);
  const [confirmReset, setConfirmReset] = useState(false);

  /** A section's reset: its settings back to the template's defaults (Sidebar's plain headings, …). */
  function resetSection(keys) {
    const defaults = defaultSettings(resume.template);
    keys.forEach(k => { if (k in defaults) updateSetting(k, defaults[k]); });
  }

  return (
    <div className="space-y-3 py-2">

      <DesignSection title="Template" defaultOpen>
        <div className="space-y-1.5">
          {TEMPLATE_PICKER.map(t => (
            <button
              key={t.id}
              onClick={() => setTemplate(t.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                current === t.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div
                className={`w-8 h-10 rounded shrink-0 flex flex-col gap-0.5 p-1 ${current === t.id ? 'opacity-100' : 'opacity-40'}`}
                style={{ backgroundColor: current === t.id ? settings.accentColor || '#2563eb' : '#94a3b8' }}
              >
                <div className="h-1 bg-white/60 rounded-sm w-full" />
                <div className="h-0.5 bg-white/40 rounded-sm w-3/4" />
                <div className="h-0.5 bg-white/30 rounded-sm w-full mt-0.5" />
                <div className="h-0.5 bg-white/30 rounded-sm w-5/6" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className={`text-sm font-medium ${current === t.id ? 'text-blue-700' : 'text-gray-700'}`}>{t.label}</p>
                  {t.ats && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-emerald-100 text-emerald-700">ATS</span>}
                </div>
                <p className="text-[10px] text-gray-400">{t.desc}</p>
              </div>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 mt-2">The cover letter&apos;s header takes the template&apos;s look too.</p>
      </DesignSection>

      <ColorsSection resume={resume} settings={settings} updateSetting={updateSetting} onReset={() => resetSection(COLOR_KEYS)} />

      <DesignSection title="Contact icons" defaultOpen onReset={() => resetSection(ICON_KEYS)}>
        <p className="text-[11px] text-gray-400 mb-2 leading-relaxed">
          {contactIconHint(current, settings, resume?.coverLetter)}
        </p>
        <div className="space-y-2">
          {ICON_SET_OPTIONS.map(opt => {
            const active = getIconSetId(settings) === opt.id;
            const previewSettings = { ...settings, iconSet: opt.id, customContactIcons: {} };
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  updateSetting('iconSet', opt.id);
                  // Only where the style hides the pack. In Modern and Sidebar it is the letter's
                  // style too, and the one a switch to Classic brings back: left alone (R9-4).
                  if (!drawsIcons) updateSetting('contactStyle', 'icon');
                }}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                  active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div>
                    <p className={`text-sm font-medium ${active ? 'text-blue-700' : 'text-gray-700'}`}>{opt.label}</p>
                    <p className="text-[10px] text-gray-400">{opt.desc}</p>
                  </div>
                  {active && <span className="text-[10px] font-semibold text-blue-600">Selected</span>}
                </div>
                <div className={`flex items-center gap-2.5 ${active ? 'text-blue-700' : 'text-gray-600'}`}>
                  {CONTACT_FIELDS.map(({ key, label }) => (
                    <span key={key} className="inline-flex w-5 h-5 items-center justify-center" title={label}>
                      <ContactIcon field={key} settings={previewSettings} size={16} />
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
          <span className="text-xs text-gray-500">Icon size</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => updateSetting('iconSize', Math.max(8, (settings.iconSize ?? 11) - 1))}
              className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 hover:bg-gray-100 text-base leading-none"
            >−</button>
            <span className="w-10 text-center text-xs font-medium text-gray-700 border border-gray-200 rounded h-6 flex items-center justify-center">
              {settings.iconSize ?? 11}px
            </span>
            <button
              type="button"
              onClick={() => updateSetting('iconSize', Math.min(20, (settings.iconSize ?? 11) + 1))}
              className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 hover:bg-gray-100 text-base leading-none"
            >+</button>
          </div>
        </div>
      </DesignSection>

      <TypographySection settings={settings} template={current} updateSetting={updateSetting} onReset={() => resetSection(TYPOGRAPHY_KEYS)} />

      <DesignSection title="Spacing" onReset={() => resetSection(SPACING_KEYS)}>
        <div className="space-y-3">
          <NumberRow label="Line Height" value={settings.lineHeightValue ?? 1.5} onChange={v => updateSetting('lineHeightValue', v)} min={LINE_HEIGHT.min} max={LINE_HEIGHT.max} step={0.1} />
          <div className="h-px bg-gray-100" />
          <NumberRow label="Top / Bottom margin" value={settings.marginV ?? 14} onChange={v => updateSetting('marginV', v)} min={MARGIN_MM.min} max={MARGIN_MM.max} step={1} unit="mm" />
          <NumberRow label="Left / Right margin" value={settings.marginH ?? 18} onChange={v => updateSetting('marginH', v)} min={MARGIN_MM.min} max={MARGIN_MM.max} step={1} unit="mm" />
          <div className="h-px bg-gray-100" />
          <NumberRow label="Between Sections" value={settings.sectionGap ?? 16} onChange={v => updateSetting('sectionGap', v)} min={SECTION_GAP_PX.min} max={SECTION_GAP_PX.max} step={1} unit="px" />
          <NumberRow label="Between Items" value={settings.itemGap ?? ATS_DEFAULTS.itemGap} onChange={v => updateSetting('itemGap', v)} min={ITEM_GAP_PX.min} max={ITEM_GAP_PX.max} step={1} unit="px" />
        </div>
      </DesignSection>

      <HeadingsSection settings={settings} template={current} updateSetting={updateSetting} onReset={() => resetSection(HEADING_KEYS)} />

      <DatesSection settings={settings} updateSetting={updateSetting} onReset={() => resetSection(DATE_KEYS)} />

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-amber-800">Reset Design Settings</p>
            <p className="text-[10px] text-amber-600 mt-0.5">
              {confirmReset
                ? 'This will reset all design settings to this template\'s ATS-safe defaults. Resume content and uploaded contact icons are kept.'
                : 'Resets font, colors, spacing, and layout settings to this template\'s ATS-safe defaults.'}
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
