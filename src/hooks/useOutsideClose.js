import { useEffect } from 'react';

/**
 * While `active`, a pointer pressed outside `ref`'s element calls `onClose` (a tap counts: iOS Safari
 * never moves focus to a tapped button, so no blur would). `onEscape` is passed only where the control
 * already closes on Escape; with none, Escape is not listened for. Both listeners are removed when
 * `active` turns false and on unmount.
 */
export function useOutsideClose(ref, active, onClose, onEscape) {
  useEffect(() => {
    if (!active) return undefined;
    const away = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    const key = (e) => { if (e.key === 'Escape') onEscape(); };
    document.addEventListener('pointerdown', away);
    if (onEscape) document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [ref, active, onClose, onEscape]);
}
