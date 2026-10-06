import { useState, useRef, useSyncExternalStore } from 'react';

const KEY = 'cpwtcv-panel-width';
const DEFAULT_WIDTH = 360;
const MIN = 240;
const MAX = 640;
const KEY_STEP = 16;
// What a docked panel and the stage keep of the window (EditorDock's 360 px, the stage's floor): the panel is
// shown no wider than the window less these while a dock is open, whatever width is remembered.
const DOCK_PX = 360;
const STAGE_FLOOR_PX = 320;
// Below this width the dock lies OVER the stage (EditorDock's max-[1099px] classes), it does not narrow it: nothing to hold off.
const DOCK_BESIDE_FROM_PX = 1100;
const clamp = (w) => Math.min(MAX, Math.max(MIN, w));

// The window's width, read at every render while a dock is open (a store the resize event reports to), so the very
// render that opens the dock already draws the narrowed panel: a width kept in state from an effect would draw the
// remembered one for a frame first, and the stage would repaint at the squeezed width. Closed, nothing is followed.
const followWindow = (notify) => {
  window.addEventListener('resize', notify);
  return () => window.removeEventListener('resize', notify);
};
const readWindow = () => window.innerWidth;
const noFollow = () => () => {};
const noWidth = () => NaN;

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

/** The most the panel may be drawn at: the remembered range's top, or, with a dock beside the stage, what the window leaves it (never under 240). */
function capFor(dockOpen, viewport) {
  if (!dockOpen || !Number.isFinite(viewport) || viewport < DOCK_BESIDE_FROM_PX) return MAX;
  return Math.max(MIN, viewport - DOCK_PX - STAGE_FLOOR_PX);
}

/** The width the panel is drawn at: the remembered one, kept off the stage's floor while a dock beside the stage is open. */
function appliedWidth(width, dockOpen, viewport) {
  return Math.min(width, capFor(dockOpen, viewport));
}

/**
 * The editor panel's width in split mode: dragged by its right edge, remembered in localStorage.
 * `separatorProps` go on the handle (R2-144): a focusable role="separator" with its value and
 * range, moved by the arrow keys (16 px) and Home / End, and dragged with pointer events, so a
 * finger on a tablet in split view drags it as a mouse does; the handle captures the pointer.
 * With a dock open (`dockOpen`) the width it returns is held to the window less the dock and the stage's 320 px
 * floor, so the stage never falls under its floor; what is remembered (up to 640) stays in storage as it was,
 * and a drag or a key starts from the width drawn. `storedWidth` is the remembered one.
 */
export function usePanelResize({ dockOpen = false } = {}) {
  const [storedPx, setPanelWidth] = useState(storedWidth);
  const dragState = useRef(null);
  // The window's width is only followed while a dock is open: nothing else reads it.
  const viewport = useSyncExternalStore(dockOpen ? followWindow : noFollow, dockOpen ? readWindow : noWidth, noWidth);
  const panelWidth = appliedWidth(storedPx, dockOpen, viewport);

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    dragState.current = { startX: e.clientX, startW: panelWidth, startStored: storedPx, pointerId: e.pointerId };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    // The handle holds the pointer until it is released: the drag keeps following it over the
    // preview or out of the window, and a capture the browser takes away ends the drag. Best-effort:
    // a pointer that is no longer down refuses it, and the window's listeners drag all the same.
    const handle = e.currentTarget;
    try { handle?.setPointerCapture?.(e.pointerId); } catch { /* no active pointer: uncaptured */ }

    const ours = (e) => dragState.current && (e.pointerId === undefined || e.pointerId === dragState.current.pointerId);

    // The width the pointer asks for, held to what the window leaves while a dock is open: the handle follows the pointer
    // up to that and stays there (the remembered width never runs ahead of the one drawn).
    const asked = (clientX) => clamp(Math.min(dragState.current.startW + (clientX - dragState.current.startX), capFor(dockOpen, window.innerWidth)));

    function onPointerMove(e) {
      if (!ours(e)) return;
      setPanelWidth(asked(e.clientX));
    }

    // A release, a touch the browser took over (pointercancel) or a capture lost: the drag ends
    // where it was.
    function onPointerUp(e) {
      if (dragState.current && !ours(e)) return;
      const drag = dragState.current;
      const final = drag ? asked(e.clientX) : null; // before the drag state goes
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
      // A press that changed nothing (a click, a drag at the dock's limit) remembers nothing: a width chosen up to 640 stays.
      if (final === drag.startW) { setPanelWidth(drag.startStored); return; }
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
    // An arrow that would change nothing on screen (at the dock's limit) remembers nothing; Home and End always do.
    if (e.key.startsWith('Arrow') && appliedWidth(width, dockOpen, viewport) === panelWidth) return;
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

  return { panelWidth, storedWidth: storedPx, separatorProps };
}
