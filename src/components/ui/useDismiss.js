import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * While `active`, a pointer press anywhere `isInside(target)` rejects calls `onDismiss('outside')`
 * — the click-outside rule of menus and popovers. Listened for in the capture phase, so a page
 * that stops propagation cannot keep a stale menu open. Escape is each component's own key handler:
 * a React handler there can stop an Escape from also closing the dialog underneath.
 */
export function useDismiss(active, isInside, onDismiss) {
  const latest = useRef({ isInside, onDismiss });
  useLayoutEffect(() => {
    latest.current = { isInside, onDismiss };
  });
  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;
    const onPointerDown = (event) => {
      if (!latest.current.isInside(event.target)) latest.current.onDismiss('outside', event);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [active]);
}
