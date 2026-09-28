import { useLayoutEffect, useRef } from 'react';

/**
 * The editor panel's scrolling body. The Résumé, Design and Cover Letter tabs all show in this
 * one box, so a tab change puts it back at the top: each tab opens at its own start — Design at
 * Template, the Résumé at Collapse/Expand All — not at the offset the last tab was scrolled to.
 * Only a tab change does: an edit re-renders the editor and keeps the scroll where it is.
 * A layout effect, so the new tab is never painted at the old offset first.
 */
export function EditorTabContent({ activeTab, children }) {
  const box = useRef(null);
  useLayoutEffect(() => {
    if (box.current) box.current.scrollTop = 0;
  }, [activeTab]);

  return (
    /* Independent scroll; overscroll-behavior blocks scroll chaining to body. Below md a phone's
       Edit | Preview pill (Editor.jsx) floats over the foot of this box, up to 54px from the
       bottom: the 64px under every tab lets its last field scroll clear of the pill (R4-DPH-31). */
    <div
      ref={box}
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden max-md:pb-16"
      style={{ overscrollBehavior: 'contain' }}
    >
      {children}
    </div>
  );
}
