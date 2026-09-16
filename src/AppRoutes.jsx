import { Routes, Route, Navigate } from 'react-router-dom';
import { Dashboard } from '@/pages/Dashboard';
import { Editor } from '@/pages/Editor';
import { JobTracker } from '@/pages/JobTracker';
import { JobDetail } from '@/pages/JobDetail';
import { JobForm } from '@/pages/JobForm';
import TermsPage from '@/pages/TermsPage';
import PrivacyPage from '@/pages/PrivacyPage';

/**
 * What each page gets from the app's state (App.jsx): the résumé store, the account, the cloud
 * sync and the demo restore (`seed`) — the dashboard says when the originals wait for the
 * account's cloud (seed.waiting). tests/pdf/18-cloud-sync-waiting-notice.test.mjs renders it.
 */
export function AppRoutes({ store, auth, sync, seed }) {
  return (
    <Routes>
      <Route path="/"           element={<Dashboard store={store} auth={auth} sync={sync} originalsWaiting={seed.waiting} />} />
      <Route path="/resume/:id" element={<Editor    store={store} auth={auth} sync={sync} />} />
      <Route path="/jobs"          element={<JobTracker store={store} />} />
      <Route path="/jobs/new"      element={<JobForm    store={store} />} />
      <Route path="/jobs/:id/edit" element={<JobForm    store={store} />} />
      <Route path="/jobs/:id"      element={<JobDetail  store={store} />} />
      <Route path="/terms"      element={<TermsPage />} />
      <Route path="/privacy"    element={<PrivacyPage />} />
      <Route path="*"           element={<Navigate to="/" replace />} />
    </Routes>
  );
}
