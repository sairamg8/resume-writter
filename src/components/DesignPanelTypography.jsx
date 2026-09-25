import { useState, useEffect, useId } from 'react';
import { FONTS, loadPreviewFont, loadCustomFonts, saveCustomFont, removeCustomFont, checkFont } from '@/utils/fonts';
import { Label, SizeRow, SegmentControl, DesignSection } from '@/components/DesignPanelShared';
import { FONT_SIZE_BASE, ICON_SIZE, SECTION_LETTER_SPACING, TYPE_SIZE_PT, deltaInRange } from '@/constants/designNumbers';
import { titleTrackingPct } from '@/templates/pdf/shared/sectionHeadingLook';
import { headerTemplateId } from '@/constants/templates';

// The quick size buttons set the base size (pt) the PDF is laid out with.
const SIZE_PRESETS = { small: 10, normal: 11, large: 12 };

/**
 * Name Font or Heading Font (R2-146): the name, or every section title, in a font of its own —
 * a picker font or one of the custom fonts added here. "Same as text" ('') prints it in Font
 * Family's, as before.
 */
function OwnFontRow({ label, value, customFonts, onChange }) {
  const id = useId();
  const custom = [...new Set([...customFonts, ...(value && !FONTS.some((f) => f.id === value) ? [value] : [])])];
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-xs text-gray-600">{label}</label>
      <select
        id={id}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="min-w-0 max-w-[60%] px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <option value="">Same as text</option>
        {FONTS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        {custom.map(name => <option key={name} value={name}>{name}</option>)}
      </select>
    </div>
  );
}

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

  // A new base keeps each stored size delta printing within its row's range (TYPE_SIZE_PT): Section
  // Title 6 pt on base 16 is a delta of -10, which on base 8 would print -2 pt.
  function setBase(next) {
    updateSetting('fontSizeBase', next);
    for (const key of Object.keys(TYPE_SIZE_PT)) {
      if (typeof settings[key] !== 'number') continue;
      const kept = deltaInRange(key, settings[key], next);
      if (kept !== settings[key]) updateSetting(key, kept);
    }
  }

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
                      onClick={() => {
                        removeCustomFont(name);
                        setSavedCustomFonts(loadCustomFonts());
                        // A removed font leaves every place it was chosen: Font Family, Name Font, Heading Font.
                        for (const key of ['customFont', 'nameFont', 'headingFont']) if (settings[key] === name) updateSetting(key, '');
                      }}
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

      <div className="space-y-2">
        <OwnFontRow label="Name Font" value={settings.nameFont} customFonts={savedCustomFonts} onChange={v => updateSetting('nameFont', v)} />
        <OwnFontRow label="Heading Font" value={settings.headingFont} customFonts={savedCustomFonts} onChange={v => updateSetting('headingFont', v)} />
      </div>

      <div>
        <Label>Font Size</Label>
        <SegmentControl
          value={sizePreset}
          onChange={v => setBase(SIZE_PRESETS[v])}
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
                <SizeRow label="Base" value={base} onChange={setBase} min={FONT_SIZE_BASE.min} max={FONT_SIZE_BASE.max} />
                <SizeRow label="Full Name" value={base + nameDelta} onChange={v => updateSetting('fontSizeNameDelta', v - base)} {...TYPE_SIZE_PT.fontSizeNameDelta(base)} />
                <SizeRow label="Section Title" value={base + sectionDelta} onChange={v => updateSetting('fontSizeSectionDelta', v - base)} {...TYPE_SIZE_PT.fontSizeSectionDelta(base)} />
                {/* The titles' letter-spacing, % of their size; unset shows what the PDF prints (R2-146). */}
                <SizeRow label="Title Spacing" value={titleTrackingPct(base + sectionDelta, settings.sectionLetterSpacing)} onChange={v => updateSetting('sectionLetterSpacing', v)} {...SECTION_LETTER_SPACING} unit="%" />
                <SizeRow label="Entry Header" value={base + entryDelta} onChange={v => updateSetting('fontSizeEntryDelta', v - base)} {...TYPE_SIZE_PT.fontSizeEntryDelta(base)} />
                {/* The header's job title under the name; unset, it follows Entry Header (R2-146). */}
                <SizeRow label="Job Title" value={base + (settings.fontSizeTitleDelta ?? entryDelta)} onChange={v => updateSetting('fontSizeTitleDelta', v - base)} {...TYPE_SIZE_PT.fontSizeTitleDelta(base)} />
                {/* Stored in px, as Contact icons and Header Customization show it — not pt (R2-123). */}
                <SizeRow label="Contact Icons" value={settings.iconSize ?? 11} onChange={v => updateSetting('iconSize', v)} min={ICON_SIZE.min} max={ICON_SIZE.max} unit="px" />
              </>
            );
          })()}
        </div>
        {/* Sidebar's side column prints its own small type, whatever these say (V2W2b-3). Its
            Single · ATS-safe Layout prints no side column: Classic's page, every size from here (R2-082). */}
        {headerTemplateId(template, settings) === 'sidebar' && (
          <p className="mt-2 text-[11px] text-gray-400 leading-relaxed">
            Base and Section Title size the main column; the side column&apos;s sections keep their own small type (8.5 pt headings, 9 pt text), spaced by Title Spacing.
          </p>
        )}
      </div>
    </DesignSection>
  );
}
