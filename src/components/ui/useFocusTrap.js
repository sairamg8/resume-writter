import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { tabbables } from './compose.js';

/** The traps that are active, innermost last: only the top one moves focus. */
const stack = [];

/**
 * Keeps keyboard focus inside `containerRef` while `active` — a modal dialog or the mobile
 * navigation drawer:
 *
 * - on activation focus goes to `initialFocusRef`, else an element marked `data-autofocus`, else
 *   the container itself (which carries tabIndex={-1}); a child that focused itself (autoFocus)
 *   keeps it;
 * - Tab and Shift+Tab wrap around inside (attach the returned `onKeyDown` to the container);
 * - focus that lands on the page behind (not in the container, not in another portal layer such
 *   as a menu opened from inside) is brought back;
 * - on deactivation focus returns to the element that had it before — the button that opened it.
 */
export function useFocusTrap(containerRef, active, { initialFocusRef, restoreFocus = true } = {}) {
  const token = useRef(null);
  if (!token.current) token.current = {};
  const opener = useRef(null);

  useLayoutEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;
    const container = containerRef.current;
    opener.current = document.activeElement;
    const me = token.current;
    stack.push(me);
    if (container && !container.contains(document.activeElement)) {
      const target = initialFocusRef?.current || container.querySelector('[data-autofocus]') || container;
      target.focus?.({ preventScroll: true });
    }
    return () => { stack.splice(stack.indexOf(me), 1); };
    // initialFocusRef is read once per activation, as the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, containerRef]);

  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;
    const previous = opener.current;
    const onFocusIn = (event) => {
      const container = containerRef.current;
      if (stack.at(-1) !== token.current || !container) return;
      const target = event.target;
      if (container.contains(target) || target?.closest?.('[data-ui-portal]')) return;
      container.focus?.({ preventScroll: true });
    };
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      // Focus goes back here, after the commit, not in the layout effect's cleanup: React runs that
      // during its commit and then puts back the focus it saw before it (R3-005) — onto the dialog,
      // which stays mounted for its exit animation, and is gone with it 150 ms later.
      if (restoreFocus && previous?.isConnected && typeof previous.focus === 'function') {
        previous.focus({ preventScroll: true });
      }
    };
    // restoreFocus is read once per activation, as the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, containerRef]);

  return useCallback((event) => {
    const container = containerRef.current;
    if (event.key !== 'Tab' || event.defaultPrevented || !container) return;
    // A menu or popover portaled from inside bubbles its keys here through React: not ours to wrap.
    if (!container.contains(event.target)) return;
    const items = tabbables(container);
    const current = document.activeElement;
    if (!items.length) {
      event.preventDefault();
      container.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && (current === first || current === container)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  }, [containerRef]);
}
