import { useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from '@/pages/Dashboard';
import { Editor } from '@/pages/Editor';
import { JobTracker } from '@/pages/JobTracker';
import { JobDetail } from '@/pages/JobDetail';
import { JobForm } from '@/pages/JobForm';
import { Boards } from '@/pages/Boards';
import { Board } from '@/pages/Board';
import TermsPage from '@/pages/TermsPage';
import PrivacyPage from '@/pages/PrivacyPage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { WorkspaceLayout, sidebarProjects, YourWorkPlaceholder, ProjectViewPlaceholder } from '@/components/shell';
import { useBoardStore } from '@/hooks/useBoardStore';

/**
 * The workspace shell (sidebar + scrolling main) as a layout route, its sidebar's projects read
 * from the board store. Only the workspace pages mount it, so the résumé dashboard and editor never
 * load the boards. The mapping reads v1 and v2 boards alike (shell/projects.js).
 */
export function WorkspaceRoute() {
  const { boards } = useBoardStore();
  const projects = useMemo(() => sidebarProjects(boards), [boards]);
  return <WorkspaceLayout projects={projects} />;
}

/**
 * What each page gets from the app's state (App.jsx): the résumé store, the account, the cloud
 * sync and the demo restore (`seed`) — the dashboard says when the originals wait for the
 * account's cloud (seed.waiting). tests/pdf/18-cloud-sync-waiting-notice.test.mjs renders it.
 *
 * The Job Tracker and Boards pages sit inside the workspace shell (WorkspaceRoute); the résumé and
 * legal pages keep their own full-page layouts. /work and a project's backlog and settings show a
 * placeholder in the shell until their own pages replace them (docs/tracking/boards-jobs-plan/01, Routes);
 * tests/unit/ui-shell.unit.mjs checks which paths are inside the shell.
 */
export function AppRoutes({ store, auth, sync, seed }) {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/"           element={<Dashboard store={store} auth={auth} sync={sync} originalsWaiting={seed.waiting} />} />
        <Route path="/resume/:id" element={<Editor    store={store} auth={auth} sync={sync} />} />
        <Route element={<WorkspaceRoute />}>
          <Route path="/jobs"                element={<JobTracker store={store} />} />
          <Route path="/jobs/new"            element={<JobForm    store={store} />} />
          <Route path="/jobs/:id/edit"       element={<JobForm    store={store} />} />
          <Route path="/jobs/:id"            element={<JobDetail  store={store} />} />
          <Route path="/boards"              element={<Boards />} />
          <Route path="/work"                element={<YourWorkPlaceholder />} />
          <Route path="/boards/:id"          element={<Board />} />
          <Route path="/boards/:id/backlog"  element={<ProjectViewPlaceholder view="backlog" />} />
          <Route path="/boards/:id/settings" element={<ProjectViewPlaceholder view="settings" />} />
        </Route>
        <Route path="/terms"      element={<TermsPage />} />
        <Route path="/privacy"    element={<PrivacyPage />} />
        <Route path="*"           element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
