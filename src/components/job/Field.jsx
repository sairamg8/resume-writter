import { useState, useRef, useEffect } from 'react';
import { Pencil } from 'lucide-react';

export function Field({ label, value, onChange, type = 'text', icon: Icon, placeholder, readOnly = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const ref = useRef(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);
  useEffect(() => { setDraft(value || ''); }, [value]);

  function commit() {
    setEditing(false);
    if (draft !== value) onChange(draft);
  }

  if (readOnly) {
    return (
      <div>
        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest mb-1">{label}</p>
        <div className="flex items-center gap-2 px-3 py-2">
          {Icon && <Icon size={13} className="text-gray-300 shrink-0" />}
          <span className={`flex-1 text-sm ${value ? 'text-gray-500' : 'text-gray-300 italic'}`}>
            {value || '—'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      {editing ? (
        <input
          ref={ref}
          type={type}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); }
          }}
          className="w-full px-3 py-2 text-sm border border-indigo-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          placeholder={placeholder}
        />
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl group/field">
          {Icon && <Icon size={13} className="text-gray-400 shrink-0" />}
          <span className={`flex-1 text-sm ${value ? 'text-gray-800' : 'text-gray-300 italic'}`}>
            {value || placeholder || 'Not set'}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover/field:opacity-100 p-1 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
            title="Edit"
          >
            <Pencil size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
