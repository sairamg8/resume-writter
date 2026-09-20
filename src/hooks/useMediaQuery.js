import { useState, useEffect } from 'react';

/**
 * React hook that returns whether the current window matches a media query.
 * Falls back safely when window or matchMedia is unavailable (e.g. tests, SSR).
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const media = window.matchMedia(query);
    const listener = (e) => setMatches(e.matches);
    setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

/**
 * Returns true when the viewport is narrower than breakpoint (default: 768px, Tailwind's md).
 */
export function useIsMobile(breakpoint = 768) {
  return !useMediaQuery(`(min-width: ${breakpoint}px)`);
}
