import { useState, useRef, useEffect } from 'react';
import { CheckSquare, Square, X } from 'lucide-react';
import { isImeKey } from '@/components/ui/compose';

/** A touch screen: nothing hovers, and a double tap is not a double click there (iOS Safari sends none to a plain span). */
const touchOnly = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(hover: none)').matches;

export function TodoItem({ todo, onToggle, onDelete, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.text);
  const ref = useRef(null);
  // The text the box opened with: a draft still equal to it is no edit, so clicking away from an
  // untouched box does not put it back over another tab's or a sync's newer rename
  // (R5-HUNT9-TASK-EDIT-STALE-WRITEBACK; as job/Field.jsx, R5-JOB-07).
  const opened = useRef(todo.text);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  function startEdit() {
    opened.current = todo.text;
    setDraft(todo.text);
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    const t = draft.trim();
    if (t && t !== opened.current.trim() && t !== todo.text) onRename(t);
    else setDraft(todo.text);
  }

  return (
    <div className={`flex items-start gap-3 group px-4 py-3 rounded-cv-control border transition-all ${
      todo.done ? 'bg-sunken/60 border-cv-hairline' : 'bg-cv-surface border-cv-hairline hover:border-cv-brand-soft-border hover:shadow-sm'
    }`}>
      <button
        onClick={onToggle}
        className={`mt-0.5 shrink-0 transition-colors ${todo.done ? 'text-brand' : 'text-ink-subtlest hover:text-cv-brand-text'}`}
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
            if (e.key === 'Enter' && !isImeKey(e)) commit();
            if (e.key === 'Escape' && !isImeKey(e)) { setDraft(todo.text); setEditing(false); }
          }}
          // 16 px on touch screens: iOS Safari zooms the page into any smaller field it focuses (J-38).
          className="flex-1 text-sm pointer-coarse:text-base bg-transparent focus:outline-none border-b border-cv-brand-soft-border pb-0.5"
        />
      ) : (
        <span
          // A double click on a mouse; one tap on a touch screen, where a double tap never reaches the text.
          onClick={() => { if (touchOnly()) startEdit(); }}
          onDoubleClick={startEdit}
          // A URL or a long word wraps inside the row: unbroken, it widened the text past a phone's
          // screen and took the delete X with it, out of reach (R4-DPH-03; as job/Field.jsx, J-12).
          className={`min-w-0 flex-1 break-words text-sm leading-relaxed cursor-default ${todo.done ? 'line-through text-ink-subtlest' : 'text-ink'}`}
        >
          {todo.text}
        </span>
      )}

      <button
        onClick={onDelete}
        className="shrink-0 p-1 text-cv-faint hover:text-cv-bad hover:bg-cv-bad-soft rounded-cv-control opacity-0 group-hover:opacity-100 no-hover:opacity-100 transition-all"
      >
        <X size={13} />
      </button>
    </div>
  );
}
