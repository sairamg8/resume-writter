import { useState, useEffect } from 'react';
import { FONTS, loadPreviewFont, loadCustomFonts, saveCustomFont, removeCustomFont, checkFont } from '@/utils/fonts';
import { Label, SizeRow, SegmentControl, DesignSection } from '@/components/DesignPanelShared';

// The quick size buttons set the base size (pt) the PDF is laid out with.
const SIZE_PRESETS = { small: 10, normal: 11, large: 12 };

/** Design → Typography. `template`: the one the PDF prints (Sidebar's side column keeps its own sizes). */
export function TypographySection({ settings, template, updateSetting, onReset }) {
  const [customFontInput, setCustomFontInput] = useState('');
  const [savedCustomFonts, setSavedCustomFonts] = useState(() => loadCustomFonts());
  const [checking, setChecking] = useState(false);
  const [fontError, setFontError] = useState(null);

  // Show every choice in its own face — from the same files the PDF embeds.
  useEffect(() => {
    FONTS.forEach((font) => loadPreviewFont(font.name, font.pkg));
    savedCustomFonts.forEach((name) => loadPreviewFont(name));
  }, [savedCustomFonts]);

  function chooseCustomFont(name) {
    updateSetting('customFont', name);
    updateSetting('font', '');
  }

  // A custom font is kept only if the PDF can load it; the name is stored as Google spells it.
  async function applyCustomFont(input) {
    setChecking(true);
    setFontError(null);
    const result = await checkFont(input);
    setChecking(false);
    if (!result.ok) {
      setFontError(`“${input}” was not found on Google Fonts. Check the spelling (e.g. “Playfair Display”).`);
      return;
    }
    loadPreviewFont(result.family, result.pkg);
    chooseCustomFont(result.family);
    saveCustomFont(result.family);
    setSavedCustomFonts(loadCustomFonts());
    setCustomFontInput('');
  }

  const base = settings.fontSizeBase ?? 11;
  // No font set (older or imported résumés) prints in Noto Sans, so that is what is selected.
  const activeFont = settings.customFont ? null : (FONTS.some((f) => f.id === settings.font) ? settings.font : 'notosans');
  const sizePreset = Object.keys(SIZE_PRESETS).find((k) => SIZE_PRESETS[k] === base) || '';

  return (
    <DesignSection title="Typography" onReset={onReset}>
      <div>
        <Label>Font Family</Label>
        <div className="grid grid-cols-3 gap-1 mb-2">
          {FONTS.map(font => (
            <button
              key={font.id}
              onClick={() => { updateSetting('font', font.id); updateSetting('customFont', ''); setCustomFontInput(''); setFontError(null); }}
              style={{ fontFamily: font.family }}
              title={font.title}
              className={`px-1.5 py-1.5 text-xs rounded-md border transition-all text-left truncate ${
                activeFont === font.id
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
                    <button style={{ fontFamily: `'${name}', sans-serif` }} onClick={() => chooseCustomFont(name)} className="leading-none">{name}</button>
                    <button
                      onClick={() => { removeCustomFont(name); setSavedCustomFonts(loadCustomFonts()); if (settings.customFont === name) updateSetting('customFont', ''); }}
                      className="text-gray-300 hover:text-red-400 leading-none ml-0.5"
                      title="Remove font"
                      aria-label={`Remove ${name}`}
                    >×</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <label htmlFor="custom-font-input" className="block text-[11px] text-gray-400 mb-1">Add a Google Font:</label>
        <div className="flex gap-1.5">
          <input
            id="custom-font-input"
            type="text"
            value={customFontInput}
            onChange={e => { setCustomFontInput(e.target.value); setFontError(null); }}
            onKeyDown={e => { if (e.key === 'Enter' && customFontInput.trim() && !checking) applyCustomFont(customFontInput.trim()); }}
            placeholder="e.g. Nunito, Raleway, Poppins"
            aria-invalid={fontError ? 'true' : undefined}
            aria-describedby={fontError ? 'custom-font-error' : undefined}
            className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => { if (customFontInput.trim()) applyCustomFont(customFontInput.trim()); }}
            disabled={checking}
            className="px-2.5 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
          >
            {checking ? 'Checking…' : 'Add'}
          </button>
        </div>
        {fontError && <p id="custom-font-error" role="alert" className="mt-1 text-[11px] text-red-600">{fontError}</p>}
      </div>

      <div>
        <Label>Font Size</Label>
        <SegmentControl
          value={sizePreset}
          onChange={v => updateSetting('fontSizeBase', SIZE_PRESETS[v])}
          options={[{ label: 'Small', value: 'small' }, { label: 'Normal', value: 'normal' }, { label: 'Large', value: 'large' }]}
        />
      </div>

      <div>
        <Label>Typography Scale</Label>
        <div className="space-y-2.5">
          {(() => {
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
        {/* Sidebar's side column prints its own small type, whatever these say (V2W2b-3). */}
        {template === 'sidebar' && (
          <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">
            Base and Section Title size the main column; the side column&apos;s sections keep their own small type (8.5 pt headings, 9 pt text).
          </p>
        )}
      </div>
    </DesignSection>
  );
}
