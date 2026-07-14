import { AlignLeft, AlignCenter, RotateCcw } from 'lucide-react';

export function ToggleRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-600">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${value ? 'bg-blue-600' : 'bg-gray-200'}`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-1'}`} />
      </button>
    </div>
  );
}

export function SegmentRow({ label, options, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-gray-600 shrink-0">{label}</span>
      <div className="flex gap-1">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-2 py-1 text-[11px] rounded border transition-all ${
              value === opt.value
                ? 'bg-blue-600 border-blue-600 text-white font-medium'
                : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SectionCustomizer({ section, updateSectionSettings }) {
  const s = section.settings || {};
  const isSkills = section.type === 'skills';
  const hasLocation = ['experience', 'education', 'volunteering'].includes(section.type);
  const hasDates = !['skills', 'languages', 'references', 'interests'].includes(section.type);
  const hasCols = !['interests'].includes(section.type);
  const hasTitleStyle = ['experience', 'education', 'volunteering', 'custom'].includes(section.type);
  const set = (k, v) => updateSectionSettings(section.id, k, v);

  return (
    <div className="px-3 py-3 bg-slate-50 border-b border-slate-100 space-y-2.5">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Section Options</p>

      <SegmentRow
        label="Alignment"
        value={s.alignment || 'left'}
        onChange={v => set('alignment', v)}
        options={[
          { label: <span className="flex items-center gap-1"><AlignLeft size={11} />Left</span>, value: 'left' },
          { label: <span className="flex items-center gap-1"><AlignCenter size={11} />Center</span>, value: 'center' },
        ]}
      />

      <SegmentRow
        label={isSkills ? 'Rows' : 'Spacing'}
        value={s.spacing || 'normal'}
        onChange={v => set('spacing', v)}
        options={[{ label: 'Tight', value: 'compact' }, { label: 'Normal', value: 'normal' }, { label: 'Spacious', value: 'relaxed' }]}
      />

      {hasCols && (
        <SegmentRow
          label="Grids"
          value={s.columns || 1}
          onChange={v => set('columns', v)}
          options={isSkills
            ? [{ label: '1', value: 1 }, { label: '2', value: 2 }, { label: '3', value: 3 }, { label: '4', value: 4 }]
            : [{ label: '1', value: 1 }, { label: '2', value: 2 }]}
        />
      )}

      {isSkills && (
        <>
          <SegmentRow
            label="Style"
            value={s.skillsStyle || 'inline'}
            onChange={v => set('skillsStyle', v)}
            options={[{ label: 'Inline', value: 'inline' }, { label: 'Stacked', value: 'stacked' }, { label: 'Bullet', value: 'bullet' }, { label: 'Tags', value: 'tags' }]}
          />
          {(s.skillsStyle || 'inline') === 'inline' && (
            <SegmentRow
              label="Separator"
              value={s.separator || 'colon'}
              onChange={v => set('separator', v)}
              options={[{ label: 'Colon  :', value: 'colon' }, { label: 'Dash  –', value: 'dash' }]}
            />
          )}
        </>
      )}

      {section.type === 'experience' && (
        <SegmentRow
          label="Order"
          value={s.titleOrder || 'company'}
          onChange={v => set('titleOrder', v)}
          options={[{ label: 'Co. / Role', value: 'company' }, { label: 'Role / Co.', value: 'role' }]}
        />
      )}

      {hasTitleStyle && (
        <SegmentRow
          label="Title"
          value={s.titleStyle || 'stacked'}
          onChange={v => set('titleStyle', v)}
          options={[{ label: 'Stacked', value: 'stacked' }, { label: 'Inline', value: 'inline' }, { label: 'Side by side', value: 'sidebyside' }]}
        />
      )}

      {hasDates && (
        <ToggleRow label="Show dates" value={s.showDates !== false} onChange={v => set('showDates', v)} />
      )}

      {hasLocation && (
        <ToggleRow label="Show location" value={s.showLocation !== false} onChange={v => set('showLocation', v)} />
      )}

      <div className="pt-1 border-t border-slate-200 space-y-2">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Spacing Override</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Before', key: 'spaceBefore', title: 'Space before section (px)' },
            { label: 'After',  key: 'spaceAfter',  title: 'Space after section (px)' },
            { label: 'Item gap', key: 'itemGap', title: 'Gap between items (px)' },
          ].map(({ label, key, title }) => (
            <div key={key} className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-400">{label}</span>
              <div className="flex items-center gap-0.5">
                <input
                  type="number"
                  min={0}
                  max={80}
                  title={title}
                  value={s[key] ?? ''}
                  placeholder="—"
                  onChange={e => {
                    const v = e.target.value === '' ? undefined : Number(e.target.value);
                    set(key, v);
                  }}
                  className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 text-center outline-none focus:border-blue-400 bg-white"
                />
                {s[key] != null && (
                  <button title="Reset" onClick={() => set(key, undefined)} className="text-gray-300 hover:text-gray-500 shrink-0">
                    <RotateCcw size={10} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
