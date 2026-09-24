import { cx } from './compose.js';

/**
 * The kit's tones as badge colours: a light fill, readable text (≥ 4.5:1) and a faint ring.
 * Exported so Chip and DatePill colour the same way.
 */
export const TONE_CLASSES = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200/70',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200/70',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200/80',
  danger: 'bg-red-50 text-red-700 ring-red-200/70',
  info: 'bg-sky-50 text-sky-700 ring-sky-200/70',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200/70',
};

const SIZES = {
  sm: 'h-5 gap-1 px-1.5 text-[11px]',
  md: 'h-6 gap-1.5 px-2 text-xs',
};

/**
 * A small status label: "Interview", "In progress", "3 open".
 *
 * - `tone`: 'neutral' (default) | 'indigo' | 'success' | 'warning' | 'danger' | 'info' | 'violet'.
 * - `size`: 'sm' (20 px, 11 px text) | 'md' (24 px, default).
 * - `icon`: a lucide component before the text; `dot`: a colour dot (a CSS colour, e.g. a
 *   label's '#22c55e') — the text still names it, colour is never the only signal.
 * - `uppercase` for the compact all-caps style of issue types or keys.
 */
export function Badge({ tone = 'neutral', size = 'md', icon: Icon, dot, uppercase = false, className, children, ...rest }) {
  return (
    <span
      className={cx(
        'inline-flex max-w-full shrink-0 items-center whitespace-nowrap rounded-md font-medium ring-1 ring-inset',
        TONE_CLASSES[tone] ?? TONE_CLASSES.neutral, SIZES[size] ?? SIZES.md,
        uppercase && 'uppercase tracking-wide', className,
      )}
      {...rest}
    >
      {dot && <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} />}
      {Icon && <Icon size={size === 'sm' ? 12 : 13} aria-hidden="true" className="shrink-0" />}
      <span className="truncate">{children}</span>
    </span>
  );
}
