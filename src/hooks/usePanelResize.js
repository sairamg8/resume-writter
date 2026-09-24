import { useState, useRef } from 'react';

const KEY = 'cpwtcv-panel-width';
const DEFAULT_WIDTH = 360;
const clamp = (w) => Math.min(640, Math.max(240, w));

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

/** The editor panel's width in split mode: dragged by its right edge, remembered in localStorage. */
export function usePanelResize() {
  const [panelWidth, setPanelWidth] = useState(storedWidth);
  const dragState = useRef(null);

  function onDragHandleMouseDown(e) {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startW: panelWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMouseMove(e) {
      if (!dragState.current) return;
      const delta = e.clientX - dragState.current.startX;
      setPanelWidth(clamp(dragState.current.startW + delta));
    }

    function onMouseUp(e) {
      const drag = dragState.current;
      // Let go of the drag first: remembering the width is best-effort, and a full storage
      // (QuotaExceededError) must not leave the panel following the mouse with text selection off.
      dragState.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (!drag) return;
      const final = clamp(drag.startW + (e.clientX - drag.startX));
      setPanelWidth(final);
      try { localStorage.setItem(KEY, String(final)); } catch { /* storage full or blocked: this visit only */ }
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  return { panelWidth, onDragHandleMouseDown };
}
