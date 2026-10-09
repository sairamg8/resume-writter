import { useCallback } from 'react';

const PHONE = '(max-width: 767px)';

/**
 * Sets `--stuck` on `box`: how far its top has scrolled above the top of <main>, on a phone (0 from md up).
 * On a phone <main> scrolls the whole page and the box under the page header is as tall as its content,
 * but its overflow-x makes it the scroll box a `sticky top-0` header inside it sticks to, and the box never
 * moves down: the header never stuck. The header takes `max-md:top-[var(--stuck,0px)]` instead, which holds
 * it that far below the box's top (a sticky box stays inside its parent, so it stops at the end of the
 * table or the lane). From md up the box itself scrolls and `top-0` does the work.
 */
export function followPhoneStickyTop(box) {
  const main = box.closest?.('main');
  if (!main || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
  const phone = window.matchMedia(PHONE);
  let shown = null;
  const place = () => {
    const past = phone.matches ? main.getBoundingClientRect().top - box.getBoundingClientRect().top : 0;
    // Rounded down: a header a fraction of a pixel under the top of <main> shows a sliver of the rows scrolling by above it.
    // Written only when it changes: the property is inherited, so each write restyles every row below the box.
    const value = `${Math.max(0, Math.floor(past))}px`;
    if (value === shown) return;
    shown = value;
    box.style?.setProperty('--stuck', value);
  };
  place();
  main.addEventListener('scroll', place, { passive: true });
  window.addEventListener('resize', place);
  phone.addEventListener('change', place);
  // The page above the box can change height with no scroll: a notice appearing, the toolbar's filters opening, a title
  // wrapping to a second line. The box moves and nothing scrolls, so the value read at the last scroll would hold the header off the top.
  const page = box.parentElement;
  const watch = page && typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
  watch?.observe(page);
  return () => {
    main.removeEventListener('scroll', place);
    window.removeEventListener('resize', place);
    phone.removeEventListener('change', place);
    watch?.disconnect();
  };
}

/** The ref for the scroll box of a project page that has a sticky header inside it (see `followPhoneStickyTop`). */
export function usePhoneStickyTop() {
  return useCallback((box) => (box ? followPhoneStickyTop(box) : undefined), []);
}
