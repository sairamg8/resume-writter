import { X } from 'lucide-react';
import { TONE_CLASSES } from './Badge.jsx';
import { FOCUS_RING } from './Button.jsx';
import { cx } from './compose.js';

/**
 * A pill for a value the user set or can set: a label on an issue, an active filter, a quick-filter
 * toggle.
 *
 * - `tone` as Badge ('neutral' default); `color`: a dot in that CSS colour (a label's colour);
 *   `icon`: a lucide component.
 * - `onRemove`: adds an × button, named "Remove <children text or removeLabel>".
 * - `onClick` makes the chip a button; with `pressed` (boolean) it is a toggle (aria-pressed) —
 *   the board's "Overdue" / "High priority" quick filters — drawn indigo when on.
 * - `size`: 'sm' (24 px) | 'md' (28 px, default).
 */
export function Chip({
  tone = 'neutral', color, icon: Icon, onRemove, removeLabel, onClick, pressed, size = 'md', className, children, ref, ...rest
}) {
  const height = size === 'sm' ? 'h-6 text-xs' : 'h-7 text-[13px]';
  const body = (
    <>
      {color && <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
      {Icon && <Icon size={13} aria-hidden="true" className="shrink-0" />}
      <span className="truncate">{children}</span>
    </>
  );
  const on = pressed === true;
  const look = cx(
    'inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset',
    height, on ? 'bg-indigo-50 text-indigo-700 ring-indigo-300' : TONE_CLASSES[tone] ?? TONE_CLASSES.neutral,
  );

  if (onClick) {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        aria-pressed={pressed === undefined ? undefined : on}
        className={cx(
          look, 'px-2.5 transition-colors duration-150', FOCUS_RING,
          "relative after:absolute after:content-[''] after:-inset-1 pointer-coarse:after:-inset-2",
          on ? 'hover:bg-indigo-100' : 'hover:brightness-[0.97]', className,
        )}
        {...rest}
      >
        {body}
      </button>
    );
  }

  const name = removeLabel ?? (typeof children === 'string' ? children : 'item');
  return (
    <span ref={ref} className={cx(look, onRemove ? 'pr-0.5 pl-2.5' : 'px-2.5', className)} {...rest}>
      {body}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className={cx(
            'relative ml-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full opacity-70 transition',
            "after:absolute after:content-[''] after:-inset-2 pointer-coarse:after:-inset-3",
            'hover:bg-black/5 hover:opacity-100', FOCUS_RING,
          )}
        >
          <X size={12} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
