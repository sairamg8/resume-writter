import { memo, useCallback, useEffect, useRef, useState } from 'react';
import AtsCheckerPanel from '@/components/AtsCheckerPanel';

/** The pause after the last change before the scan reads the résumé again: the preview's own (PdfPreview). */
const ATS_PAUSE_MS = 250;

// One memoised panel: the dock renders at every keystroke (it reads the résumé), the panel only when what it
// is given changes, which is the résumé after the pause.
const Panel = memo(AtsCheckerPanel);

/**
 * `value`, as it was until it has stayed the same for `ms`: a burst of keys changes it once, after the pause.
 * The scan reads the whole résumé, so it must not run at every key of a section being typed in.
 * The second item is `flush`: it takes the latest value at once, for a press inside the panel (below).
 */
function useSettled(value, ms) {
  const [held, setHeld] = useState(value);
  const latest = useRef(value);
  useEffect(() => { latest.current = value; });
  useEffect(() => {
    if (Object.is(held, value)) return undefined;
    const timer = setTimeout(() => setHeld(value), ms);
    return () => clearTimeout(timer);
  }, [value, held, ms]);
  const flush = useCallback(() => setHeld(latest.current), []);
  return [held, flush];
}

/**
 * The ATS dock's body: AtsCheckerPanel whole, mounted only while the dock is open (so no scan runs while it
 * is closed) and one per résumé (the dock keys it by the résumé's id: the job description kept for one is
 * never shown under another). The résumé it scans is the one after the pause (`useSettled`), so typing in a
 * section renders the panel 0 times in that commit and once after it. `store`: the store's actions as stable
 * functions (useStableActions), what the panel's fixes write through.
 * The panel's buttons write from the résumé they were drawn with, so a press inside the dock first takes the
 * latest résumé (a capture-phase pointerdown or keydown, before the click it leads to): two quick "+" on
 * missing keywords then add both to the Skills section, not the second to what was there before the first.
 * `contents`: the wrapper takes no box of its own.
 */
export const AtsDock = memo(function AtsDock({ resume, store }) {
  const [shown, flush] = useSettled(resume, ATS_PAUSE_MS);
  return (
    <div data-testid="ats-dock-body" className="contents" onPointerDownCapture={flush} onKeyDownCapture={flush}>
      <Panel resume={shown} store={store} />
    </div>
  );
});
