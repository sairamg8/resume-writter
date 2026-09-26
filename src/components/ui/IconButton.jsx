import { Tooltip } from './Tooltip.jsx';
import { FOCUS_RING } from './Button.jsx';
import { cx } from './compose.js';

const VARIANTS = {
  ghost: 'text-ink-subtle hover:bg-neutral-fill hover:text-ink active:bg-neutral-fill-hover',
  subtle: 'bg-neutral-fill text-ink-subtle hover:bg-neutral-fill-hover hover:text-ink',
  secondary: 'bg-neutral-fill text-ink-subtle hover:bg-neutral-fill-hover hover:text-ink',
  danger: 'text-ink-subtle hover:bg-red-50 hover:text-red-700 active:bg-red-100',
  primary: 'bg-brand text-white hover:bg-brand-hover',
};

const SIZES = { sm: 'size-7 rounded', md: 'size-8 rounded', lg: 'size-9 rounded' };
/** An invisible ::after that makes each size's hit target 36 px, and 44 px on a touch screen. */
const HIT = {
  sm: "relative after:absolute after:content-[''] after:-inset-1 pointer-coarse:after:-inset-2",
  md: "relative after:absolute after:content-[''] after:-inset-0.5 pointer-coarse:after:-inset-1.5",
  lg: "relative pointer-coarse:after:absolute pointer-coarse:after:content-[''] pointer-coarse:after:-inset-1",
};
const ICON = { sm: 14, md: 16, lg: 18 };

/**
 * A button that is only an icon. `label` is required: it is the accessible name (aria-label) and
 * the tooltip, so every icon says what it does.
 *
 * - `icon`: a lucide component (`icon={MoreHorizontal}`); `size`: 'sm' (28 px) | 'md' (32 px,
 *   default) | 'lg' (36 px) — each with an invisible hit area of at least 36 px (44 px on touch).
 * - `variant`: 'ghost' (default) | 'subtle' | 'secondary' | 'danger' (red on hover) | 'primary'.
 * - `shortcut`: a key combo shown in the tooltip; `tooltip={false}` for no tooltip;
 *   `tooltipPlacement` as Tooltip's `placement`.
 * - `pressed`: a toggle (aria-pressed), drawn as selected when true.
 * - Every other prop (onClick, disabled, ref, aria-*) reaches the <button>.
 */
export function IconButton({
  icon: Icon, label, size = 'md', variant = 'ghost', shortcut, tooltip = true, tooltipPlacement = 'top',
  pressed, className, type = 'button', ref, ...rest
}) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={pressed === undefined ? undefined : pressed}
      className={cx(
        'inline-flex shrink-0 items-center justify-center transition-colors duration-150 ease-out',
        'disabled:pointer-events-none disabled:opacity-40',
        FOCUS_RING, SIZES[size] ?? SIZES.md, HIT[size] ?? HIT.md,
        pressed ? 'bg-brand-subtle text-brand hover:bg-brand-subtle-hover' : VARIANTS[variant] ?? VARIANTS.ghost,
        className,
      )}
      {...rest}
    >
      {Icon && <Icon size={ICON[size] ?? 16} aria-hidden="true" />}
    </button>
  );
  if (!tooltip) return button;
  return <Tooltip content={label} shortcut={shortcut} placement={tooltipPlacement}>{button}</Tooltip>;
}
