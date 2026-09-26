import { useId } from 'react';
import { AlignLeft, AlignCenter, RotateCcw } from 'lucide-react';
import { resolveSection } from '@/templates/pdf/shared/templateSectionDefaults';
import { templateId, inSidebarColumn } from '@/constants/templates';
import { SECTION_OVERRIDE_PX, sectionOverridePx } from '@/constants/spacingNumbers';

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

export function SectionCustomizer({ section, template, updateSectionSettings, settings }) {
  // What the PDF prints with: the section's own settings over its template's defaults (Executive
  // and Sidebar lead with the role, …), so an unset control shows the template's choice (FIDA-58).
  // The résumé's own template in every Layout, as the PDF and Word resolve it: the Sidebar's
  // Single · ATS-safe prints Classic's page but keeps the Sidebar's section defaults (R2-012).
  const s = resolveSection(section, templateId(template)).settings;
  const isSkills = section.type === 'skills';
  // Sidebar prints skills, education, … in its narrow side column: one left-aligned column, so
  // alignment, grids and title layouts cannot apply there and are not offered (FIDB-75).
  // In Single · ATS-safe mode, all sections print in the main column.
  const sideColumn = inSidebarColumn(template, section.type, settings);
  const hasLocation = ['experience', 'education', 'volunteering'].includes(section.type);
  const hasDates = !['skills', 'languages', 'references', 'interests'].includes(section.type);
  const hasCols = !sideColumn && !['interests'].includes(section.type);
  const hasTitleStyle = !sideColumn && ['experience', 'education', 'volunteering', 'custom'].includes(section.type);
  const skillsStyle = s.skillsStyle || 'inline';
  const set = (k, v) => updateSectionSettings(section.id, k, v);
  const uid = useId();

  return (
    <div className="px-3 py-3 bg-slate-50 border-b border-slate-100 space-y-2.5">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Section Options</p>

      {sideColumn ? (
        <p className="text-[11px] text-slate-500 leading-snug">
          Sidebar prints this section in its side column, one left-aligned column: no alignment, grid or title layout to choose.
        </p>
      ) : (
        <SegmentRow
          label="Alignment"
          value={s.alignment || 'left'}
          onChange={v => set('alignment', v)}
          options={[
            { label: <span className="flex items-center gap-1"><AlignLeft size={11} />Left</span>, value: 'left' },
            { label: <span className="flex items-center gap-1"><AlignCenter size={11} />Center</span>, value: 'center' },
          ]}
        />
      )}

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
            value={skillsStyle}
            onChange={v => set('skillsStyle', v)}
            options={[{ label: 'Inline', value: 'inline' }, { label: 'Stacked', value: 'stacked' }, { label: 'Bullet', value: 'bullet' }, { label: 'Tags', value: 'tags' }]}
          />
          {/* Inline and Bullet both print "Category: skills" lines, with this separator. */}
          {(skillsStyle === 'inline' || skillsStyle === 'bullet') && (
            <SegmentRow
              label="Separator"
              value={s.separator || 'colon'}
              onChange={v => set('separator', v)}
              options={[{ label: 'Colon  :', value: 'colon' }, { label: 'Dash  –', value: 'dash' }, { label: 'Pipe  |', value: 'pipe' }]}
            />
          )}
        </>
      )}

      {/* A language's proficiency drawn beside its word, in the main column and the Sidebar's side
          column alike; the word always prints (R2-147). */}
      {section.type === 'languages' && (
        <SegmentRow
          label="Level"
          value={s.levelStyle || 'text'}
          onChange={v => set('levelStyle', v)}
          options={[{ label: 'Text', value: 'text' }, { label: 'Dots', value: 'dots' }, { label: 'Bar', value: 'bar' }]}
        />
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

      {/* Consecutive roles at one company under one employer header, in the PDF, Word and Markdown;
          the ATS text keeps every role with its company (src/utils/roleGroups.js, R2-147). */}
      {section.type === 'experience' && (
        <ToggleRow label="Group roles by company" value={s.groupRoles === true} onChange={v => set('groupRoles', v)} />
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
              <label htmlFor={uid + key} className="text-[10px] text-slate-400">{label}</label>
              <div className="flex items-center gap-0.5">
                <input
                  id={uid + key}
                  type="number"
                  min={SECTION_OVERRIDE_PX.min}
                  max={SECTION_OVERRIDE_PX.max}
                  title={title}
                  value={sectionOverridePx(s[key]) ?? ''}
                  placeholder="—"
                  onChange={e => {
                    // Empty: none (removed). Otherwise stored within the inputs' range, as it prints;
                    // a half-typed "-" is no number yet and changes nothing.
                    if (e.target.value === '') { set(key, undefined); return; }
                    const v = sectionOverridePx(e.target.value);
                    if (v !== undefined) set(key, v);
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
