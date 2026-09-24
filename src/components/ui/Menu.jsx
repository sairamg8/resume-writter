import { Children, cloneElement, isValidElement, useCallback, useId, useRef, useState } from 'react';
import { MenuList } from './MenuList.jsx';
import { useDismiss } from './useDismiss.js';
import { composeHandlers, focusNeighbour, mergeRefs } from './compose.js';

/**
 * A dropdown menu of actions.
 *
 * - `trigger`: one element that opens it — usually `<IconButton icon={MoreHorizontal} label="More" />`
 *   or a `<Button>`; it gets aria-haspopup, aria-expanded, aria-controls and a click / arrow-key
 *   handler (its own run first). Its ref must reach a DOM node (the kit's buttons do).
 * - `items`: `{ label, onSelect, icon, shortcut, description, danger, disabled, checked, radio, items, id }`
 *   — `checked` (boolean) makes a checkbox item (a radio one with `radio: true`) with a tick;
 *   `items` makes a submenu ("Move to ▸"). Also `{ type: 'separator' }` and
 *   `{ type: 'label', label: 'Priority' }` for a group heading.
 * - `placement`: 'bottom-end' (default), 'bottom-start', 'top-end', …; it flips and shifts to stay
 *   inside the viewport. `minWidth` (200). `label`: the menu's accessible name when the trigger's
 *   own text is not a good one.
 * - Opens on click (focus on the list; arrows then move), or ArrowDown / ArrowUp / Enter / Space on
 *   the trigger (focus on the first / last item). Escape, Tab, a pick or a click outside closes it;
 *   Escape and a pick give focus back to the trigger, Tab / Shift+Tab go on to the element after /
 *   before the trigger.
 * - `open` / `onOpenChange` make it controlled; otherwise it keeps its own state.
 */
export function Menu({ trigger, items = [], placement = 'bottom-end', minWidth = 200, label, open: openProp, onOpenChange }) {
  const [openState, setOpenState] = useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;
  const [autoFocus, setAutoFocus] = useState('list');
  const triggerRef = useRef(null);
  const rootId = useId();
  const triggerId = `${rootId}-trigger`;
  const menuId = `${rootId}-menu`;

  const setOpen = useCallback((next) => {
    if (!controlled) setOpenState(next);
    onOpenChange?.(next);
  }, [controlled, onOpenChange]);

  // `move` ('next' | 'prev'): a Tab out of the menu goes on from the trigger, as if it never opened.
  const close = useCallback(({ restoreFocus = true, move } = {}) => {
    setOpen(false);
    if (!restoreFocus) return;
    triggerRef.current?.focus({ preventScroll: true });
    if (move) focusNeighbour(triggerRef.current, move === 'prev');
  }, [setOpen]);

  useDismiss(
    open,
    (target) => triggerRef.current?.contains(target) || !!target?.closest?.(`[data-menu-root="${rootId}"]`),
    () => close({ restoreFocus: false }),
  );

  const child = Children.only(trigger);
  if (!isValidElement(child)) return null;

  const openWith = (focus) => {
    setAutoFocus(focus);
    setOpen(true);
  };
  const onClick = (event) => {
    if (open) close({ restoreFocus: false });
    // A keyboard "click" (Enter / Space) has detail 0: land on the first item, as a native menu does.
    else openWith(event.detail === 0 ? 'first' : 'list');
  };
  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openWith(event.key === 'ArrowDown' ? 'first' : 'last');
    }
  };

  const { props } = child;
  return (
    <>
      {cloneElement(child, {
        ref: mergeRefs(props.ref, triggerRef),
        id: props.id ?? triggerId,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? menuId : undefined,
        onClick: composeHandlers(props.onClick, onClick),
        onKeyDown: composeHandlers(props.onKeyDown, onKeyDown),
      })}
      {open && (
        <MenuList
          id={menuId}
          rootId={rootId}
          items={items}
          anchorRef={triggerRef}
          placement={placement}
          labelledBy={label ? undefined : props.id ?? triggerId}
          label={label}
          autoFocus={autoFocus}
          minWidth={minWidth}
          onClose={close}
          onCloseAll={close}
        />
      )}
    </>
  );
}
