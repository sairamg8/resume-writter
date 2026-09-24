import { Children, cloneElement, isValidElement, useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import { Portal } from './Portal.jsx';
import { useFloating } from './useFloating.js';
import { useDismiss } from './useDismiss.js';
import { composeHandlers, cx, focusNeighbour, mergeRefs, tabbables } from './compose.js';

/**
 * A panel anchored to a trigger — the base of pickers and filters (MultiSelectPopover, a date or
 * label picker). Same dismissal rules as Menu: Escape (focus back to the trigger), a click outside,
 * and Tab leaving the panel (focus goes on to the element after — Shift+Tab: before — the trigger).
 *
 * - `trigger`: one element (a kit Button / IconButton / Chip); it gets aria-haspopup="dialog",
 *   aria-expanded, aria-controls and a click toggle (its own onClick runs first).
 * - `children`: the content, or `({ close }) => content` to close from inside (after a pick).
 * - `open` / `onOpenChange`: controlled; otherwise it keeps its own state.
 * - `placement` ('bottom-start'), `matchWidth` (at least as wide as the trigger), `className`
 *   (the panel's padding and width — none by default), `label` (aria-label of the panel).
 * - Focus moves into the panel when it opens: `initialFocusRef`, else a `data-autofocus` element,
 *   else the first focusable element, else the panel.
 */
export function Popover({
  trigger, children, open: openProp, onOpenChange, placement = 'bottom-start', matchWidth = false,
  initialFocusRef, label, className,
}) {
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const id = useId();
  const { style } = useFloating(open, triggerRef, panelRef, { placement, matchWidth });

  const setOpen = useCallback((next) => {
    if (!controlled) setOpenState(next);
    onOpenChange?.(next);
  }, [controlled, onOpenChange]);
  const close = useCallback(({ restoreFocus = true, move } = {}) => {
    setOpen(false);
    if (!restoreFocus) return;
    triggerRef.current?.focus({ preventScroll: true });
    if (move) focusNeighbour(triggerRef.current, move === 'prev');
  }, [setOpen]);

  useDismiss(
    open,
    // A menu opened from inside the panel lives in a later portal layer: a press there is inside.
    (target) => triggerRef.current?.contains(target) || panelRef.current?.contains(target) || isAbove(target, panelRef.current),
    () => close({ restoreFocus: false }),
  );

  useLayoutEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel || panel.contains(document.activeElement)) return;
    const target = initialFocusRef?.current || panel.querySelector('[data-autofocus]') || tabbables(panel)[0] || panel;
    target.focus({ preventScroll: true });
    // Focus is placed once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const child = Children.only(trigger);
  if (!isValidElement(child)) return null;

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      event.preventDefault();
      close();
      return;
    }
    // Tab past either end of the panel: close and go on from the trigger (the panel sits at the
    // end of <body>, so the browser's own next stop would be past the whole page).
    if (event.key !== 'Tab' || event.defaultPrevented || !panelRef.current?.contains(event.target)) return;
    const items = tabbables(panelRef.current);
    const edge = event.shiftKey ? items[0] : items.at(-1);
    if (items.length && event.target !== edge && event.target !== panelRef.current) return;
    event.preventDefault();
    close({ move: event.shiftKey ? 'prev' : 'next' });
  };
  const onBlur = (event) => {
    const next = event.relatedTarget;
    if (!next || panelRef.current?.contains(next) || triggerRef.current?.contains(next)) return;
    if (next.closest?.('[data-ui-portal]') && isAbove(next, panelRef.current)) return;
    close({ restoreFocus: false });
  };

  const { props } = child;
  return (
    <>
      {cloneElement(child, {
        ref: mergeRefs(props.ref, triggerRef),
        'aria-haspopup': 'dialog',
        'aria-expanded': open,
        'aria-controls': open ? id : undefined,
        onClick: composeHandlers(props.onClick, () => setOpen(!open)),
      })}
      {open && (
        <Portal>
          <div
            ref={panelRef}
            id={id}
            role="dialog"
            aria-label={label}
            tabIndex={-1}
            style={style}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            className={cx(
              'z-[70] flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl outline-none animate-ui-pop-in',
              className,
            )}
          >
            {typeof children === 'function' ? children({ close }) : children}
          </div>
        </Portal>
      )}
    </>
  );
}

/** Whether `node` sits in a portal layer added after the one holding `panel` (opened from it). */
function isAbove(node, panel) {
  const layer = node?.closest?.('[data-ui-portal]');
  const own = panel?.closest?.('[data-ui-portal]');
  if (!layer || !own || layer === own) return false;
  // DOCUMENT_POSITION_FOLLOWING: the layer comes after the panel's own in <body>.
  return Boolean(own.compareDocumentPosition(layer) & 4);
}
