// The Cover Letter panel's building blocks: a labelled input, an option chip and a collapsible
// block.
import { useState, useId } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * A labelled text input; `children` (e.g. a "Today" button) sit inside the input's right end. 16 px on
 * a touch screen, as the letter body beside it is: iOS zooms the page into any smaller field it focuses.
 */
export function Field({ label, value, onChange, placeholder, children }) {
  const id = useId();
  return (
    <div className="relative">
      <label htmlFor={id} className="block text-xs font-medium text-cv-muted mb-1">{label}</label>
      <input
        id={id}
        type="text"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-2.5 py-1.5 text-sm pointer-coarse:text-base border border-cv-hairline rounded-cv-control focus:outline-none focus:ring-2 focus:ring-cv-brand ${children ? 'pr-14' : ''}`}
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
          ? 'bg-cv-brand border-cv-brand text-white'
          : 'border-cv-hairline text-cv-muted hover:border-cv-brand-soft-border hover:text-cv-brand-text'
      }`}
    >
      {children}
    </button>
  );
}

export function SectionBlock({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-cv-surface border border-cv-hairline rounded-cv-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 bg-cv-ground text-left select-none"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-sm font-semibold text-cv-ink flex-1">{title}</span>
        {open ? <ChevronUp size={14} className="text-cv-faint" /> : <ChevronDown size={14} className="text-cv-faint" />}
      </button>
      {open && (
        <div className="p-4 border-t border-cv-hairline space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}
