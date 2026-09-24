import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react';
import { Portal } from './Portal.jsx';
import { useFloating } from './useFloating.js';
import { composeHandlers } from './compose.js';
import { Kbd } from './Kbd.jsx';

const DELAY = 400;
/** Once one tooltip has shown, the next within this window shows at once — scanning a toolbar. */
const WARM_MS = 300;
let lastHiddenAt = 0;

/** A touch screen shows no tooltips: there is no hover, and a tap must act at once. */
function isTouchOnly() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(hover: none)').matches;
}

/**
 * A short label for the one element it wraps, shown on hover or keyboard focus after 400 ms
 * (at once while another tooltip was just open), hidden on leave, blur, a press, or Escape.
 *
 * - `content`: the text (or node); `shortcut`: a key combo drawn after it ('c', 'mod+k').
 * - `placement`: 'top' (default), 'bottom', 'right', 'left', with -start / -end.
 * - While shown, the child gets `aria-describedby` → the `role="tooltip"` bubble.
 * - A no-op on touch screens, and when `content` is empty or `disabled`.
 *
 * The child must be one element that passes pointer and focus handlers on to a DOM element (a
 * <button>, the kit's Button / IconButton); its handlers still run first.
 */
export function Tooltip({ content, shortcut, placement = 'top', disabled = false, children }) {
  const child = Children.only(children);
  const id = useId();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const bubbleRef = useRef(null);
  const timer = useRef(0);
  const { style } = useFloating(open, anchorRef, bubbleRef, { placement, offset: 6 });

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!isValidElement(child) || disabled || !content || isTouchOnly()) return child;

  const show = (event) => {
    anchorRef.current = event.currentTarget;
    clearTimeout(timer.current);
    const warm = Date.now() - lastHiddenAt < WARM_MS;
    timer.current = setTimeout(() => setOpen(true), warm ? 0 : DELAY);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen((was) => {
      if (was) lastHiddenAt = Date.now();
      return false;
    });
  };
  const onPointerEnter = (event) => { if (event.pointerType !== 'touch') show(event); };
  const onFocus = (event) => {
    // Keyboard focus only: a mouse press focuses the button too, and must not pop the tooltip.
    if (event.currentTarget.matches?.(':focus-visible') !== false) show(event);
  };
  const onKeyDown = (event) => {
    if (event.key === 'Escape' && open) {
      hide();
      event.stopPropagation();
    }
  };

  const { props } = child;
  return (
    <>
      {cloneElement(child, {
        'aria-describedby': open ? [props['aria-describedby'], id].filter(Boolean).join(' ') : props['aria-describedby'],
        onPointerEnter: composeHandlers(props.onPointerEnter, onPointerEnter),
        onPointerLeave: composeHandlers(props.onPointerLeave, hide),
        onPointerDown: composeHandlers(props.onPointerDown, hide),
        onFocus: composeHandlers(props.onFocus, onFocus),
        onBlur: composeHandlers(props.onBlur, hide),
        onKeyDown: composeHandlers(props.onKeyDown, onKeyDown),
      })}
      {open && (
        <Portal>
          <div
            ref={bubbleRef}
            id={id}
            role="tooltip"
            style={style}
            className="pointer-events-none z-[80] flex max-w-64 items-center gap-2 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium leading-5 text-white shadow-lg animate-ui-fade-in"
          >
            <span>{content}</span>
            {shortcut && <Kbd combo={shortcut} tone="dark" />}
          </div>
        </Portal>
      )}
    </>
  );
}
