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
    /* Independent scroll; overscroll-behavior blocks scroll chaining to body */
    <div
      ref={box}
      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
      style={{ overscrollBehavior: 'contain' }}
    >
      {children}
    </div>
  );
}
