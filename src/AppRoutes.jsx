import { useCallback, useLayoutEffect, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigationType } from 'react-router-dom';
import { Dashboard } from '@/pages/Dashboard';
import { Editor } from '@/pages/Editor';
import { JobTracker } from '@/pages/JobTracker';
import { JobDetail } from '@/pages/JobDetail';
import { JobForm } from '@/pages/JobForm';
import { Boards } from '@/pages/Boards';
import { Board } from '@/pages/Board';
import { Backlog } from '@/pages/Backlog';
import { BoardSettings } from '@/pages/BoardSettings';
import { YourWork } from '@/pages/YourWork';
import TermsPage from '@/pages/TermsPage';
import PrivacyPage from '@/pages/PrivacyPage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { WorkspaceLayout, sidebarProjects } from '@/components/shell';
import { CreateIssueDialog } from '@/components/board/CreateIssueDialog';
import { useBoardStore } from '@/hooks/useBoardStore';
import { searchWorkspace } from '@/utils/workspaceSearch';

const renderCreate = (props) => <CreateIssueDialog {...props} />;

/**
 * The workspace shell (top bar, sidebar, scrolling main) as a layout route, its sidebar's projects,
 * its quick search and its Create dialog reading the board store. Only the workspace pages mount
 * it, so the résumé dashboard and editor never load the boards. The mapping reads v1 and v2 boards
 * alike (shell/projects.js).
 */
export function WorkspaceRoute() {
  const { boards } = useBoardStore();
  const projects = useMemo(() => sidebarProjects(boards), [boards]);
  const search = useCallback((query) => searchWorkspace(boards, query), [boards]);
  return <WorkspaceLayout projects={projects} search={search} renderCreate={renderCreate} />;
}

/**
 * Around every page: a new path gets a fresh ErrorBoundary — one page's crash used to stay on
 * screen through Back and every link until a reload (R2-072) — and opens at the top of the window,
 * which HashRouter never resets: the Privacy Policy opened from the dashboard's footer showed its
 * end (R2-073). Back and Forward leave the scroll to the browser, and a change of the search alone
 * (the editor's ?tab=) is not a new page. The workspace pages scroll their own <main>
 * (useScrollMemory).
 */
function RouteFrame({ children }) {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  useLayoutEffect(() => {
    if (navigationType !== 'POP') window.scrollTo(0, 0);
    // Only a new path moves the scroll; the way we came is read with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
}

/**
 * What each page gets from the app's state (App.jsx): the résumé store, the account, the cloud
 * sync and the demo restore (`seed`) — the dashboard says when the originals wait for the
 * account's cloud (seed.waiting). tests/pdf/18-cloud-sync-waiting-notice.test.mjs renders it.
 *
 * The Job Tracker and Boards pages sit inside the workspace shell (WorkspaceRoute); the résumé and
 * legal pages keep their own full-page layouts. tests/unit/ui-shell.unit.mjs checks which paths
 * are inside the shell.
 */
export function AppRoutes({ store, auth, sync, seed }) {
  return (
    <RouteFrame>
      <Routes>
        <Route path="/"           element={<Dashboard store={store} auth={auth} sync={sync} originalsWaiting={seed.waiting} />} />
        <Route path="/resume/:id" element={<Editor    store={store} auth={auth} sync={sync} />} />
        <Route element={<WorkspaceRoute />}>
          <Route path="/jobs"                element={<JobTracker store={store} />} />
          <Route path="/jobs/new"            element={<JobForm    store={store} />} />
          <Route path="/jobs/:id/edit"       element={<JobForm    store={store} />} />
          <Route path="/jobs/:id"            element={<JobDetail  store={store} />} />
          <Route path="/boards"              element={<Boards />} />
          <Route path="/work"                element={<YourWork />} />
          <Route path="/boards/:id"          element={<Board />} />
          <Route path="/boards/:id/backlog"  element={<Backlog />} />
          <Route path="/boards/:id/settings" element={<BoardSettings />} />
        </Route>
        <Route path="/terms"      element={<TermsPage />} />
        <Route path="/privacy"    element={<PrivacyPage />} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </RouteFrame>
  );
}
