import { useState } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';

export function Label({ children }) {
  return <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{children}</p>;
}

export function SizeRow({ label, value, onChange, min = 6, max = 40 }) {
  const [raw, setRaw] = useState('');
  const [editing, setEditing] = useState(false);

  function commit(str) {
    const n = parseInt(str, 10);
    if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
    setEditing(false);
  }

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-600 w-28">{label}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(Math.max(min, value - 1))} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 hover:bg-gray-100 text-base leading-none">−</button>
        <input
          type="text"
          value={editing ? raw : value + 'pt'}
          onFocus={() => { setEditing(true); setRaw(String(value)); }}
          onChange={e => setRaw(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { commit(raw); e.target.blur(); }
            if (e.key === 'Escape') { setEditing(false); e.target.blur(); }
          }}
          className="w-14 text-center text-xs font-medium text-gray-700 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 h-6 cursor-text"
        />
        <button onClick={() => onChange(Math.min(max, value + 1))} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 hover:bg-gray-100 text-base leading-none">+</button>
      </div>
    </div>
  );
}

export function NumberRow({ label, value, onChange, min = 1, max = 200, step = 1, unit = '' }) {
  const [raw, setRaw] = useState('');
  const [editing, setEditing] = useState(false);

  function commit(str) {
    const n = parseFloat(str);
    if (!isNaN(n)) onChange(Math.min(max, Math.max(min, Math.round(n / step) * step)));
    setEditing(false);
  }

  const display = editing ? raw : (Number.isInteger(value / step) && step >= 1 ? value + unit : value.toFixed(step < 1 ? 1 : 0) + unit);

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-600 w-28">{label}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(Math.max(min, Math.round((value - step) / step) * step))} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 hover:bg-gray-100 text-base leading-none">−</button>
        <input
          type="text"
          value={display}
          onFocus={() => { setEditing(true); setRaw(String(value)); }}
          onChange={e => setRaw(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { commit(raw); e.target.blur(); }
            if (e.key === 'Escape') { setEditing(false); e.target.blur(); }
          }}
          className="w-14 text-center text-xs font-medium text-gray-700 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 h-6 cursor-text"
        />
        <button onClick={() => onChange(Math.min(max, Math.round((value + step) / step) * step))} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 hover:bg-gray-100 text-base leading-none">+</button>
      </div>
    </div>
  );
}

export function SegmentControl({ options, value, onChange }) {
  return (
    <div className="flex gap-1">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-1.5 text-xs font-medium rounded border transition-all ${
            value === opt.value
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function DesignSection({ title, defaultOpen = false, onReset, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex-1 flex items-center justify-between pl-4 pr-2 py-3 hover:bg-gray-50 transition-colors text-left"
        >
          <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">{title}</span>
          <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''} ml-2`} />
        </button>
        {onReset && (
          <button
            onClick={e => { e.stopPropagation(); onReset(); }}
            className="px-3 py-3 text-gray-300 hover:text-indigo-500 transition-colors shrink-0"
            title={`Reset ${title} to defaults`}
          >
            <RotateCcw size={11} />
          </button>
        )}
      </div>
      {open && <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-4">{children}</div>}
    </div>
  );
}
