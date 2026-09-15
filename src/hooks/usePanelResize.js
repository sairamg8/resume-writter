import { useState, useRef } from 'react';

/** The editor panel's width in split mode: dragged by its right edge, remembered in localStorage. */
export function usePanelResize() {
  const [panelWidth, setPanelWidth] = useState(() => {
    const stored = localStorage.getItem('cpwtcv-panel-width');
    return stored ? Math.min(640, Math.max(240, parseInt(stored, 10))) : 360;
  });
  const dragState = useRef(null);

  function onDragHandleMouseDown(e) {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startW: panelWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function onMouseMove(e) {
      if (!dragState.current) return;
      const delta = e.clientX - dragState.current.startX;
      const next = Math.min(640, Math.max(240, dragState.current.startW + delta));
      setPanelWidth(next);
    }

    function onMouseUp(e) {
      if (dragState.current) {
        const delta = e.clientX - dragState.current.startX;
        const final = Math.min(640, Math.max(240, dragState.current.startW + delta));
        localStorage.setItem('cpwtcv-panel-width', String(final));
      }
      dragState.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  return { panelWidth, onDragHandleMouseDown };
}
