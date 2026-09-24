import { useCallback, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { ConfirmProvider, IconButton, ToastProvider } from '../ui/index.js';
import { ErrorBoundary } from '../ErrorBoundary.jsx';
import { useHotkeys } from '../../hooks/useHotkeys.js';
import { Sidebar } from './Sidebar.jsx';
import { WorkspaceContext } from './workspaceContext.js';
import { useScrollMemory } from './useScrollMemory.js';

const COLLAPSED_KEY = 'cpwtcv_sidebar_collapsed';

/** The sidebar's remembered width — a preference, so blocked storage just means "expanded". */
function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // Private mode or storage blocked: the choice lasts for this visit only.
  }
}

/** A page without a PageHeader still needs the menu button on a phone: this bar carries it. */
function FallbackTopBar({ onOpenNav }) {
  return (
    <div className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 bg-white/90 px-3 backdrop-blur-md md:hidden">
      <IconButton icon={Menu} label="Open navigation" onClick={onOpenNav} tooltip={false} />
      <span className="text-sm font-semibold tracking-tight text-slate-900">CPWT-CV</span>
    </div>
  );
}

/**
 * The workspace shell around the Job Tracker and Boards pages (a layout route: the page renders in
 * its <Outlet/>): the Sidebar, and a <main> that is the page's scroll box, filling the dynamic
 * viewport (h-dvh, so a phone's collapsing address bar never hides the bottom). A page that wants a
 * fixed height (the board view scrolls sideways itself) makes its root `flex-1 min-h-0`.
 *
 * Mounted once here for every page inside: the toast stack (useToast) and the confirm host
 * (useConfirm). `[` collapses / expands the sidebar. <main> opens every new page at its top and
 * gives Back its old offset (useScrollMemory, J-40).
 *
 * - `projects`: `[{ id, name, key, color, starred, updatedAt }]` for the sidebar's Projects group
 *   (AppRoutes maps them from the board store, shell/projects.js).
 * - `newProjectTo`: where "+ New project" goes ('/boards?create=1').
 */
export function WorkspaceLayout({ projects = [], newProjectTo }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  // The drawer belongs to the page it was opened on: following a link closes it, no effect needed.
  const [drawerPath, setDrawerPath] = useState(null);
  const [headers, setHeaders] = useState(0);
  const mainRef = useRef(null);
  // A new page opens at the top, Back returns to where it was (J-40 / R2-073).
  const onMainScroll = useScrollMemory(mainRef);
  const drawerOpen = drawerPath === location.pathname;

  const toggleCollapsed = () => {
    writeCollapsed(!collapsed);
    setCollapsed(!collapsed);
  };
  useHotkeys({ '[': toggleCollapsed });

  const openNav = useCallback(() => setDrawerPath(location.pathname), [location.pathname]);
  const closeNav = useCallback(() => setDrawerPath(null), []);
  const registerHeader = useCallback(() => {
    setHeaders((n) => n + 1);
    return () => setHeaders((n) => n - 1);
  }, []);
  const workspace = useMemo(
    () => ({ openNav, closeNav, registerHeader, projects }),
    [openNav, closeNav, registerHeader, projects],
  );

  return (
    <WorkspaceContext.Provider value={workspace}>
      <ToastProvider>
        <ConfirmProvider>
          <div data-ui-motion="" className="flex h-dvh overflow-hidden bg-slate-50 text-slate-900">
            <button
              type="button"
              onClick={() => mainRef.current?.focus()}
              className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-[100] focus-visible:rounded-lg focus-visible:bg-white focus-visible:px-3 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:shadow-lg focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:outline-none"
            >
              Skip to content
            </button>
            <Sidebar
              projects={projects}
              collapsed={collapsed}
              onToggleCollapsed={toggleCollapsed}
              drawerOpen={drawerOpen}
              onCloseDrawer={closeNav}
              newProjectTo={newProjectTo}
            />
            <main
              ref={mainRef}
              tabIndex={-1}
              onScroll={onMainScroll}
              className="relative flex min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain focus:outline-none"
            >
              {headers === 0 && <FallbackTopBar onOpenNav={openNav} />}
              {/* A page that crashes takes only itself down: the sidebar still leads elsewhere,
                  and the next path starts with a fresh boundary. */}
              <ErrorBoundary key={location.pathname}>
                <Outlet />
              </ErrorBoundary>
            </main>
          </div>
        </ConfirmProvider>
      </ToastProvider>
    </WorkspaceContext.Provider>
  );
}
