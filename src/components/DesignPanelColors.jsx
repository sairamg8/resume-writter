import { Label, DesignSection } from '@/components/DesignPanelShared';

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

export function ColorsSection({ resume, settings, updateSetting, onReset }) {
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
          <label className="text-xs text-gray-500">Custom:</label>
          <input type="color" value={settings.accentColor || '#2563eb'} onChange={e => updateSetting('accentColor', e.target.value)} className="h-7 w-16 rounded border border-gray-200 cursor-pointer p-0.5" />
          <span className="text-xs text-gray-400 font-mono">{settings.accentColor || '#2563eb'}</span>
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
              className={`h-8 flex-1 rounded-md border-2 transition-all ${(settings.textColor || '#1a1a1a') === p.color ? 'border-blue-500 scale-105' : 'border-transparent hover:scale-105'}`}
              style={{ backgroundColor: p.color }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Custom:</label>
          <input type="color" value={settings.textColor || '#1a1a1a'} onChange={e => updateSetting('textColor', e.target.value)} className="h-7 w-16 rounded border border-gray-200 cursor-pointer p-0.5" />
          <span className="text-xs text-gray-400 font-mono">{settings.textColor || '#1a1a1a'}</span>
        </div>
      </div>

      {(resume.template === 'modern' || resume.template === 'sidebar') && (
        <div className="pt-1 border-t border-gray-100">
          <Label>Header Text Color</Label>
          <p className="text-[10px] text-gray-400 mb-2">
            {resume.template === 'sidebar' ? 'Color for name text in the sidebar header.' : 'Color for name & text in the colored header banner.'}
          </p>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Color:</label>
            <input type="color" value={settings.headerTextColor || '#ffffff'} onChange={e => updateSetting('headerTextColor', e.target.value)} className="h-7 w-16 rounded border border-gray-200 cursor-pointer p-0.5" />
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
              <input type="color" value={settings[key] || '#000000'} onChange={e => updateSetting(key, e.target.value)} className="h-6 w-10 rounded border border-gray-200 cursor-pointer p-0.5" title={label} />
              <span className="text-[11px] text-gray-400 font-mono w-16 truncate">{settings[key] || placeholder}</span>
              {settings[key] && (
                <button onClick={() => updateSetting(key, '')} className="text-[11px] text-gray-400 hover:text-gray-600" title="Reset to template default">↺</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {resume.template === 'sidebar' && (
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
            <label className="text-xs text-gray-500">Custom:</label>
            <input type="color" value={settings.sidebarBg || '#1e293b'} onChange={e => updateSetting('sidebarBg', e.target.value)} className="h-7 w-16 rounded border border-gray-200 cursor-pointer p-0.5" />
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
