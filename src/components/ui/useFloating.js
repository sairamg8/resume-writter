import { useLayoutEffect, useState } from 'react';
import { computePlacement } from './placement.js';

// Until it is measured the panel is transparent and lets the pointer through — not
// visibility: hidden, which browsers refuse to focus: Popover and MenuList move focus into the panel
// in the same commit, before its position renders, so a picker's search box and a menu's items
// never had it (typing went nowhere, Escape reached the dialog around it — R4-APP-01).
const HIDDEN = { position: 'fixed', top: 0, left: 0, opacity: 0, pointerEvents: 'none' };

/**
 * Positions `floatingRef` (a fixed panel in a Portal) next to `anchorRef` while `open`, through
 * computePlacement: measured before the browser paints (layout effect), so the panel never flashes
 * at the corner; kept in place on resize, on any scroll (capture phase, so a scrolled board column
 * counts) and when the panel itself changes size. Returns `{ style, side }` — spread `style` on the
 * panel; `side` is where it ended up ('top' after a flip), for an animation's direction.
 *
 * `matchWidth`: the panel is at least as wide as the anchor (a select-like popover).
 */
export function useFloating(open, anchorRef, floatingRef, { placement = 'bottom-start', offset = 6, matchWidth = false } = {}) {
  const [position, setPosition] = useState(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return undefined;
    }
    let frame = 0;
    const update = () => {
      const anchor = anchorRef.current;
      const floating = floatingRef.current;
      if (!anchor?.getBoundingClientRect || !floating) return;
      const rect = anchor.getBoundingClientRect();
      const next = computePlacement({
        anchor: rect,
        floating: { width: Math.max(floating.offsetWidth, matchWidth ? rect.width : 0), height: floating.offsetHeight },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        placement,
        offset,
      });
      next.minWidth = matchWidth ? Math.round(rect.width) : undefined;
      setPosition((prev) => (prev && ['top', 'left', 'maxHeight', 'maxWidth', 'minWidth', 'side'].every((k) => prev[k] === next[k]) ? prev : next));
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
    if (floatingRef.current) observer?.observe(floatingRef.current);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      observer?.disconnect();
    };
  }, [open, anchorRef, floatingRef, placement, offset, matchWidth]);

  if (!position) return { style: HIDDEN, side: null };
  return {
    side: position.side,
    style: {
      position: 'fixed',
      top: position.top,
      left: position.left,
      maxHeight: position.maxHeight,
      maxWidth: position.maxWidth,
      minWidth: position.minWidth,
    },
  };
}
