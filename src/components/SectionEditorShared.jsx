import { useState } from 'react';
import { Eye, EyeOff, Trash2, ChevronDown, ChevronUp, X, GripVertical } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function InputField({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div className="w-full">
      {label && <label className="block text-xs text-gray-500 mb-1">{label}</label>}
      <input
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
export const CUR_YEAR = new Date().getFullYear();
export const YEARS = Array.from({ length: 55 }, (_, i) => CUR_YEAR + 5 - i);

export function MonthPicker({ label, value, onChange, disabled }) {
  const parts = (value || '').split(' ');
  const monthStr = MONTHS.includes(parts[0]) ? parts[0] : '';
  const yearStr = parts[1] || '';

  function update(m, y) {
    if (!m && !y) { onChange(''); return; }
    if (m && y) { onChange(`${m} ${y}`); return; }
    if (m) { onChange(yearStr ? `${m} ${yearStr}` : m); return; }
    onChange(monthStr ? `${monthStr} ${y}` : y);
  }

  return (
    <div className={disabled ? 'opacity-40 pointer-events-none' : ''}>
      {label && <label className="block text-xs text-gray-500 mb-1">{label}</label>}
      <div className="flex gap-1 items-center">
        <select
          value={monthStr}
          onChange={e => update(e.target.value, yearStr)}
          className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Month</option>
          {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select
          value={yearStr}
          onChange={e => update(monthStr, e.target.value)}
          className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Year</option>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
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
  return (
    <div className={isHidden ? 'opacity-50' : ''}>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-gray-500">{label}</label>
        <button
          onClick={() => onToggle(field)}
          className={`p-0.5 ${isHidden ? 'text-gray-300 hover:text-gray-400' : 'text-blue-500 hover:text-blue-600'}`}
          title={isHidden ? 'Show field on resume' : 'Hide field from resume'}
        >
          {isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
        </button>
      </div>
      {children}
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
          <button onClick={e => { e.stopPropagation(); onRemove(); }} className="p-1 text-gray-400 hover:text-red-500">
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
        className="mt-2.5 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0 touch-none"
        tabIndex={-1}
      >
        <GripVertical size={13} />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
