import { useEffect } from 'react';
import { isImeKey } from '@/components/ui/compose.js';

/**
 * The click that ends a press which just closed a menu goes nowhere: it must not also press what is under the
 * pointer (a card's Delete, a button of the page), as the full-screen backdrop the account menu had did. It is
 * dropped with that click, or when the next press or key comes first (a press that became a drag has no click;
 * a key starts its own click, which is the page's). No timer: it outlives the effect below, which the close
 * itself tears down.
 */
function swallowNextClick(pressed) {
  const events = ['pointerdown', 'keydown'];
  const done = () => {
    document.removeEventListener('click', swallow, true);
    for (const type of events) document.removeEventListener(type, cancel, true);
  };
  function swallow(e) { e.preventDefault?.(); e.stopPropagation?.(); done(); }
  const cancel = (e) => { if (e !== pressed) done(); }; // not the very press that is being answered
  document.addEventListener('click', swallow, true);
  for (const type of events) document.addEventListener(type, cancel, true);
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
      if (swallowClick) swallowNextClick(e);
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
