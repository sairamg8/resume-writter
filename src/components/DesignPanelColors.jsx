import { useId } from 'react';
import { ColorInput, Label, DesignSection } from '@/components/DesignPanelShared';
import { headerTemplateId, templateId } from '@/constants/templates';
import { letterheadLook } from '@/templates/pdf/shared/letterhead';
import { DEFAULTS, resolveTemplateSettings } from '@/templates/pdf/shared/templateSettings';
import { solid } from '@/templates/pdf/shared/pdfColors';

const ACCENT_PRESETS = [
  { label: 'Blue',    color: '#2563eb' },
  { label: 'Indigo',  color: '#4f46e5' },
  { label: 'Violet',  color: '#7c3aed' },
  { label: 'Rose',    color: '#e11d48' },
  { label: 'Orange',  color: '#ea580c' },
  { label: 'Teal',    color: '#0d9488' },
  { label: 'Slate',   color: '#475569' },
  { label: 'Black',   color: '#0f172a' },
];

const TEXT_COLOR_PRESETS = [
  { label: 'Near Black', color: '#1a1a1a' },
  { label: 'Dark Gray',  color: '#374151' },
  { label: 'Slate',      color: '#334155' },
  { label: 'Ink',        color: '#1e293b' },
];

const SIDEBAR_BG_PRESETS = [
  { label: 'Navy',     color: '#1e293b' },
  { label: 'Indigo',   color: '#1e1b4b' },
  { label: 'Dark',     color: '#111827' },
  { label: 'Ocean',    color: '#0f2744' },
  { label: 'Charcoal', color: '#292524' },
  { label: 'Forest',   color: '#14532d' },
  { label: 'Purple',   color: '#2e1065' },
  { label: 'Crimson',  color: '#450a0a' },
];

/**
 * `color` as a colour input holds it (#rrggbb): one it cannot hold ('#abc', a colour name) as the PDF
 * prints it, and one nobody can read as black, what the input shows for it anyway.
 */
function swatch(color) {
  const hex = solid(color);
  return /^#[0-9a-f]{6}$/i.test(hex || '') ? hex.toLowerCase() : '#000000';
}

export function ColorsSection({ resume, settings, updateSetting, onReset }) {
  const uid = useId();
  // The colours the PDF prints where none is picked: the template's own accent (Gridline's navy, not
  // a panel-wide blue), and the Name and Job title colours its header resolves (white on Modern's
  // banner). Each swatch holds the printed colour, so it says what the page shows — and a colour that
  // is not already the swatch's, black included, fires a change when picked (R4-DSN-05).
  const printed = resolveTemplateSettings(settings, templateId(resume.template));
  // The Text colour the PDF prints: the stored one, else the template's own default (Modern's
  // slate, Minimal's #111111 …), not a panel-wide Near Black the PDF does not use (R9-7).
  const textColor = settings.textColor || DEFAULTS[templateId(resume.template)].textColor;
  // The page the header prints on. Header Text Color colours a header printed on a band — Modern's
  // banner, Banner's full-bleed band (R3-001), the two-column Sidebar's column: letterheadLook's band.
  // The Sidebar's "Single · ATS-safe" prints Classic's white page, no column and no band, so there
  // Header Text Color and Sidebar Background have nothing to colour (R2-082).
  const header = headerTemplateId(resume.template, settings);
  // A band whose text takes Header Text Color: Modern's, the Sidebar's, Banner's — not Banded's pale one, in the page's inks.
  const band = letterheadLook(resume.template, settings).band;
  const onBand = Boolean(band) && !band.pageInks;
  return (
    <DesignSection title="Colors" onReset={onReset}>
      <div>
        <Label>Accent Color</Label>
        <div className="grid grid-cols-4 gap-2 mb-2">
          {ACCENT_PRESETS.map(p => (
            <button
              key={p.color}
              onClick={() => updateSetting('accentColor', p.color)}
              title={p.label}
              className={`h-8 rounded-md border-2 transition-all ${settings.accentColor === p.color ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'}`}
              style={{ backgroundColor: p.color }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={uid + 'accentColor'} className="text-xs text-gray-500">Custom:</label>
          <ColorInput id={uid + 'accentColor'} aria-label="Custom accent color" value={swatch(printed.accentColor)} onCommit={v => updateSetting('accentColor', v)} className="h-7 w-16 rounded border border-gray-200 cursor-pointer p-0.5" />
          <span className="text-xs text-gray-400 font-mono">{printed.accentColor}</span>
        </div>
      </div>

      <div>
        <Label>Text Color</Label>
        <div className="flex gap-2 mb-2">
          {TEXT_COLOR_PRESETS.map(p => (
            <button
              key={p.color}
              onClick={() => updateSetting('textColor', p.color)}
              title={p.label}
              className={`h-8 flex-1 rounded-md border-2 transition-all ${textColor === p.color ? 'border-blue-500 scale-105' : 'border-transparent hover:scale-105'}`}
              style={{ backgroundColor: p.color }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={uid + 'textColor'} className="text-xs text-gray-500">Custom:</label>
          <ColorInput id={uid + 'textColor'} aria-label="Custom text color" value={textColor} onCommit={v => updateSetting('textColor', v)} className="h-7 w-16 rounded border border-gray-200 cursor-pointer p-0.5" />
          <span className="text-xs text-gray-400 font-mono">{textColor}</span>
        </div>
      </div>

      {onBand && (
        <div className="pt-1 border-t border-gray-100">
          <Label>Header Text Color</Label>
          <p className="text-[10px] text-gray-400 mb-2">
            {header === 'sidebar' ? 'Color for name text in the sidebar header. One too faint on the Sidebar Background prints a readable tint of it.' : 'Color for name & text in the colored header banner. One too faint on the Accent Color prints a readable tint of it.'}
          </p>
          <div className="flex items-center gap-2">
            <label htmlFor={uid + 'headerTextColor'} className="text-xs text-gray-500">Color:</label>
            <ColorInput id={uid + 'headerTextColor'} aria-label="Header text color" value={settings.headerTextColor || '#ffffff'} onCommit={v => updateSetting('headerTextColor', v)} className="h-7 w-16 rounded border border-gray-200 cursor-pointer p-0.5" />
            <span className="text-xs text-gray-400 font-mono">{settings.headerTextColor || '#ffffff'}</span>
            {settings.headerTextColor && settings.headerTextColor !== '#ffffff' && (
              <button onClick={() => updateSetting('headerTextColor', '#ffffff')} className="text-[11px] text-gray-400 hover:text-gray-600" title="Reset to white">↺</button>
            )}
          </div>
        </div>
      )}

      <div className="pt-1 border-t border-gray-100 space-y-3">
        <Label>Name &amp; Title Colors</Label>
        {[
          { key: 'nameColor',     label: 'Name color',     placeholder: 'Template default' },
          { key: 'jobTitleColor', label: 'Job title color', placeholder: 'Template default' },
        ].map(({ key, label, placeholder }) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-xs text-gray-600">{label}</span>
            <div className="flex items-center gap-2">
              <ColorInput value={swatch(printed[key])} onCommit={v => updateSetting(key, v)} className="h-6 w-10 rounded border border-gray-200 cursor-pointer p-0.5" title={label} aria-label={label} />
              <span className="text-[11px] text-gray-400 font-mono w-16 truncate">{settings[key] || placeholder}</span>
              {settings[key] && (
                <button onClick={() => updateSetting(key, '')} className="text-[11px] text-gray-400 hover:text-gray-600" title="Reset to template default">↺</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {header === 'sidebar' && (
        <div className="pt-1 border-t border-gray-100">
          <Label>Sidebar Background</Label>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {SIDEBAR_BG_PRESETS.map(p => (
              <button
                key={p.color}
                onClick={() => updateSetting('sidebarBg', p.color)}
                title={p.label}
                className={`h-8 rounded-md border-2 transition-all ${(settings.sidebarBg || '#1e293b') === p.color ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: p.color }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor={uid + 'sidebarBg'} className="text-xs text-gray-500">Custom:</label>
            <ColorInput id={uid + 'sidebarBg'} aria-label="Custom sidebar background" value={settings.sidebarBg || '#1e293b'} onCommit={v => updateSetting('sidebarBg', v)} className="h-7 w-16 rounded border border-gray-200 cursor-pointer p-0.5" />
            <span className="text-xs text-gray-400 font-mono">{settings.sidebarBg || '#1e293b'}</span>
            {settings.sidebarBg && settings.sidebarBg !== '#1e293b' && (
              <button onClick={() => updateSetting('sidebarBg', '#1e293b')} className="text-[11px] text-gray-400 hover:text-gray-600">↺</button>
            )}
          </div>
        </div>
      )}
    </DesignSection>
  );
}
