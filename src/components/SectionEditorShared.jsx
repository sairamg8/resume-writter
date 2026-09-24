import { useState, useId } from 'react';
import { Eye, EyeOff, Trash2, ChevronDown, ChevronUp, X, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FieldIdsContext, useFieldIds } from '@/hooks/useFieldIds';
import { parseMonthYear } from '@/utils/dates';

export function InputField({ label, value, onChange, placeholder, type = 'text' }) {
  const { id } = useFieldIds(label);
  return (
    <div className="w-full">
      {label && <label htmlFor={id} className="block text-xs text-gray-500 mb-1">{label}</label>}
      <input
        id={id}
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * The year select's choices, newest first: five years ahead of `now` down to 49 back, plus
 * `stored` in its place when it is a 4-digit year outside them. The PDF prints any year
 * parseMonthYear reads (1000–9999), so a 1975 start or an expiry ten years out must be offered
 * too, or the select has no option for it and shows blank (AUD-28). `now` is read at each render,
 * not once when the module loads, so a tab left open over New Year moves on.
 */
export function yearOptions(stored, now = new Date().getFullYear()) {
  const years = Array.from({ length: 55 }, (_, i) => String(now + 5 - i));
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
      {label && <label htmlFor={id} className="block text-xs text-gray-500 mb-1">{label}</label>}
      <div className="flex gap-1 items-center">
        <select
          id={id}
          aria-label={name ? `${name} month` : 'Month'}
          value={monthStr}
          onChange={e => update(e.target.value, yearStr)}
          className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Month</option>
          {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          aria-label={name ? `${name} year` : 'Year'}
          value={yearStr}
          onChange={e => update(monthStr, e.target.value)}
          className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Year</option>
          {yearOptions(yearStr).map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {value && (
          <button onClick={() => onChange('')} className="p-1 text-gray-400 hover:text-red-500 shrink-0">
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

export function FieldRow({ label, field, hiddenSet, onToggle, children }) {
  const isHidden = hiddenSet.has(field);
  const id = useId();
  const ids = { id, labelId: `${id}label`, label };
  return (
    <div className={isHidden ? 'opacity-50' : ''}>
      <div className="flex items-center justify-between mb-1">
        <label id={ids.labelId} htmlFor={id} className="text-xs text-gray-500">{label}</label>
        <button
          onClick={() => onToggle(field)}
          className={`p-0.5 ${isHidden ? 'text-gray-300 hover:text-gray-400' : 'text-blue-500 hover:text-blue-600'}`}
          title={isHidden ? 'Show field on resume' : 'Hide field from resume'}
        >
          {isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
        </button>
      </div>
      <FieldIdsContext.Provider value={ids}>{children}</FieldIdsContext.Provider>
    </div>
  );
}

export function ItemCard({ label, onRemove, onToggleVisibility, visible = true, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`border rounded-lg overflow-hidden ${visible ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
      <div
        className="flex items-center justify-between px-3 py-2 bg-gray-50 cursor-pointer select-none"
        onClick={() => setOpen(o => !o)}
      >
        <span className={`text-sm font-medium truncate flex-1 ${visible ? 'text-gray-700' : 'text-gray-400 line-through'}`}>{label || 'New Entry'}</span>
        <div className="flex items-center gap-1 shrink-0">
          {onToggleVisibility && (
            <button
              onClick={e => { e.stopPropagation(); onToggleVisibility(); }}
              className={`p-1 ${visible ? 'text-blue-500 hover:text-blue-700' : 'text-gray-400 hover:text-gray-500'}`}
              title={visible ? 'Hide entry' : 'Show entry'}
            >
              {visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); onRemove(); }} title="Delete entry" aria-label="Delete entry" className="p-1 text-gray-400 hover:text-red-500">
            <Trash2 size={12} />
          </button>
          {open ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
        </div>
      </div>
      {open && <div className="p-3 space-y-2.5">{children}</div>}
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
      <button
        {...attributes}
        {...listeners}
        className="mt-2.5 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 opacity-0 group-hover/item:opacity-100 no-hover:opacity-100 transition-opacity shrink-0 touch-none"
        tabIndex={-1}
      >
        <GripVertical size={13} />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
