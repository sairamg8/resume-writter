import { Bookmark, Check, ChevronDown, ChevronUp, ChevronsDown, ChevronsUp, Circle, Equal, Zap } from 'lucide-react';
import { ISSUE_TYPES, PRIORITIES } from '../../constants/boards.js';
import { cx } from '../ui/index.js';

// The tracker's small glyphs: an issue type as a white mark on a coloured square (task blue,
// bug red, story green, epic purple), a priority as coloured chevrons. Each one is named for a
// screen reader (role="img" + aria-label) unless `decorative` — colour is never the only signal.

const TYPE_MARK = { task: Check, bug: Circle, story: Bookmark, epic: Zap };
const PRIORITY_MARK = { highest: ChevronsUp, high: ChevronUp, medium: Equal, low: ChevronDown, lowest: ChevronsDown };

export const typeOf = (id) => ISSUE_TYPES.find((t) => t.id === id) ?? ISSUE_TYPES[0];
export const priorityOf = (id) => PRIORITIES.find((p) => p.id === id) ?? PRIORITIES[2];

/** An issue type's icon: `type` ('task' | 'bug' | 'story' | 'epic'), `size` in px (16). */
export function IssueTypeIcon({ type, size = 16, decorative = false, className }) {
  const t = typeOf(type);
  const Mark = TYPE_MARK[t.id] ?? Check;
  const filled = t.id === 'bug' || t.id === 'story' || t.id === 'epic';
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : t.name}
      aria-hidden={decorative ? 'true' : undefined}
      title={decorative ? undefined : t.name}
      className={cx('inline-flex shrink-0 items-center justify-center rounded-[3px] text-white', className)}
      style={{ width: size, height: size, backgroundColor: t.color }}
    >
      <Mark size={Math.round(size * 0.66)} strokeWidth={3} fill={filled ? 'currentColor' : 'none'} aria-hidden="true" />
    </span>
  );
}

/** A priority's icon: `priority` ('highest' … 'lowest'), `size` in px (16). */
export function PriorityIcon({ priority, size = 16, decorative = false, className }) {
  const p = priorityOf(priority);
  const Mark = PRIORITY_MARK[p.id] ?? Equal;
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : `${p.name} priority`}
      aria-hidden={decorative ? 'true' : undefined}
      title={decorative ? undefined : `${p.name} priority`}
      className={cx('inline-flex shrink-0 items-center justify-center', className)}
      style={{ color: p.color }}
    >
      <Mark size={size} strokeWidth={2.75} aria-hidden="true" />
    </span>
  );
}

/** Story points, as a small grey pill ("3"); nothing for an issue without an estimate. */
export function Points({ value, className }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <span
      title={`${value} story point${value === 1 ? '' : 's'}`}
      className={cx('inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-neutral-fill-hover px-1.5 text-[11px] font-semibold text-ink-subtle', className)}
    >
      {value}
      <span className="sr-only"> story point{value === 1 ? '' : 's'}</span>
    </span>
  );
}
