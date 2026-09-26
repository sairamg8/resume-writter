import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { cx } from '@/components/ui';
import { TypePicker } from './IssueFields';

/**
 * "+ Create issue" at the foot of a column or a backlog section: a button that opens a small
 * composer — the type and "What needs to be done?"; Enter creates and keeps it open for the next
 * one, Escape (or leaving it empty) closes it. `onCreate({ title, type })`.
 */
export function InlineCreate({ onCreate, label = 'Create issue', className, variant = 'column' }) {
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
          'flex h-9 w-full items-center gap-1.5 rounded px-2 text-sm font-medium text-ink-subtle transition-colors hover:bg-neutral-fill-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60',
          className,
        )}
      >
        <Plus size={16} aria-hidden="true" /> {label}
      </button>
    );
  }

  return (
    <div
      className={cx('flex flex-col gap-2 rounded border-2 border-brand bg-white p-2', variant === 'row' && 'flex-row items-center', className)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget) && !text.trim()) setOpen(false); }}
    >
      <textarea
        ref={ref}
        rows={variant === 'row' ? 1 : 2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // While an input method (Chinese, Japanese, Korean) is composing, Enter picks the word
          // and Escape drops it: the keystroke is the IME's, not a create. Safari says so only with
          // keyCode 229 (isComposing is already false there), so both are checked.
          if (e.nativeEvent?.isComposing || e.keyCode === 229) return;
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); create(); }
          if (e.key === 'Escape') { e.stopPropagation(); setText(''); setOpen(false); }
        }}
        placeholder="What needs to be done?"
        aria-label="Summary of the new issue"
        className="min-w-0 flex-1 resize-none bg-transparent text-sm text-ink placeholder:text-ink-subtlest focus:outline-none"
      />
      <div className="flex items-center gap-2">
        <div className="w-32"><TypePicker value={type} onChange={setType} allowEpic={false} /></div>
        <button type="button" onClick={create} disabled={!text.trim()} className="ml-auto h-7 rounded bg-brand px-2.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50">
          Create
        </button>
      </div>
    </div>
  );
}
