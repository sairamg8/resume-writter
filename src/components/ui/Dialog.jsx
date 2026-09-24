import { useId, useRef } from 'react';
import { X } from 'lucide-react';
import { Portal } from './Portal.jsx';
import { IconButton } from './IconButton.jsx';
import { usePresence } from './usePresence.js';
import { useFocusTrap } from './useFocusTrap.js';
import { useScrollLock } from './useScrollLock.js';
import { cx } from './compose.js';

const SIZES = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-lg',
  lg: 'md:max-w-2xl',
  xl: 'md:max-w-4xl',
  full: 'md:max-w-none h-[calc(100dvh-2rem)] md:h-[calc(100dvh-3rem)]',
};
/** Sizes too big for a phone: below sm they take the whole screen, sliding up as a sheet. */
const LARGE = new Set(['lg', 'xl', 'full']);

/** The panel's enter / exit animation for its layout (Tailwind needs every class written out). */
function panelMotion({ sheet, large, closing }) {
  if (sheet) return closing ? 'max-md:animate-ui-sheet-out md:animate-ui-dialog-out' : 'max-md:animate-ui-sheet-in md:animate-ui-dialog-in';
  if (large) return closing ? 'max-sm:animate-ui-sheet-out sm:animate-ui-dialog-out' : 'max-sm:animate-ui-sheet-in sm:animate-ui-dialog-in';
  return closing ? 'animate-ui-dialog-out' : 'animate-ui-dialog-in';
}

/**
 * A modal dialog in a portal over a dimmed page.
 *
 * - `open`, `onClose(reason)` — reason 'escape' | 'overlay' | 'close-button'. The parent owns
 *   `open`; the dialog animates in (fade + scale, 180 ms) and out before it unmounts.
 * - `title` (named by aria-labelledby) and `description` (aria-describedby); without a title pass
 *   `aria-label`. `size`: 'sm' | 'md' (default) | 'lg' | 'xl' | 'full'.
 * - Phones: `size` 'lg' | 'xl' | 'full' fills the whole screen below sm (no margins, no radius,
 *   slides up); `sheet` makes any size a bottom sheet below md (full width, rounded top, slides
 *   up over 220 ms) — a large sheet still fills the screen below sm.
 * - The page behind does not scroll while it is open (useScrollLock).
 * - `footer`: the action row (right-aligned); `headerActions`: extra buttons before the close X;
 *   `hideClose` drops the X (then give another way out).
 * - Focus is trapped inside; it starts at `initialFocusRef`, else a `data-autofocus` element, else
 *   the panel, and returns to whatever opened the dialog when it closes.
 * - Escape and a click on the overlay close it unless `closeOnEscape` / `closeOnOverlay` are false.
 *   A menu or popover open inside handles its own Escape first.
 * - `role`: 'dialog' (default) or 'alertdialog' (ConfirmDialog).
 */
export function Dialog({
  open, onClose, title, description, size = 'md', sheet = false, footer, headerActions, hideClose = false,
  closeOnEscape = true, closeOnOverlay = true, initialFocusRef, role = 'dialog', className, bodyClassName,
  children, 'aria-label': ariaLabel,
}) {
  const { mounted, state } = usePresence(open, 150);
  const panelRef = useRef(null);
  const pressStartedOnOverlay = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const onTrapKeyDown = useFocusTrap(panelRef, open && mounted, { initialFocusRef });
  useScrollLock(mounted);

  if (!mounted) return null;
  const close = (reason) => { if (open) onClose?.(reason); };

  const onKeyDown = (event) => {
    onTrapKeyDown(event);
    if (event.key === 'Escape' && closeOnEscape && !event.defaultPrevented) {
      event.stopPropagation();
      close('escape');
    }
  };
  // Closes only when the press both starts and ends on the overlay: selecting text inside and
  // releasing outside must not throw the dialog away.
  const onOverlayPointerDown = (event) => { pressStartedOnOverlay.current = event.target === event.currentTarget; };
  const onOverlayClick = (event) => {
    if (closeOnOverlay && pressStartedOnOverlay.current && event.target === event.currentTarget) close('overlay');
    pressStartedOnOverlay.current = false;
  };

  const closing = state === 'closed';
  const large = LARGE.has(size);
  return (
    <Portal>
      <div className="fixed inset-0 z-50" onKeyDown={onKeyDown}>
        <div
          aria-hidden="true"
          className={cx('absolute inset-0 bg-slate-900/40', closing ? 'animate-ui-fade-out' : 'animate-ui-fade-in')}
        />
        <div
          className={cx(
            'absolute inset-0 flex items-center justify-center overflow-y-auto overscroll-contain p-4 md:p-6',
            sheet && 'max-md:items-end max-md:p-0',
            large && 'max-sm:p-0',
          )}
          onPointerDown={onOverlayPointerDown}
          onClick={onOverlayClick}
        >
          <div
            ref={panelRef}
            role={role}
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={title ? undefined : ariaLabel}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            data-state={state}
            className={cx(
              'relative flex w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-900/5 outline-none',
              'max-h-[calc(100dvh-2rem)] md:max-h-[calc(100dvh-3rem)]',
              SIZES[size] ?? SIZES.md,
              large && 'max-sm:h-dvh max-sm:max-h-dvh max-sm:rounded-none max-sm:ring-0',
              sheet && (large
                ? 'sm:max-md:max-h-[calc(100dvh-1.5rem)] sm:max-md:rounded-b-none'
                : 'max-md:max-h-[calc(100dvh-1.5rem)] max-md:rounded-b-none'),
              sheet && size === 'full' && 'sm:max-md:h-[calc(100dvh-1.5rem)]',
              panelMotion({ sheet, large, closing }),
              className,
            )}
          >
            {sheet && <div aria-hidden="true" className={cx('mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-200 md:hidden', large && 'max-sm:hidden')} />}
            {(title || !hideClose || headerActions) && (
              <div className="flex shrink-0 items-start gap-3 px-5 pt-4 pb-3">
                <div className="min-w-0 flex-1">
                  {title && <h2 id={titleId} className="text-[15px] font-semibold leading-6 text-slate-900">{title}</h2>}
                  {description && <p id={descriptionId} className="mt-0.5 text-[13px] leading-5 text-slate-500">{description}</p>}
                </div>
                {headerActions && <div className="flex shrink-0 items-center gap-1">{headerActions}</div>}
                {!hideClose && (
                  <IconButton icon={X} label="Close" size="sm" onClick={() => close('close-button')} className="-mr-1.5 shrink-0" />
                )}
              </div>
            )}
            <div className={cx('min-h-0 flex-1 overflow-y-auto px-5 pb-5', !title && hideClose && 'pt-5', bodyClassName)}>
              {children}
            </div>
            {footer && (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}
