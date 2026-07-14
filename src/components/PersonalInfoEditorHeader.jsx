import { ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';

function LayoutPreview({ type }) {
  const bar = (w) => <div className="h-1 bg-gray-300 rounded-sm" style={{ width: w }} />;

  if (type === 'stack') return (
    <div className="flex flex-col gap-1 items-start w-full px-1">
      <div className="h-1.5 bg-gray-500 rounded-sm w-3/4" />
      <div className="h-1 bg-gray-300 rounded-sm w-1/2" />
      <div className="flex gap-1 mt-0.5">{bar('28%')}{bar('28%')}{bar('28%')}</div>
    </div>
  );

  if (type === 'inline') return (
    <div className="flex flex-col gap-1 items-start w-full px-1">
      <div className="flex gap-1 items-center">
        <div className="h-1.5 bg-gray-500 rounded-sm w-1/2" />
        <div className="h-px bg-gray-300 w-1" />
        <div className="h-1 bg-gray-300 rounded-sm w-1/3" />
      </div>
      <div className="flex gap-1 mt-0.5">{bar('28%')}{bar('28%')}{bar('28%')}</div>
    </div>
  );

  if (type === 'centered') return (
    <div className="flex flex-col gap-1 items-center w-full">
      <div className="h-1.5 bg-gray-500 rounded-sm w-3/5" />
      <div className="h-1 bg-gray-300 rounded-sm w-2/5" />
      <div className="flex gap-1 mt-0.5">{bar('22%')}{bar('22%')}{bar('22%')}</div>
    </div>
  );

  return null;
}

function PresetCard({ active, onClick, label, previewType }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-stretch gap-2 p-2 rounded-xl border-2 transition-all ${active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}
    >
      <div className={`h-10 rounded-lg flex items-center justify-center ${active ? 'bg-blue-100' : 'bg-gray-50'}`}>
        <LayoutPreview type={previewType} />
      </div>
      <p className={`text-[11px] font-medium text-center ${active ? 'text-blue-700' : 'text-gray-500'}`}>{label}</p>
    </button>
  );
}

export function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg border transition-all ${
        active
          ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
          : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 bg-white'
      }`}
    >
      {children}
    </button>
  );
}

export function HeaderCustomization({ s, set, isClassicOrMinimal, template, templateLabel, open, onToggle }) {
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-3 text-left">
        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Header Customization</p>
        {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
      </button>

      {open && (
        <div className="space-y-4 px-3 pb-3">
          {isClassicOrMinimal ? (
            <>
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Text Alignment</p>
                <div className="flex gap-2">
                  <PresetCard active={(s.headerAlign || 'left') === 'left'} onClick={() => set('headerAlign', 'left')} label="Left" previewType="stack" />
                  <PresetCard active={(s.headerAlign || 'left') === 'center'} onClick={() => set('headerAlign', 'center')} label="Center" previewType="centered" />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Name & Title Layout</p>
                <div className="flex gap-2">
                  <PresetCard active={(s.headerLayout || 'stack') === 'stack'} onClick={() => set('headerLayout', 'stack')} label="Stack" previewType="stack" />
                  <PresetCard active={(s.headerLayout || 'stack') === 'inline'} onClick={() => set('headerLayout', 'inline')} label="Inline" previewType="inline" />
                </div>
              </div>

              {(s.headerLayout || 'stack') === 'inline' && (
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-700">Name &amp; Title Spacing</p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => set('headerInlineGap', Math.max(2, (s.headerInlineGap ?? 8) - 2))} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 hover:bg-gray-100 text-base leading-none">−</button>
                      <span className="w-14 text-center text-xs font-medium text-gray-700 border border-gray-200 rounded h-6 flex items-center justify-center">{s.headerInlineGap ?? 8}px</span>
                      <button onClick={() => set('headerInlineGap', Math.min(48, (s.headerInlineGap ?? 8) + 2))} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 hover:bg-gray-100 text-base leading-none">+</button>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">Header Bottom Border</p>
                  <button
                    onClick={() => set('showHeaderBorder', s.showHeaderBorder === false ? true : false)}
                    className={`p-1 rounded transition-colors ${s.showHeaderBorder === false ? 'text-gray-300 hover:text-gray-400' : 'text-blue-500 hover:text-blue-600'}`}
                    title={s.showHeaderBorder === false ? 'Show border' : 'Hide border'}
                  >
                    {s.showHeaderBorder === false ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {s.showHeaderBorder !== false && (
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[11px] text-gray-400">Thickness</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => set('headerBorderWidth', Math.max(1, (s.headerBorderWidth || 2) - 1))} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 hover:bg-gray-100 text-base leading-none">−</button>
                      <input type="number" min={1} max={12} value={s.headerBorderWidth || 2} onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) set('headerBorderWidth', Math.min(12, Math.max(1, v))); }} className="w-14 text-center text-xs font-medium text-gray-700 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 h-6" />
                      <button onClick={() => set('headerBorderWidth', Math.min(12, (s.headerBorderWidth || 2) + 1))} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 hover:bg-gray-100 text-base leading-none">+</button>
                      <span className="text-[11px] text-gray-400 ml-1">px</span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Contact Details</p>
                <p className="text-[11px] text-gray-400 mb-1.5">Layout</p>
                <div className="flex gap-2 mb-3">
                  {[{ val: 'single', label: 'Single' }, { val: 'justify', label: 'Justify' }, { val: '2grid', label: '2 Grid' }].map(({ val, label }) => (
                    <Chip key={val} active={(s.contactLayout || 'justify') === val} onClick={() => set('contactLayout', val)}>{label}</Chip>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mb-1.5">Style</p>
                <div className="flex gap-2 mb-2">
                  {[{ val: 'icon', label: '⊕ Icon' }, { val: 'bullet', label: '• Bullet' }, { val: 'bar', label: '| Bar' }].map(({ val, label }) => (
                    <Chip key={val} active={(s.contactStyle || 'icon') === val} onClick={() => set('contactStyle', val)}>{label}</Chip>
                  ))}
                </div>
                {(s.contactStyle === 'icon' || s.contactStyle === undefined) && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">Icon size</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => set('iconSize', Math.max(8, (s.iconSize ?? 11) - 1))} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 hover:bg-gray-100 text-base leading-none">−</button>
                      <span className="w-10 text-center text-xs font-medium text-gray-700 border border-gray-200 rounded h-6 flex items-center justify-center">{s.iconSize ?? 11}px</span>
                      <button onClick={() => set('iconSize', Math.min(20, (s.iconSize ?? 11) + 1))} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 hover:bg-gray-100 text-base leading-none">+</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : template === 'sidebar' ? (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-slate-700">Sidebar template layout</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">The Sidebar template uses a fixed two-column layout — a dark left panel for contact/skills and the main area for experience. Header alignment and contact style don't apply here.</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">To change sidebar background, name color, or text colors, open the <strong>Design</strong> tab → <strong>Colors</strong>.</p>
            </div>
          ) : (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-slate-700">{templateLabel} template header</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">The {templateLabel} template uses a fixed banner header — alignment, border, and contact layout controls apply to <strong>Classic</strong> and <strong>Minimal</strong> templates only.</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">To change header text color, name color, or job title color, open the <strong>Design</strong> tab → <strong>Colors</strong>.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
