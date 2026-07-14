import { useState, useEffect } from 'react';
import { FONTS, getFontById, loadGoogleFont, loadCustomGoogleFont, loadCustomFonts, saveCustomFont, removeCustomFont } from '@/utils/fonts';
import { Label, SizeRow, SegmentControl, DesignSection } from '@/components/DesignPanelShared';

export function TypographySection({ settings, updateSetting, onReset }) {
  const [customFontInput, setCustomFontInput] = useState('');
  const [savedCustomFonts, setSavedCustomFonts] = useState(() => loadCustomFonts());

  useEffect(() => {
    const font = getFontById(settings.font);
    if (font) loadGoogleFont(font);
  }, [settings.font]);

  useEffect(() => {
    savedCustomFonts.forEach(name => loadCustomGoogleFont(name));
  }, []);

  function applyCustomFont(name) {
    loadCustomGoogleFont(name);
    updateSetting('customFont', name);
    updateSetting('font', '');
    saveCustomFont(name);
    setSavedCustomFonts(loadCustomFonts());
    setCustomFontInput('');
  }

  return (
    <DesignSection title="Typography" onReset={onReset}>
      <div>
        <Label>Font Family</Label>
        <div className="grid grid-cols-3 gap-1 mb-2">
          {FONTS.map(font => (
            <button
              key={font.id}
              onClick={() => { updateSetting('font', font.id); updateSetting('customFont', ''); setCustomFontInput(''); }}
              style={{ fontFamily: font.family }}
              className={`px-1.5 py-1.5 text-xs rounded-md border transition-all text-left truncate ${
                settings.font === font.id && !settings.customFont
                  ? 'bg-blue-50 border-blue-400 text-blue-700'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {font.label}
            </button>
          ))}
        </div>
        {savedCustomFonts.length > 0 && (
          <div className="mb-2">
            <p className="text-[11px] text-gray-400 mb-1">Your custom fonts</p>
            <div className="flex flex-wrap gap-1">
              {savedCustomFonts.map(name => {
                const active = settings.customFont === name;
                return (
                  <div key={name} className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs transition-all ${active ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    <button style={{ fontFamily: `'${name}', sans-serif` }} onClick={() => { loadCustomGoogleFont(name); updateSetting('customFont', name); updateSetting('font', ''); }} className="leading-none">{name}</button>
                    <button
                      onClick={() => { removeCustomFont(name); setSavedCustomFonts(loadCustomFonts()); if (settings.customFont === name) updateSetting('customFont', ''); }}
                      className="text-gray-300 hover:text-red-400 leading-none ml-0.5"
                      title="Remove font"
                    >×</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <p className="text-[11px] text-gray-400 mb-1">Add a Google Font:</p>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={customFontInput}
            onChange={e => setCustomFontInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && customFontInput.trim()) applyCustomFont(customFontInput.trim()); }}
            placeholder="e.g. Nunito, Raleway, Poppins"
            className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={() => { if (customFontInput.trim()) applyCustomFont(customFontInput.trim()); }} className="px-2.5 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700">Add</button>
        </div>
      </div>

      <div>
        <Label>Font Size</Label>
        <SegmentControl
          value={settings.fontSize || 'normal'}
          onChange={v => updateSetting('fontSize', v)}
          options={[{ label: 'Small', value: 'small' }, { label: 'Normal', value: 'normal' }, { label: 'Large', value: 'large' }]}
        />
      </div>

      <div>
        <Label>Typography Scale</Label>
        <div className="space-y-2.5">
          {(() => {
            const base = settings.fontSizeBase || 11;
            const nameDelta = settings.fontSizeNameDelta ?? 8;
            const sectionDelta = settings.fontSizeSectionDelta ?? 1;
            const entryDelta = settings.fontSizeEntryDelta ?? 0;
            return (
              <>
                <SizeRow label="Base" value={base} onChange={v => updateSetting('fontSizeBase', v)} min={8} max={16} />
                <SizeRow label="Full Name" value={base + nameDelta} onChange={v => updateSetting('fontSizeNameDelta', v - base)} min={base} max={36} />
                <SizeRow label="Section Title" value={base + sectionDelta} onChange={v => updateSetting('fontSizeSectionDelta', v - base)} min={6} max={24} />
                <SizeRow label="Entry Header" value={base + entryDelta} onChange={v => updateSetting('fontSizeEntryDelta', v - base)} min={6} max={24} />
                <SizeRow label="Contact Icons" value={settings.iconSize ?? 11} onChange={v => updateSetting('iconSize', v)} min={8} max={20} />
              </>
            );
          })()}
        </div>
      </div>
    </DesignSection>
  );
}
