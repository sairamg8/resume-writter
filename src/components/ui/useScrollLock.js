import { useLayoutEffect } from 'react';

/** How many layers hold the lock, and the body's own styles from before the first one took it. */
let holders = 0;
let saved = null;

/**
 * While `active`, the page behind a modal layer (a Dialog, the phone's navigation drawer) does not
 * scroll: <body> gets overflow hidden, and a padding as wide as the scrollbar it hid, so the page
 * never shifts sideways as a dialog opens. Counted, so a confirm opened over a dialog and closed
 * again leaves the lock to the dialog; the last one out puts back what the body had.
 */
export function useScrollLock(active) {
  useLayoutEffect(() => {
    if (!active || typeof document === 'undefined' || !document.body?.style) return undefined;
    const { body } = document;
    if (holders === 0) {
      const scrollbar = typeof window !== 'undefined' && document.documentElement
        ? Math.max(0, window.innerWidth - document.documentElement.clientWidth)
        : 0;
      saved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
      body.style.overflow = 'hidden';
      if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    }
    holders += 1;
    return () => {
      holders -= 1;
      if (holders === 0 && saved) {
        body.style.overflow = saved.overflow;
        body.style.paddingRight = saved.paddingRight;
        saved = null;
      }
    };
  }, [active]);
}
