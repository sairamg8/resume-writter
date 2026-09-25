import { useId } from 'react';
import { cx } from './compose.js';

/**
 * The ids a field's parts share: the control's `id` (the caller's, else a new one), and the hint's
 * and error's, joined into the control's aria-describedby.
 */
export function useFieldIds(id, { hint, error } = {}) {
  const own = useId();
  const controlId = id ?? own;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  return { controlId, hintId, errorId, describedBy: [errorId, hintId].filter(Boolean).join(' ') || undefined };
}

/** The border and ring of every text-like control, red when `invalid`. */
export function controlClass({ invalid = false, size = 'md' } = {}) {
  return cx(
    'w-full rounded border bg-white text-ink transition-[border-color,box-shadow,background-color] duration-150',
    'placeholder:text-ink-subtlest hover:bg-hovered focus:bg-white focus:outline-none focus-visible:outline-none',
    'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500',
    invalid
      ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/30'
      : 'border-[#8590a2]/70 focus:border-brand focus:ring-1 focus:ring-brand',
    // 16 px on touch screens: iOS zooms the page into any smaller field it focuses.
    size === 'sm' ? 'text-[13px] pointer-coarse:text-base' : 'text-sm pointer-coarse:text-base',
  );
}

/**
 * A form field's frame: its label (with a * when `required`), the control (`children`), then the
 * error (red, role="alert") or the hint. The control takes `ids.controlId` as its id and
 * `ids.describedBy` as aria-describedby — TextField, TextArea and Select do this themselves; use
 * Field directly only for a custom control.
 */
export function Field({ ids, label, hint, error, required = false, className, labelClassName, children }) {
  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={ids.controlId} className={cx('text-[12px] font-semibold leading-5 text-ink-subtle', labelClassName)}>
          {label}
          {required && <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p id={ids.errorId} role="alert" className="text-xs font-medium leading-4 text-red-600">{error}</p>
      ) : hint ? (
        <p id={ids.hintId} className="text-xs leading-4 text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
