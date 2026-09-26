import { useRef } from 'react';
import { Portal, cx, useFocusTrap, usePresence, useScrollLock } from '../ui/index.js';
import { SidebarContent } from './SidebarContent.jsx';

/**
 * The workspace's navigation.
 *
 * - md and up: a column beside the page, 248 px, or a 64 px icon rail when `collapsed` (the width
 *   eases over 200 ms; the layout keeps the choice in localStorage).
 * - below md: nothing in the flow — a drawer that slides in from the left over a dimmed page when
 *   `drawerOpen` (220 ms), a modal dialog with focus kept inside and the page behind held still;
 *   Escape, the overlay, the close button or following a link closes it, and focus returns to the
 *   menu button.
 */
export function Sidebar({ projects, collapsed, onToggleCollapsed, drawerOpen, onCloseDrawer, newProjectTo }) {
  const { mounted, state } = usePresence(drawerOpen, 180);
  const drawerRef = useRef(null);
  const onTrapKeyDown = useFocusTrap(drawerRef, drawerOpen && mounted);
  useScrollLock(mounted);

  return (
    <>
      <aside
        aria-label="Sidebar"
        className={cx(
          'hidden shrink-0 border-r border-line bg-white transition-[width] duration-200 ease-out md:block',
          collapsed ? 'w-16' : 'w-[240px]',
        )}
      >
        <SidebarContent projects={projects} collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} newProjectTo={newProjectTo} />
      </aside>

      {mounted && (
        <Portal>
          <div
            className="fixed inset-0 z-50 md:hidden"
            onKeyDown={(event) => {
              onTrapKeyDown(event);
              if (event.key === 'Escape') {
                event.stopPropagation();
                onCloseDrawer();
              }
            }}
          >
            <div
              aria-hidden="true"
              onClick={onCloseDrawer}
              className={cx('absolute inset-0 bg-slate-900/40', state === 'open' ? 'animate-ui-fade-in' : 'animate-ui-fade-out')}
            />
            <div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              tabIndex={-1}
              className={cx(
                'absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-white shadow-xl outline-none',
                state === 'open' ? 'animate-ui-drawer-in' : 'animate-ui-drawer-out',
              )}
            >
              <SidebarContent projects={projects} onClose={onCloseDrawer} newProjectTo={newProjectTo} />
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
