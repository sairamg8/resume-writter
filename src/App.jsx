import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from '@/hooks/useResumeStore';
import { useAuth } from '@/hooks/useAuth';
import { useCloudSync } from '@/hooks/useCloudSync';
import { Dashboard } from '@/pages/Dashboard';
import { Editor } from '@/pages/Editor';
import { JobTracker } from '@/pages/JobTracker';
import { JobDetail } from '@/pages/JobDetail';
import { JobForm } from '@/pages/JobForm';
import TermsPage from '@/pages/TermsPage';
import PrivacyPage from '@/pages/PrivacyPage';

function AppRoutes() {
  const store = useAppStore();
  const auth  = useAuth();
  const sync  = useCloudSync({ user: auth.user, appState: store.appState, store });

  return (
    <Routes>
      <Route path="/"           element={<Dashboard store={store} auth={auth} sync={sync} />} />
      <Route path="/resume/:id" element={<Editor    store={store} auth={auth} sync={sync} />} />
      <Route path="/jobs"          element={<JobTracker />} />
      <Route path="/jobs/new"      element={<JobForm />} />
      <Route path="/jobs/:id/edit" element={<JobForm />} />
      <Route path="/jobs/:id"      element={<JobDetail />} />
      <Route path="/terms"      element={<TermsPage />} />
      <Route path="/privacy"    element={<PrivacyPage />} />
      <Route path="*"           element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}
