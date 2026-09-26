import { useLayoutEffect, useRef, useState } from 'react';
import { cx, isImeKey } from './compose.js';

/** Box model shared by the text and the field, so switching between them never shifts a pixel. */
const BOX = '-mx-1.5 w-[calc(100%+0.75rem)] rounded-md border px-1.5 py-0.5';

/**
 * Text that turns into a field when clicked — an issue's title, a job's role, a column's name.
 *
 * - `value`, `onCommit(next)` — called only with a changed, non-blank value: a blank field
 *   reverts, so a title is never saved as ''. Single-line values are trimmed.
 * - Click, Enter or Space starts editing (all text selected). Enter commits; Escape reverts; leaving
 *   the field commits. `multiline`: a growing textarea where Enter commits and Shift+Enter breaks
 *   the line (⌘/Ctrl+Enter commits too).
 * - `label`: what is being edited ("Issue title") — the field's aria-label and the text's hint.
 * - `placeholder` shows (muted) when the value is empty; `className` sets the font for both states
 *   (e.g. 'text-xl font-semibold'); `inputClassName` the field only; `maxLength`; `disabled`
 *   shows plain text.
 * - After Enter or Escape focus returns to the text, so keyboard editing can go on.
 */
export function InlineEdit({
  value = '', onCommit, label, placeholder = 'Add a value…', multiline = false, maxLength, disabled = false,
  className, inputClassName,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const fieldRef = useRef(null);
  const textRef = useRef(null);
  const finished = useRef(false);
  const refocus = useRef(false);

  useLayoutEffect(() => {
    if (editing) {
      const field = fieldRef.current;
      field?.focus({ preventScroll: true });
      field?.select?.();
      fit(field);
    } else if (refocus.current) {
      refocus.current = false;
      textRef.current?.focus({ preventScroll: true });
    }
  }, [editing]);

  const start = () => {
    if (disabled) return;
    finished.current = false;
    setDraft(value ?? '');
    setEditing(true);
  };
  const finish = (save, { returnFocus = false } = {}) => {
    if (finished.current) return;
    finished.current = true;
    refocus.current = returnFocus;
    const next = multiline ? draft.replace(/\s+$/, '') : draft.trim();
    if (save && next.trim() && next !== value) onCommit?.(next);
    setEditing(false);
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finish(false, { returnFocus: true });
    } else if (event.key === 'Enter' && (!multiline || !event.shiftKey || event.metaKey || event.ctrlKey)) {
      // An input method's Enter picks a word, not the edit's end. isComposing alone missed Safari's,
      // which comes after compositionend flagged only by keyCode 229 (isImeKey checks both).
      if (isImeKey(event)) return;
      event.preventDefault();
      finish(true, { returnFocus: true });
    }
  };

  if (editing) {
    const shared = {
      ref: fieldRef,
      value: draft,
      maxLength,
      'aria-label': label,
      onBlur: () => finish(true),
      onKeyDown,
      className: cx(BOX, 'block border-brand bg-white text-slate-900 outline-none ring-2 ring-brand/25', className, inputClassName),
    };
    return multiline
      ? <textarea {...shared} rows={1} onChange={(e) => { setDraft(e.target.value); fit(e.target); }} className={cx(shared.className, 'resize-none overflow-hidden')} />
      : <input {...shared} type="text" onChange={(e) => setDraft(e.target.value)} />;
  }

  const empty = !String(value ?? '').trim();
  if (disabled) {
    return <span className={cx('block', empty && 'text-slate-400', multiline && 'whitespace-pre-wrap', className)}>{empty ? placeholder : value}</span>;
  }
  return (
    <button
      ref={textRef}
      type="button"
      onClick={start}
      className={cx(
        BOX, 'block cursor-text border-transparent text-left transition-colors duration-150',
        'hover:bg-slate-100 focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25',
        empty ? 'text-slate-400' : 'text-inherit', multiline && 'whitespace-pre-wrap', className,
      )}
    >
      {empty ? placeholder : value}
      {label && <span className="sr-only">{`, edit ${label}`}</span>}
    </button>
  );
}

/** Grows a textarea to its text (single-line fields are left alone). */
function fit(field) {
  if (!field || field.tagName !== 'TEXTAREA') return;
  field.style.height = 'auto';
  field.style.height = `${field.scrollHeight + 2}px`;
}
