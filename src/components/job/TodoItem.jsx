import { useState, useRef, useEffect } from 'react';
import { CheckSquare, Square, X } from 'lucide-react';

export function TodoItem({ todo, onToggle, onDelete, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.text);
  const ref = useRef(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  function commit() {
    setEditing(false);
    const t = draft.trim();
    if (t && t !== todo.text) onRename(t);
    else setDraft(todo.text);
  }

  return (
    <div className={`flex items-start gap-3 group px-4 py-3 rounded-md border transition-all ${
      todo.done ? 'bg-sunken/60 border-line' : 'bg-white border-line hover:border-indigo-100 hover:shadow-sm'
    }`}>
      <button
        onClick={onToggle}
        className={`mt-0.5 shrink-0 transition-colors ${todo.done ? 'text-brand' : 'text-ink-subtlest hover:text-indigo-400'}`}
      >
        {todo.done ? <CheckSquare size={18} /> : <Square size={18} />}
      </button>

      {editing ? (
        <input
          ref={ref}
          aria-label="Task"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') { setDraft(todo.text); setEditing(false); }
          }}
          // 16 px on touch screens: iOS Safari zooms the page into any smaller field it focuses (J-38).
          className="flex-1 text-sm pointer-coarse:text-base bg-transparent focus:outline-none border-b border-indigo-300 pb-0.5"
        />
      ) : (
        <span
          onDoubleClick={() => { setDraft(todo.text); setEditing(true); }}
          className={`flex-1 text-sm leading-relaxed cursor-default ${todo.done ? 'line-through text-ink-subtlest' : 'text-ink'}`}
        >
          {todo.text}
        </span>
      )}

      <button
        onClick={onDelete}
        className="shrink-0 p-1 text-gray-200 hover:text-red-400 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 no-hover:opacity-100 transition-all"
      >
        <X size={13} />
      </button>
    </div>
  );
}
