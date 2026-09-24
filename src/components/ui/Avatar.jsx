import { useState } from 'react';
import { avatarTone, initials } from '../../utils/uiFormat.js';
import { cx } from './compose.js';

const SIZES = {
  // Never under 11 px (the kit's floor): the smallest sizes are tracked tighter to fit two letters.
  xs: 'size-5 text-[11px] tracking-tighter',
  sm: 'size-6 text-[11px] tracking-tight',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
  xl: 'size-12 text-base',
};

/**
 * A person's or company's avatar: the picture at `src` when it loads, else up to two initials on a
 * colour that is always the same for the same name (uiFormat.avatarTone).
 *
 * - `name` (required): the initials, the colour and the accessible name ("Google").
 * - `size`: 'xs' (20) | 'sm' (24) | 'md' (32, default) | 'lg' (40) | 'xl' (48).
 * - `shape`: 'circle' (people, default) | 'square' (companies and projects, rounded).
 * - `decorative`: hidden from screen readers when the name is written right beside it.
 */
export function Avatar({ name, src, size = 'md', shape = 'circle', decorative = false, className }) {
  const [broken, setBroken] = useState(false);
  const tone = avatarTone(name);
  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': name || 'Unknown' };
  return (
    <span
      {...a11y}
      className={cx(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden font-semibold leading-none',
        shape === 'square' ? 'rounded-md' : 'rounded-full',
        SIZES[size] ?? SIZES.md, tone.bg, tone.text, className,
      )}
    >
      {src && !broken
        ? <img src={src} alt="" className="size-full object-cover" onError={() => setBroken(true)} />
        : initials(name)}
    </span>
  );
}
