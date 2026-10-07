import { useEffect } from 'react';
import { isImeKey } from '@/components/ui/compose.js';

/**
 * The click that ends a press which just closed a menu goes nowhere: it must not also press what is under the
 * pointer (a card's Delete, a button of the page), as the full-screen backdrop the account menu had did. It is
 * removed with that click, or after a second if none comes (a press that became a drag); it outlives the effect
 * below, which the close itself tears down.
 */
const SWALLOW_MS = 1000;
function swallowNextClick() {
  let timer = null;
  const done = () => { clearTimeout(timer); document.removeEventListener('click', swallow, true); };
  function swallow(e) { e.preventDefault?.(); e.stopPropagation?.(); done(); }
  document.addEventListener('click', swallow, true);
  timer = setTimeout(done, SWALLOW_MS);
}

/**
 * While `active`, a pointer pressed outside `ref`'s element calls `onClose` (a tap counts: iOS Safari
 * never moves focus to a tapped button, so no blur would). `onEscape` is passed only where the control
 * already closes on Escape; with none, Escape is not listened for, and an input method's Escape (it drops
 * the word being composed) is never one. `swallowClick`: the click that completes the closing press does
 * not reach the page. Both listeners are removed when `active` turns false and on unmount.
 */
export function useOutsideClose(ref, active, onClose, onEscape, { swallowClick = false } = {}) {
  useEffect(() => {
    if (!active) return undefined;
    const away = (e) => {
      if (ref.current?.contains(e.target)) return;
      onClose();
      if (swallowClick) swallowNextClick();
    };
    const key = (e) => { if (e.key === 'Escape' && !isImeKey(e)) onEscape(); };
    // Capture phase: a page element that stops pointerdown cannot keep this control open.
    document.addEventListener('pointerdown', away, true);
    if (onEscape) document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', key);
    };
  }, [ref, active, onClose, onEscape, swallowClick]);
}
