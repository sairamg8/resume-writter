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
  const place = () => {
    const past = phone.matches ? main.getBoundingClientRect().top - box.getBoundingClientRect().top : 0;
    box.style?.setProperty('--stuck', `${Math.max(0, Math.round(past))}px`);
  };
  place();
  main.addEventListener('scroll', place, { passive: true });
  window.addEventListener('resize', place);
  phone.addEventListener('change', place);
  return () => {
    main.removeEventListener('scroll', place);
    window.removeEventListener('resize', place);
    phone.removeEventListener('change', place);
  };
}

/** The ref for the scroll box of a project page that has a sticky header inside it (see `followPhoneStickyTop`). */
export function usePhoneStickyTop() {
  return useCallback((box) => (box ? followPhoneStickyTop(box) : undefined), []);
}
