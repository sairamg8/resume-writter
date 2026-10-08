import { useEffect, useLayoutEffect, useRef } from 'react';

/** The press that last dismissed a layer: a Dialog under that layer must not count the same press as its own. */
let dismissing = null;
/** Whether `nativeEvent` (a React event's) is a press that just closed a menu or popover. */
export const dismissedLayer = (nativeEvent) => dismissing !== null && dismissing === nativeEvent;

/**
 * While `active`, a pointer press anywhere `isInside(target)` rejects calls `onDismiss('outside')`
 * — the click-outside rule of menus and popovers. Listened for in the capture phase, so a page
 * that stops propagation cannot keep a stale menu open. Escape is each component's own key handler:
 * a React handler there can stop an Escape from also closing the dialog underneath. A press on a
 * dialog's overlay that dismisses a menu is that menu's alone, as the Escape is: the Dialog asks
 * dismissedLayer() before it counts the press.
 */
export function useDismiss(active, isInside, onDismiss) {
  const latest = useRef({ isInside, onDismiss });
  useLayoutEffect(() => {
    latest.current = { isInside, onDismiss };
  });
  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;
    const onPointerDown = (event) => {
      if (latest.current.isInside(event.target)) return;
      dismissing = event;
      latest.current.onDismiss('outside', event);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [active]);
}
