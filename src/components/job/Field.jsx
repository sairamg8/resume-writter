import { useState, useRef, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { isImeKey } from '@/components/ui/compose';
import { controlClass, cx } from '@/components/ui';

// A field's name as the kit's Field and the job form draw theirs, 12 px semibold: it was in 10 px
// bold capitals, which no other label had (R4-DVIS-09).
const LABEL = 'text-[12px] font-semibold leading-5 text-ink-subtle mb-1';
// The kit's box (controlClass) at the Overview's size, 36 px tall as the kit's Select and TextField,
// 44 on a touch screen, and free to shrink in its row: the selects and the deadline beside these
// fields use it too (OverviewTab), so an opened value is the same box as they are (R5-JOB-01).
export const BOX = 'h-9 pointer-coarse:h-11 min-w-0 flex-1 px-3';

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
        <p className={LABEL}>{label}</p>
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
      <p className={LABEL}>{label}</p>
      {editing ? (
        // In its row, after its icon, as the Overview's selects sit: it had its own indigo, 2 px ring
        // box and jumped left over the icon when the pencil opened it (R5-JOB-01).
        <div className="flex items-center gap-2 px-3">
          {Icon && <Icon size={13} className="text-ink-subtlest shrink-0" />}
          <input
            ref={ref}
            aria-label={label}
            type={type}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter' && !isImeKey(e)) { e.preventDefault(); commit(); }
              if (e.key === 'Escape' && !isImeKey(e)) { setDraft(value || ''); setEditing(false); }
            }}
            // controlClass keeps 16 px on touch screens: iOS Safari zooms into any smaller field (J-38).
            className={cx(controlClass(), BOX)}
            placeholder={placeholder}
          />
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md group/field">
          {Icon && <Icon size={13} className="text-ink-subtlest shrink-0" />}
          {/* min-w-0 and break-words: a long value (a posting's URL) wraps in its row on a phone (J-12). */}
          <span className={`min-w-0 flex-1 break-words text-sm ${value ? 'text-ink' : 'text-ink-subtlest italic'}`}>
            {value || placeholder || 'Not set'}
          </span>
          <button
            // From the value as it is: an edit the page refused (OverviewTab's blank name) left its draft behind.
            onClick={() => { setDraft(value || ''); setEditing(true); }}
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
