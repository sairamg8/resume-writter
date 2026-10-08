import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { cx, isImeKey } from '@/components/ui';
import { TypePicker } from './IssueFields';

/**
 * "+ Create issue" at the foot of a column or a backlog section: a button that opens a small
 * composer — the type and "What needs to be done?"; Enter creates and keeps it open for the next
 * one, Escape (or leaving it empty) closes it. `onCreate({ title, type })`. `showType={false}`
 * hides the type picker where the type is fixed (the Epic panel makes only epics); `placeholder`
 * is the field's prompt, for a composer that makes something else than an issue (R4-SW-B-04).
 */
export function InlineCreate({ onCreate, label = 'Create issue', className, variant = 'column', showType = true, placeholder = 'What needs to be done?' }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [type, setType] = useState('task');
  const ref = useRef(null);
  useEffect(() => { if (open) ref.current?.focus(); }, [open]);

  const create = () => {
    const title = text.trim();
    if (!title) return;
    onCreate({ title, type });
    setText('');
    ref.current?.focus();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cx(
          'flex h-9 w-full items-center gap-1.5 rounded-cv-control px-2 text-sm font-medium text-cv-muted transition-colors hover:bg-cv-stage hover:text-cv-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cv-brand/60',
          className,
        )}
      >
        <Plus size={16} aria-hidden="true" /> {label}
      </button>
    );
  }

  // The row variant (a backlog section) puts the field beside the type and Create from sm up only:
  // on a phone they left it about 100px, narrower than its own placeholder, so it stacks there.
  return (
    <div
      className={cx('flex flex-col gap-2 rounded-cv-control border-2 border-cv-brand bg-cv-surface p-2', variant === 'row' && 'sm:flex-row sm:items-center', className)}
      // Leaving the box with nothing typed puts the composer away. The type picker's menu is a
      // portal outside this box: focus going into it (open, or an arrow to the next type) is
      // still the composer, or choosing a type before typing a summary closed it.
      onBlur={(e) => {
        const to = e.relatedTarget;
        if (e.currentTarget.contains(to) || to?.closest?.('[data-menu-root]')) return;
        if (!text.trim()) setOpen(false);
      }}
    >
      <textarea
        ref={ref}
        rows={variant === 'row' ? 1 : 2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // While an input method (Chinese, Japanese, Korean) is composing, Enter picks the word
          // and Escape drops it: the keystroke is the IME's, not a create.
          if (isImeKey(e)) return;
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); create(); }
          if (e.key === 'Escape') { e.stopPropagation(); setText(''); setOpen(false); }
        }}
        placeholder={placeholder}
        aria-label="Summary of the new issue"
        // 16 px on touch screens: iOS Safari zooms the page into any smaller field it focuses (R4-DPH-11).
        className="min-w-0 flex-1 resize-none bg-transparent text-sm text-cv-ink placeholder:text-cv-faint focus:outline-none pointer-coarse:text-base"
      />
      <div className="flex items-center gap-2">
        {/* A press on the picker keeps the focus in the summary field: Safari and Firefox on a Mac give a
            pressed button no focus, so the field blurred with nothing to say where focus went, and an
            empty composer closed before the picker's click could open its menu. */}
        {showType && <div className="w-32" onMouseDown={(e) => e.preventDefault()}><TypePicker value={type} onChange={setType} allowEpic={false} /></div>}
        <button type="button" onClick={create} disabled={!text.trim()} className="ml-auto h-7 rounded-cv-control bg-cv-brand px-2.5 text-[13px] font-medium text-white transition-colors hover:bg-cv-brand-pressed disabled:opacity-50">
          Create
        </button>
      </div>
    </div>
  );
}
