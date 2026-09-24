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

const VARIANTS = {
  primary: 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800',
  secondary: 'bg-white text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 active:bg-slate-100',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200/70',
  subtle: 'bg-slate-100 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900 active:bg-slate-200',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800',
};

const SIZES = {
  sm: 'h-8 gap-1.5 px-2.5 text-[13px]',
  md: 'h-9 gap-2 px-3.5 text-sm',
};

/** The classes of a kit button, for an element that must look like one (a label, a link). */
export function buttonClass({ variant = 'secondary', size = 'md', fullWidth = false, className } = {}) {
  return cx(
    'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg font-medium',
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
