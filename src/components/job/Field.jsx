import { useState, useRef, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { isImeKey } from '@/components/ui/compose';

export function Field({ label, value, onChange, type = 'text', icon: Icon, placeholder, readOnly = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const ref = useRef(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  useEffect(() => { setDraft(value || ''); }, [value]);

  function commit() {
    setEditing(false);
    // Shown as '' when the job has no value: closing it untouched wrote '' — an edit of nothing.
    if (draft !== (value || '')) onChange(draft);
  }

  if (readOnly) {
    return (
      <div>
        <p className="text-[10px] font-bold text-ink-subtlest uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-center gap-2 px-3 py-2">
          {Icon && <Icon size={13} className="text-ink-subtlest shrink-0" />}
          <span className={`flex-1 text-sm ${value ? 'text-ink-subtle' : 'text-ink-subtlest italic'}`}>
            {value || '—'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[10px] font-bold text-ink-subtlest uppercase tracking-widest mb-1">{label}</p>
      {editing ? (
        <input
          ref={ref}
          aria-label={label}
          type={type}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter' && !isImeKey(e)) { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); }
          }}
          // 16 px on touch screens: iOS Safari zooms the page into any smaller field it focuses (J-38).
          className="w-full px-3 py-2 text-sm pointer-coarse:text-base border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand bg-white"
          placeholder={placeholder}
        />
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md group/field">
          {Icon && <Icon size={13} className="text-ink-subtlest shrink-0" />}
          <span className={`flex-1 text-sm ${value ? 'text-ink' : 'text-ink-subtlest italic'}`}>
            {value || placeholder || 'Not set'}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover/field:opacity-100 no-hover:opacity-100 p-1 text-ink-subtlest hover:text-brand hover:bg-brand-subtle rounded-lg transition-all"
            title="Edit"
          >
            <Pencil size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
