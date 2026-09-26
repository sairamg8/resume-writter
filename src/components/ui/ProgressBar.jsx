import { cx } from './compose.js';

const TONES = {
  indigo: 'bg-brand',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  neutral: 'bg-slate-400',
};

/**
 * How far along something is: a checklist's 2 of 5, a sprint's done points.
 *
 * - `value`, `max` (100); `label`: the accessible name ("Checklist"); `valueText` what is read
 *   ("2 of 5 done" — defaults to "value of max").
 * - `tone`: 'indigo' (default) | 'success' | 'warning' | 'danger' | 'neutral'; `autoTone` turns
 *   it green when complete. `size`: 'sm' (4 px) | 'md' (6 px). `showValue` prints "2/5" beside it.
 */
export function ProgressBar({ value = 0, max = 100, label, valueText, tone = 'indigo', autoTone = false, size = 'sm', showValue = false, className }) {
  const safeMax = max > 0 ? max : 1;
  const clamped = Math.min(Math.max(Number(value) || 0, 0), safeMax);
  const percent = (clamped / safeMax) * 100;
  const done = clamped >= safeMax && max > 0;
  const fill = TONES[autoTone && done ? 'success' : tone] ?? TONES.indigo;
  return (
    <div className={cx('flex min-w-0 items-center gap-2', className)}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={clamped}
        aria-valuetext={valueText ?? `${clamped} of ${max}`}
        className={cx('relative flex-1 overflow-hidden rounded-full bg-slate-200/80', size === 'md' ? 'h-1.5' : 'h-1')}
      >
        <div className={cx('h-full rounded-full transition-[width] duration-200 ease-out', fill)} style={{ width: `${percent}%` }} />
      </div>
      {showValue && <span className="shrink-0 text-[11px] font-medium tabular-nums text-slate-500">{clamped}/{max}</span>}
    </div>
  );
}
