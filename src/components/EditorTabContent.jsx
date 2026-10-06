import { useLayoutEffect, useRef } from 'react';

/**
 * The editor panel's scrolling body, with the content of the open document (`activeTab`: 'resume' or
 * 'coverletter'; Design and ATS are docks with a scroll box of their own, EditorDock). The Résumé and the
 * Cover Letter both show in this one box, so a switch puts it back at the top: each opens at its own start
 * — the Résumé at Collapse/Expand All — not at the offset the last one was scrolled to.
 * Only a switch does: an edit re-renders the editor and keeps the scroll where it is, and so does a dock
 * opening or closing. A layout effect, so the new document is never painted at the old offset first.
 */
export function EditorTabContent({ activeTab, children }) {
  const box = useRef(null);
  useLayoutEffect(() => {
    if (box.current) box.current.scrollTop = 0;
  }, [activeTab]);

  return (
    /* Independent scroll; overscroll-behavior blocks scroll chaining to body. Below md a phone's
       Edit | Preview pill (Editor.jsx) floats over the foot of this box, up to 54px from the
       bottom: the 64px under every document lets its last field scroll clear of the pill (R4-DPH-31). */
    <div
      ref={box}
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden max-md:pb-16"
      style={{ overscrollBehavior: 'contain' }}
    >
      {children}
    </div>
  );
}
