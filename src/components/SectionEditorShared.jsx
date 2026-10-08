import { useState, useId } from 'react';
import { Eye, EyeOff, Trash2, ChevronDown, ChevronUp, X, GripVertical, Copy } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FieldIdsContext, useFieldIds } from '@/hooks/useFieldIds';
import { parseMonthYear } from '@/utils/dates';

/**
 * A section's text box. 16 px on a touch screen, as every field of the section editor is: iOS zooms
 * the page into any smaller field it focuses (R4-DPH-28). A mouse keeps 14 px.
 */
export function InputField({ label, value, onChange, placeholder, type = 'text' }) {
  const { id } = useFieldIds(label);
  return (
    <div className="w-full">
      {label && <label htmlFor={id} className="block text-xs text-cv-muted mb-1">{label}</label>}
      <input
        id={id}
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2.5 py-1.5 text-sm pointer-coarse:text-base text-cv-ink bg-cv-surface border border-cv-field rounded-cv-control focus:outline-none focus:ring-2 focus:ring-cv-brand"
      />
    </div>
  );
}

export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * The year select's choices, newest first: fifteen years ahead of `now` down to 49 back, plus
 * `stored` in its place when it is a 4-digit year outside them. The PDF prints any year
 * parseMonthYear reads (1000–9999), so a 1975 start or an expiry ten years out must be offered
 * too, or the select has no option for it and shows blank (AUD-28). `now` is read at each render,
 * not once when the module loads, so a tab left open over New Year moves on. Fifteen ahead, not
 * five, so a certificate's expiry or an expected graduation can be picked (R2-116).
 */
export function yearOptions(stored, now = new Date().getFullYear()) {
  const years = Array.from({ length: 65 }, (_, i) => String(now + 15 - i));
  if (!/^\d{4}$/.test(stored) || years.includes(stored)) return years;
  return [...years, stored].sort((a, b) => b - a);
}

export function MonthPicker({ label, value, onChange, disabled }) {
  // The label names the month select; each select also says which half of the date it holds.
  const { id, label: name } = useFieldIds(label);
  // Every month and year the PDF reads (src/utils/dates.js) — an imported "05/2023", "2019-05" or
  // 2019 too, which showed empty (a number threw); else the picker's own "Jan 2024" or "Jan".
  const date = parseMonthYear(value);
  const parts = typeof value === 'string' ? value.split(' ') : [];
  const monthStr = date ? (date.m ? MONTHS[date.m - 1] : '') : (MONTHS.includes(parts[0]) ? parts[0] : '');
  const yearStr = date ? String(date.y) : (parts[1] || '');

  // Both halves as the selects now hold them: a blank 'Month' or 'Year' clears its half, so
  // 'Jan 2024' can become '2024' (R2-108) — putting the stored half back undid the choice.
  function update(m, y) {
    onChange([m, y].filter(Boolean).join(' '));
  }

  return (
    <div className={disabled ? 'opacity-40 pointer-events-none' : ''}>
      {label && <label htmlFor={id} className="block text-xs text-cv-muted mb-1">{label}</label>}
      {/* The selects may shrink below their widest option (min-w-0), so a narrow picker stays in its
          own cell instead of running under the one beside it (R4-DPH-27); 16 px on touch, as
          InputField is (R4-DPH-28). */}
      <div className="flex gap-1 items-center">
        <select
          id={id}
          aria-label={name ? `${name} month` : 'Month'}
          value={monthStr}
          onChange={e => update(e.target.value, yearStr)}
          className="flex-1 min-w-0 px-2 py-1.5 text-sm pointer-coarse:text-base text-cv-ink border border-cv-field rounded-cv-control focus:outline-none focus:ring-2 focus:ring-cv-brand bg-cv-surface"
        >
          <option value="">Month</option>
          {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          aria-label={name ? `${name} year` : 'Year'}
          value={yearStr}
          onChange={e => update(monthStr, e.target.value)}
          className="flex-1 min-w-0 px-2 py-1.5 text-sm pointer-coarse:text-base text-cv-ink border border-cv-field rounded-cv-control focus:outline-none focus:ring-2 focus:ring-cv-brand bg-cv-surface"
        >
          <option value="">Year</option>
          {yearOptions(yearStr).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {value && (
          <button onClick={() => onChange('')} className="p-1 text-cv-faint hover:text-cv-bad shrink-0">
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * An entry's date: the month picker, or, for a stored date the picker cannot hold — an imported
 * period ('Jan 2020 – Mar 2021', '2019 – 2021'), a season, 'Present' — a text box showing it as the
 * PDF prints it. The picker showed only its first month and year, or blanks, and any pick wrote
 * 'Jan 2021' over the whole of it (R4-ED-03, R4-LO-21). Once a text box, it stays one while the entry
 * is on screen, so it does not turn into the picker mid-typing (a period retyped passes through
 * '2019', which the picker reads). Disabled (an End Date while the entry is current), it is the
 * picker, greyed out as before.
 */
export function DateField({ label, value, onChange, disabled, placeholder = 'Jan 2020' }) {
  const [asText, setAsText] = useState(false);
  if (!asText && isPeriodText(value)) setAsText(true);
  return asText && !disabled
    ? <InputField label={label} value={value} onChange={onChange} placeholder={placeholder} />
    : <MonthPicker label={label} value={value} onChange={onChange} disabled={disabled} />;
}

/** A date the month picker cannot show and write back whole: text that is no month and year, nor a bare month. */
function isPeriodText(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  return !parseMonthYear(value) && !MONTHS.includes(value.trim());
}

export function FieldRow({ label, field, hiddenSet, onToggle, children }) {
  const isHidden = hiddenSet.has(field);
  const id = useId();
  const ids = { id, labelId: `${id}label`, label };
  return (
    <div className={isHidden ? 'opacity-50' : ''}>
      <div className="flex items-center justify-between mb-1">
        <label id={ids.labelId} htmlFor={id} className="text-xs text-cv-muted">{label}</label>
        <button
          onClick={() => onToggle(field)}
          className={`p-0.5 ${isHidden ? 'text-cv-faint hover:text-cv-muted' : 'text-cv-brand-text hover:text-cv-brand-pressed'}`}
          title={isHidden ? 'Show field on resume' : 'Hide field from resume'}
        >
          {isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
        </button>
      </div>
      <FieldIdsContext.Provider value={ids}>{children}</FieldIdsContext.Provider>
    </div>
  );
}

export function ItemCard({ label, onRemove, onDuplicate, onToggleVisibility, visible = true, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`border rounded-cv-control overflow-hidden ${visible ? 'border-cv-hairline' : 'border-cv-hairline opacity-60'}`}>
      <div
        data-testid="entry-header"
        className="flex items-center justify-between px-3 py-2 bg-cv-ground cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <span data-testid="entry-title" className={`text-sm font-medium truncate flex-1 ${visible ? 'text-cv-ink' : 'text-cv-faint line-through'}`}>{label || 'New Entry'}</span>
        <div className="flex items-center gap-1 shrink-0">
          {onToggleVisibility && (
            <button
              onClick={e => { e.stopPropagation(); onToggleVisibility(); }}
              className={`p-1 ${visible ? 'text-cv-brand-text hover:text-cv-brand-pressed' : 'text-cv-faint hover:text-cv-muted'}`}
              title={visible ? 'Hide entry' : 'Show entry'}
            >
              {visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
          )}
          {onDuplicate && (
            <button onClick={e => { e.stopPropagation(); onDuplicate(); }} title="Duplicate entry" aria-label="Duplicate entry" className="p-1 text-cv-faint hover:text-cv-brand-text">
              <Copy size={12} />
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); onRemove(); }} title="Delete entry" aria-label="Delete entry" className="p-1 text-cv-faint hover:text-cv-bad">
            <Trash2 size={12} />
          </button>
          {open ? <ChevronUp size={13} className="text-cv-faint" /> : <ChevronDown size={13} className="text-cv-faint" />}
        </div>
      </div>
      {/* A size container: the fields' two-column rows (@sm:grid-cols-2) go side by side only when
          the card is wide enough for two date pickers, not when the window is — in the 360 px editor
          panel and on a phone they stack (R4-DPH-27). */}
      {open && <div className="@container p-3 space-y-2.5">{children}</div>}
    </div>
  );
}

export function SortableItemWrapper({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex items-start gap-1 group/item"
    >
      {/* In the tab order, so Space and the arrow keys move the entry (the section's KeyboardSensor);
          shown while focused, as it is on hover (R2-115). */}
      <button
        {...attributes}
        {...listeners}
        aria-label="Reorder entry"
        title="Drag, or press Space then the arrow keys, to reorder"
        className="mt-2.5 cursor-grab active:cursor-grabbing text-cv-faint hover:text-cv-muted opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100 no-hover:opacity-100 transition-opacity shrink-0 touch-none"
      >
        <GripVertical size={13} />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
