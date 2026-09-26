import { useRef } from 'react';
import { CalendarDays } from 'lucide-react';
import { datePillInfo } from '../../utils/uiFormat.js';
import { TONE_CLASSES } from './Badge.jsx';
import { FOCUS_RING } from './Button.jsx';
import { cx } from './compose.js';

/** The pill's words: "Due today", "Due Sep 24"; an overdue day says so on its own ("3d overdue"). */
function pillText(info, prefix) {
  if (!prefix || info.label.endsWith('overdue')) return info.label;
  if (/^(Today|Tomorrow|Yesterday)$/.test(info.label)) return `${prefix} ${info.label.toLowerCase()}`;
  return `${prefix} ${info.label}`;
}

/**
 * A due day as a small pill: "Today", "Tomorrow", "Yesterday", "3d overdue", "Sep 24" — red once
 * the day is over, amber within its last 3 days (uiFormat.datePillInfo, dates.js deadlineState).
 * The full day and its state are in the title and the accessible name, not only in the colour.
 *
 * - `value`: 'YYYY-MM-DD' (a blank or unreadable value shows nothing, or `emptyLabel` when editable).
 * - `kind`: 'due' (default: can be late) | 'plain' (a fact — applied on); `done`: a finished item
 *   is never late. `prefix`: a word before the label ("Due", "Follow up").
 * - `onChange(iso)` makes it editable: a click opens the browser's date picker; '' when cleared.
 *   `label`: what the day is ("Due date") for that picker's accessible name.
 * - `now`: the clock (tests); `size`: 'sm' (20 px) | 'md' (24 px, default); `showIcon` (true).
 */
export function DatePill({
  value, kind = 'due', done = false, prefix, onChange, label = 'Date', emptyLabel = 'Set date', now, size = 'md',
  showIcon = true, className,
}) {
  const inputRef = useRef(null);
  const info = datePillInfo(value, now ?? new Date(), { kind, done });
  const editable = typeof onChange === 'function';
  if (!info && !editable) return null;

  const look = cx(
    'inline-flex max-w-full shrink-0 items-center gap-1 whitespace-nowrap rounded-md font-medium tabular-nums',
    size === 'sm' ? 'h-5 px-1.5 text-[11px]' : 'h-6 px-2 text-xs',
    info ? cx('ring-1 ring-inset', TONE_CLASSES[info.tone]) : 'border border-dashed border-slate-300 bg-white text-slate-500',
    className,
  );
  const shown = info ? pillText(info, prefix) : emptyLabel;
  const body = (
    <>
      {showIcon && <CalendarDays size={size === 'sm' ? 11 : 12} aria-hidden="true" className="shrink-0 opacity-80" />}
      <span className="truncate">{shown}</span>
    </>
  );

  if (!editable) {
    // A plain span cannot carry an aria-label: the short words are shown, the full day is read.
    return (
      <span className={look} title={info.title}>
        {showIcon && <CalendarDays size={size === 'sm' ? 11 : 12} aria-hidden="true" className="shrink-0 opacity-80" />}
        <span className="truncate" aria-hidden="true">{shown}</span>
        <span className="sr-only">{`${prefix ? `${prefix}: ` : ''}${info.title}`}</span>
      </span>
    );
  }

  const open = () => {
    const input = inputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      // No showPicker (older Safari) or not allowed here: focusing the field opens its own UI.
      input.focus();
    }
  };
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={open}
        title={info?.title}
        aria-label={`${label}: ${info ? info.title : 'not set'}. Change`}
        className={cx(look, 'cursor-pointer transition-[filter] duration-150 hover:brightness-95', FOCUS_RING)}
      >
        {body}
      </button>
      <input
        ref={inputRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={info ? value.trim() : ''}
        onChange={(e) => onChange(e.target.value)}
        className="pointer-events-none absolute inset-0 size-full opacity-0"
      />
    </span>
  );
}
