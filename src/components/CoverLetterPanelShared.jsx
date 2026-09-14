// The Cover Letter panel's building blocks: a labelled input, an option chip and a collapsible
// block.
import { useState, useId } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/** A labelled text input; `children` (e.g. a "Today" button) sit inside the input's right end. */
export function Field({ label, value, onChange, placeholder, children }) {
  const id = useId();
  return (
    <div className="relative">
      <label htmlFor={id} className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        id={id}
        type="text"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${children ? 'pr-14' : ''}`}
      />
      {children}
    </div>
  );
}

export function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-1.5 text-xs font-medium rounded border transition-all ${
        active
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600'
      }`}
    >
      {children}
    </button>
  );
}

export function SectionBlock({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 text-left select-none"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-sm font-semibold text-gray-700 flex-1">{title}</span>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </button>
      {open && (
        <div className="p-4 border-t border-gray-100 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}
