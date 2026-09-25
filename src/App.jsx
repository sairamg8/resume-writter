import { useAppStore } from '@/hooks/useResumeStore';
import { useAuth } from '@/hooks/useAuth';
import { useCloudSync } from '@/hooks/useCloudSync';
import { boardSync, jobSync, useCollectionSync } from '@/hooks/useCollectionSync';
import { useDemoSeed } from '@/hooks/useDemoSeed';
import { AppRoutes } from '@/AppRoutes';

export default function App() {
  const store = useAppStore();
  const auth  = useAuth();
  const sync  = useCloudSync({ user: auth.user, appState: store.appState, store });
  const seed  = useDemoSeed({ user: auth.user, appState: store.appState, store, sync });
  // The Job Tracker's jobs and the boards sync with the signed-in account too (R2-145, R2-140).
  useCollectionSync(auth.user, jobSync);
  useCollectionSync(auth.user, boardSync);

  return <AppRoutes store={store} auth={auth} sync={sync} seed={seed} />;
}
