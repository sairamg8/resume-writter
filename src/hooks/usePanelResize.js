import { useState, useRef } from 'react';

const KEY = 'cpwtcv-panel-width';
const DEFAULT_WIDTH = 360;
const MIN = 240;
const MAX = 640;
const KEY_STEP = 16;
const clamp = (w) => Math.min(MAX, Math.max(MIN, w));

/**
 * The width last remembered, clamped to 240–640; 360 when there is none, it is not a number, or the
 * browser refuses storage (site data blocked throws SecurityError from getItem) — never a crash.
 */
function storedWidth() {
  let stored = null;
  try { stored = localStorage.getItem(KEY); } catch { /* storage blocked: the default */ }
  const width = Number.parseInt(stored, 10);
  return Number.isFinite(width) ? clamp(width) : DEFAULT_WIDTH;
}

/** Remember a width best-effort: storage full or blocked keeps it for this visit only. */
function remember(width) {
  try { localStorage.setItem(KEY, String(width)); } catch { /* storage full or blocked: this visit only */ }
}

/**
 * The editor panel's width in split mode: dragged by its right edge, remembered in localStorage.
 * `separatorProps` go on the handle (R2-144): a focusable role="separator" with its value and
 * range, moved by the arrow keys (16 px) and Home / End, and dragged with pointer events, so a
 * finger on a tablet in split view drags it as a mouse does; the handle captures the pointer.
 */
export function usePanelResize() {
  const [panelWidth, setPanelWidth] = useState(storedWidth);
  const dragState = useRef(null);

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    dragState.current = { startX: e.clientX, startW: panelWidth, pointerId: e.pointerId };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    // The handle holds the pointer until it is released: the drag keeps following it over the
    // preview or out of the window, and a capture the browser takes away ends the drag. Best-effort:
    // a pointer that is no longer down refuses it, and the window's listeners drag all the same.
    const handle = e.currentTarget;
    try { handle?.setPointerCapture?.(e.pointerId); } catch { /* no active pointer: uncaptured */ }

    const ours = (e) => dragState.current && (e.pointerId === undefined || e.pointerId === dragState.current.pointerId);

    function onPointerMove(e) {
      if (!ours(e)) return;
      const delta = e.clientX - dragState.current.startX;
      setPanelWidth(clamp(dragState.current.startW + delta));
    }

    // A release, a touch the browser took over (pointercancel) or a capture lost: the drag ends
    // where it was.
    function onPointerUp(e) {
      if (dragState.current && !ours(e)) return;
      const drag = dragState.current;
      // Let go of the drag first: remembering the width is best-effort, and a full storage
      // (QuotaExceededError) must not leave the panel following the pointer with text selection off.
      dragState.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      handle?.removeEventListener?.('lostpointercapture', onPointerUp);
      if (!drag) return;
      const final = clamp(drag.startW + (e.clientX - drag.startX));
      setPanelWidth(final);
      remember(final);
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    handle?.addEventListener?.('lostpointercapture', onPointerUp);
  }

  function onKeyDown(e) {
    const next = {
      ArrowLeft: panelWidth - KEY_STEP, ArrowDown: panelWidth - KEY_STEP,
      ArrowRight: panelWidth + KEY_STEP, ArrowUp: panelWidth + KEY_STEP,
      Home: MIN, End: MAX,
    }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const width = clamp(next);
    setPanelWidth(width);
    remember(width);
  }

  const separatorProps = {
    role: 'separator',
    'aria-orientation': 'vertical',
    'aria-label': 'Resize editor panel',
    'aria-valuenow': panelWidth,
    'aria-valuemin': MIN,
    'aria-valuemax': MAX,
    tabIndex: 0,
    onPointerDown,
    onKeyDown,
  };

  return { panelWidth, separatorProps };
}
