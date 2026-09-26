import { useCallback, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ConfirmProvider, ToastProvider } from '../ui/index.js';
import { ErrorBoundary } from '../ErrorBoundary.jsx';
import { useHotkeys } from '../../hooks/useHotkeys.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { Sidebar } from './Sidebar.jsx';
import { TopBar } from './TopBar.jsx';
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

/**
 * The workspace shell around the Job Tracker and Boards pages (a layout route: the page renders in
 * its <Outlet/>): the TopBar across the window, and under it the Sidebar and a <main> that is the
 * page's scroll box, filling the dynamic viewport (h-dvh, so a phone's collapsing address bar never
 * hides the bottom). A page that wants a fixed height (the board view scrolls sideways itself)
 * makes its root `flex-1 min-h-0`.
 *
 * Mounted once here for every page inside: the toast stack (useToast) and the confirm host
 * (useConfirm). `[` collapses / expands the sidebar. <main> opens every new page at its top and
 * gives Back its old offset (useScrollMemory, J-40).
 *
 * - `projects`: `[{ id, name, key, color, starred, updatedAt }]` for the sidebar's Projects group
 *   (AppRoutes maps them from the board store, shell/projects.js).
 * - `newProjectTo`: where "+ New project" goes ('/boards?create=1').
 * - `renderCreate({ open, defaults, onClose })`: the create-issue dialog, which the top bar's
 *   Create button, the `c` key and any page (`useWorkspace().openCreate(defaults)`) open.
 * - `search(query)`: the top bar's quick search (utils/workspaceSearch over the boards).
 * - `auth`: the account (useAuth), for the top bar's sign-in / account button.
 */
export function WorkspaceLayout({ projects = [], newProjectTo, renderCreate, search, auth }) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  // The drawer belongs to the history entry it was opened on: any navigation closes it — a link to
  // another page, a link to the page it is on (the router replaces the entry: a new key), Back and
  // Forward — and coming Back to the entry it was opened on does not open it again. The entry is its
  // key and its path: HashRouter gives the key 'default' to the first entry and to every address
  // typed into the bar.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const entry = `${location.key} ${location.pathname}`;
  const [drawerEntry, setDrawerEntry] = useState(entry);
  // md and up the drawer is only hidden by CSS: left open, it stayed a modal that turned every
  // shortcut off (useHotkeys) until the next page. Widening the window past it closes it.
  const wide = useMediaQuery('(min-width: 768px)');
  if (drawerEntry !== entry || (wide && drawerOpen)) {
    setDrawerEntry(entry);
    setDrawerOpen(false);
  }
  // The create dialog: null when closed, else the fields it opens with ({ boardId, columnId, … }).
  const [createDefaults, setCreateDefaults] = useState(null);
  const mainRef = useRef(null);
  // A new page opens at the top, Back returns to where it was (J-40 / R2-073).
  const onMainScroll = useScrollMemory(mainRef);

  const toggleCollapsed = () => {
    writeCollapsed(!collapsed);
    setCollapsed(!collapsed);
  };
  useHotkeys({ '[': toggleCollapsed });

  const openNav = useCallback(() => setDrawerOpen(true), []);
  const closeNav = useCallback(() => setDrawerOpen(false), []);
  const openCreate = useCallback((defaults = {}) => setCreateDefaults(defaults), []);
  const workspace = useMemo(
    () => ({ openNav, closeNav, openCreate, projects }),
    [openNav, closeNav, openCreate, projects],
  );

  return (
    <WorkspaceContext.Provider value={workspace}>
      <ToastProvider>
        <ConfirmProvider>
          <div data-ui-motion="" className="flex h-dvh flex-col overflow-hidden bg-white text-ink">
            <button
              type="button"
              onClick={() => mainRef.current?.focus()}
              className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2 focus-visible:z-[100] focus-visible:rounded-lg focus-visible:bg-white focus-visible:px-3 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:shadow-lg focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:outline-none"
            >
              Skip to content
            </button>
            <TopBar projects={projects} onCreate={() => openCreate({})} search={search} auth={auth} />
            <div className="flex min-h-0 flex-1">
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
              {/* A page that crashes takes only itself down: the sidebar still leads elsewhere,
                  and the next path starts with a fresh boundary. */}
              <ErrorBoundary key={location.pathname}>
                <Outlet />
              </ErrorBoundary>
            </main>
            </div>
            {renderCreate?.({ open: createDefaults !== null, defaults: createDefaults ?? {}, onClose: () => setCreateDefaults(null) })}
          </div>
        </ConfirmProvider>
      </ToastProvider>
    </WorkspaceContext.Provider>
  );
}
