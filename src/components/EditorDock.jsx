import { useDeferredValue, useLayoutEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { DesignDock } from '@/components/DesignDock';
import { AtsDock } from '@/components/AtsDock';

const TITLES = { design: 'Design & Customize', ats: 'ATS check' };

/**
 * The one dock on the editor's right: Design or ATS (`dock`), mounted only while one is open, after the
 * preview as a sibling that does not shrink (360 px). One at a time: another dock replaces this one.
 * Its width is never animated (the preview repaints at every frame of a resize). From 1100 px down it
 * overlays the preview instead of narrowing it, by CSS alone (the classes below; the close X shows there,
 * where the Design button of the bar is under the sheet), and on a phone it is the whole screen.
 * It has a scroll box of its own that goes back to the top when the dock changes, as the editor panel's does
 * for a document. It reads the résumé through a deferred value: the panels are memoised, so a keystroke in
 * a section renders them 0 times in its own commit. Opened by the bar's chip and button, `?dock=` and the
 * phone's pill; the Editor owns what it shows (`design`, `store`), no router hook here.
 */
export function EditorDock({ dock, resume, design, store, onClose }) {
  const shown = useDeferredValue(resume);
  const box = useRef(null);
  useLayoutEffect(() => {
    if (box.current) box.current.scrollTop = 0;
  }, [dock]);

  return (
    <aside
      data-testid={`dock-${dock}`}
      className="shrink-0 w-[360px] max-w-full h-full min-h-0 flex flex-col bg-cv-surface border-l border-cv-hairline max-md:w-full max-[1099px]:absolute max-[1099px]:inset-y-0 max-[1099px]:right-0 max-[1099px]:z-30 max-[1099px]:shadow-xl"
    >
      <div className="shrink-0 h-12 px-4 flex items-center justify-between gap-2 border-b border-cv-hairline">
        <h2 className="text-sm font-semibold text-cv-ink truncate">{TITLES[dock]}</h2>
        <button onClick={onClose} title="Close" data-testid="dock-close" className="min-[1100px]:hidden p-1.5 rounded-cv-control text-cv-muted hover:text-cv-ink hover:bg-cv-sunken transition-colors">
          <X size={16} />
        </button>
      </div>
      {/* Below md a phone's Edit | Preview pill floats over the foot of this box: 64px clear, as the editor panel's. */}
      <div ref={box} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4 max-md:pb-16" style={{ overscrollBehavior: 'contain' }}>
        {dock === 'design' && <DesignDock resume={shown} design={design} />}
        {dock === 'ats' && <AtsDock key={resume.id} resume={resume} store={store} />}
      </div>
    </aside>
  );
}
