import { Link } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { cx } from './compose.js';

/** The kit's focus ring: every interactive element wears it for keyboard focus only. */
export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-1 focus-visible:ring-offset-white';

/**
 * A control smaller than the hit target the spec asks for (36 px, 44 px on a touch screen) keeps
 * its look and grows an invisible ::after around it — the click lands, the layout does not move.
 */
export const HIT_AREA = {
  sm: "relative after:absolute after:content-[''] after:-inset-0.5 pointer-coarse:after:-inset-1.5",
  md: "relative pointer-coarse:after:absolute pointer-coarse:after:content-[''] pointer-coarse:after:-inset-1",
};

// The tracker look (index.css's workspace colours): a brand-blue primary, a neutral-filled
// default, a transparent subtle one — flat, 4 px corners, 32 px tall at md.
const VARIANTS = {
  primary: 'bg-brand text-white hover:bg-brand-hover active:bg-brand-pressed',
  secondary: 'bg-neutral-fill text-ink-subtle hover:bg-neutral-fill-hover hover:text-ink active:bg-brand-subtle active:text-brand',
  ghost: 'text-ink-subtle hover:bg-neutral-fill hover:text-ink active:bg-neutral-fill-hover',
  subtle: 'bg-neutral-fill text-ink-subtle hover:bg-neutral-fill-hover hover:text-ink active:bg-neutral-fill-hover',
  danger: 'bg-[#c9372c] text-white hover:bg-[#ae2e24] active:bg-[#5d1f1a]',
};

const SIZES = {
  sm: 'h-7 gap-1.5 px-2 text-[13px]',
  md: 'h-8 gap-2 px-3 text-sm',
};

/** The classes of a kit button, for an element that must look like one (a label, a link). */
export function buttonClass({ variant = 'secondary', size = 'md', fullWidth = false, className } = {}) {
  return cx(
    'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded font-medium',
    'transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
    FOCUS_RING, HIT_AREA[size], VARIANTS[variant] ?? VARIANTS.secondary, SIZES[size] ?? SIZES.md,
    fullWidth && 'w-full', className,
  );
}

/**
 * The kit's button.
 *
 * - `variant`: 'primary' | 'secondary' (default) | 'ghost' | 'subtle' | 'danger'; `size`: 'sm' | 'md'.
 * - `leftIcon` / `rightIcon`: a lucide component (`leftIcon={Plus}`), drawn at 14–16 px.
 * - `loading`: a spinner replaces the left icon, the button is disabled and aria-busy.
 * - `to`: renders a router <Link> that looks the same (navigation, not an action).
 * - `type` defaults to "button", so a button inside a form never submits it by accident.
 * - `ref` reaches the <button> (React 19 passes it as a prop).
 */
export function Button({
  variant = 'secondary', size = 'md', leftIcon: LeftIcon, rightIcon: RightIcon, loading = false,
  fullWidth = false, to, type = 'button', disabled, className, children, ref, ...rest
}) {
  const iconSize = size === 'sm' ? 14 : 16;
  const classes = buttonClass({ variant, size, fullWidth, className });
  const content = (
    <>
      {loading
        ? <LoaderCircle size={iconSize} className="shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        : LeftIcon && <LeftIcon size={iconSize} className="shrink-0" aria-hidden="true" />}
      {children != null && children !== false && <span className="truncate">{children}</span>}
      {RightIcon && <RightIcon size={iconSize} className="shrink-0 opacity-70" aria-hidden="true" />}
    </>
  );
  if (to != null) {
    // A link cannot be disabled: a disabled one leaves the Tab order and ignores clicks instead.
    const off = disabled ? { 'aria-disabled': true, tabIndex: -1, onClick: (event) => event.preventDefault() } : {};
    return (
      <Link ref={ref} to={to} className={classes} {...rest} {...off}>
        {content}
      </Link>
    );
  }
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
      {...rest}
    >
      {content}
    </button>
  );
}
