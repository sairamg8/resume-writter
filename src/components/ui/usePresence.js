import { useEffect, useState } from 'react';

/** True when the user asked the system for less motion (never on the server). */
export function prefersReducedMotion() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Keeps a closing panel mounted for `exitMs` so it can animate out: `{ mounted, state }`, where
 * `state` ('open' | 'closed') goes on the element as data-state and picks the enter or exit
 * animation. Opening mounts in the same render (no blank frame); with reduced motion the panel
 * unmounts at once.
 */
export function usePresence(open, exitMs = 150) {
  const [mounted, setMounted] = useState(open);
  // Derived during render, as React recommends for state that follows a prop.
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open || !mounted) return undefined;
    if (prefersReducedMotion()) {
      setMounted(false);
      return undefined;
    }
    const timer = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timer);
  }, [open, mounted, exitMs]);
  return { mounted: open || mounted, state: open ? 'open' : 'closed' };
}
