import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { DesignDock } from '@/components/DesignDock';
import { AtsDock } from '@/components/AtsDock';

const TITLES = { design: 'Design & Customize', ats: 'ATS check' };

const DOCK_WIDTH = 360;
const HANDLE_WIDTH = 4;
/** The least the preview keeps beside a docked panel: the page's own floor (a sheet is drawn from about 290 px). */
const PREVIEW_FLOOR = 288;

/**
 * The window width (px) from which the dock sits beside the preview rather than over it: 1100 px, or, with the editor
 * panel dragged wide (up to 640 px), the width at which the preview still keeps its floor beside the panel, its
 * handle and the dock. `panelWidth` is 0 when the panel takes no room of the split (a layout without it).
 */
export function dockBesideFrom(panelWidth) {
  return Math.max(1100, panelWidth + HANDLE_WIDTH + DOCK_WIDTH + PREVIEW_FLOOR);
}

/**
 * The one dock on the editor's right: Design or ATS (`dock`), mounted only while one is open, after the
 * preview as a sibling that does not shrink (360 px). One at a time: another dock replaces this one.
 * Its width is never animated (the preview repaints at every frame of a resize). From 1100 px down it
 * overlays the preview instead of narrowing it, by CSS alone (the classes below; the close X shows there,
 * where the Design button of the bar is under the sheet), and on a phone it is the whole screen. With the panel
 * dragged wide the preview would be left a sliver between 1100 px and `dockBesideFrom(panelWidth)`: there the Editor
 * says `overlay`, which gives the same classes at any width.
 * It has a scroll box of its own that goes back to the top when the dock changes, as the editor panel's does
 * for a document. The panels are memoised and drawn from what they show (the Design panel from the résumé's id,
 * template, settings and cover letter, the ATS panel from the résumé after a pause), so a keystroke in a section
 * renders neither; their buttons act on the LATEST résumé (`getLatest`, a stable function over a ref), never on
 * the one they were last drawn with. Opened by the bar's chip and button, `?dock=` and the
 * phone's pill; the Editor owns what it shows (`design`, `store`), no router hook here.
 */
export function EditorDock({ dock, resume, design, store, onClose, overlay = false }) {
  const latest = useRef(resume);
  useEffect(() => { latest.current = resume; });
  const getLatest = useCallback(() => latest.current, []);
  const box = useRef(null);
  useLayoutEffect(() => {
    if (box.current) box.current.scrollTop = 0;
  }, [dock]);

  return (
    <aside
      data-testid={`dock-${dock}`}
      className={`shrink-0 w-[360px] max-w-full h-full min-h-0 flex flex-col bg-cv-surface border-l border-cv-hairline max-md:w-full max-[1099px]:absolute max-[1099px]:inset-y-0 max-[1099px]:right-0 max-[1099px]:z-30 max-[1099px]:shadow-xl${overlay ? ' absolute inset-y-0 right-0 z-30 shadow-xl' : ''}`}
    >
      <div className="shrink-0 h-12 px-4 flex items-center justify-between gap-2 border-b border-cv-hairline">
        <h2 className="text-sm font-semibold text-cv-ink truncate">{TITLES[dock]}</h2>
        <button onClick={onClose} title="Close" data-testid="dock-close" className={`${overlay ? '' : 'min-[1100px]:hidden '}p-1.5 rounded-cv-control text-cv-muted hover:text-cv-ink hover:bg-cv-sunken transition-colors`}>
          <X size={16} />
        </button>
      </div>
      {/* Below md a phone's Edit | Preview pill floats over the foot of this box: 64px clear, as the editor panel's. */}
      <div ref={box} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4 max-md:pb-16" style={{ overscrollBehavior: 'contain' }}>
        {dock === 'design' && <DesignDock resume={resume} design={design} getLatest={getLatest} />}
        {dock === 'ats' && <AtsDock key={resume.id} resume={resume} store={store} />}
      </div>
    </aside>
  );
}
