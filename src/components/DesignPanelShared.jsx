import { useState, useId } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { useTypedNumber } from '@/hooks/useTypedNumber';

export function Label({ children }) {
  return <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{children}</p>;
}

// SizeRow and NumberRow write a typed value on Enter or on leaving the box, and only when it differs
// from the one shown; Escape writes nothing (useTypedNumber, R2-032). Clicking in and out used to
// store the shown value — Contact Icons with nothing stored became a stored 11, Line Height 1.15 a 1.1.
export function SizeRow({ label, value, onChange, min = 6, max = 40 }) {
  const labelId = useId();
  const current = Number.isFinite(value) ? value : min;
  const typed = useTypedNumber({
    shown: current + 'pt',
    editText: String(current),
    commit: (str) => {
      const n = parseInt(str, 10);
      if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
    },
  });

  return (
    <div className="flex items-center justify-between">
      <span id={labelId} className="text-xs text-gray-600 w-28">{label}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(Math.max(min, current - 1))} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 hover:bg-gray-100 text-base leading-none">−</button>
        <input
          type="text"
          aria-labelledby={labelId}
          {...typed.inputProps}
          className="w-14 text-center text-xs font-medium text-gray-700 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 h-6 cursor-text"
        />
        <button onClick={() => onChange(Math.min(max, current + 1))} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 hover:bg-gray-100 text-base leading-none">+</button>
      </div>
    </div>
  );
}

export function NumberRow({ label, value, onChange, min = 1, max = 200, step = 1, unit = '' }) {
  const labelId = useId();
  // A value that is not a number (text, true, {}) shows and steps as `min` instead of crashing the
  // editor on toFixed; normalizeResume drops one from saved data (VF2-3.2-NB1-NB1).
  const current = Number.isFinite(value) ? value : min;
  // A fractional step shows the value to two decimals (at least one): a preset's or a template's
  // 1.35 and 1.65 Line Height read 1.4 and 1.6 at one, over a page laid out at 1.35 / 1.65 (R2-083).
  const fraction = current.toFixed(2).replace(/(\.\d)0$/, '$1');
  const typed = useTypedNumber({
    shown: Number.isInteger(current / step) && step >= 1 ? current + unit : (step < 1 ? fraction : current.toFixed(0)) + unit,
    editText: String(current),
    commit: (str) => {
      const n = parseFloat(str);
      if (!isNaN(n)) onChange(Math.min(max, Math.max(min, Math.round(n / step) * step)));
    },
  });

  return (
    <div className="flex items-center justify-between">
      <span id={labelId} className="text-xs text-gray-600 w-28">{label}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(Math.max(min, Math.round((current - step) / step) * step))} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 hover:bg-gray-100 text-base leading-none">−</button>
        <input
          type="text"
          aria-labelledby={labelId}
          {...typed.inputProps}
          className="w-14 text-center text-xs font-medium text-gray-700 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 h-6 cursor-text"
        />
        <button onClick={() => onChange(Math.min(max, Math.round((current + step) / step) * step))} className="w-6 h-6 flex items-center justify-center border border-gray-200 rounded text-gray-600 hover:bg-gray-100 text-base leading-none">+</button>
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
