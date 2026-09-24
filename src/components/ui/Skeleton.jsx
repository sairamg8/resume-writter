import { cx } from './compose.js';

const SHIMMER = 'bg-[linear-gradient(90deg,var(--color-slate-100)_0%,var(--color-slate-200)_50%,var(--color-slate-100)_100%)] bg-[length:200%_100%] motion-safe:animate-ui-shimmer';

/**
 * A placeholder block while content loads: a soft shimmer (still under reduced motion). Hidden
 * from screen readers — mark the loading region aria-busy instead.
 *
 * - `className` sets the size ('h-4 w-40'); `rounded` ('md' default | 'full' | 'lg' | 'xl').
 * - `lines`: a paragraph of that many text lines, the last one shorter.
 */
export function Skeleton({ className, rounded = 'md', lines }) {
  const round = { md: 'rounded-md', full: 'rounded-full', lg: 'rounded-lg', xl: 'rounded-xl' }[rounded] ?? 'rounded-md';
  if (lines) {
    return (
      <div aria-hidden="true" className={cx('flex flex-col gap-2', className)}>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={cx('h-3', round, SHIMMER, i === lines - 1 && lines > 1 ? 'w-2/3' : 'w-full')} />
        ))}
      </div>
    );
  }
  return <div aria-hidden="true" className={cx(round, SHIMMER, className)} />;
}
