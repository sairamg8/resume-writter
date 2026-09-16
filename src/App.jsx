import { useAppStore } from '@/hooks/useResumeStore';
import { useAuth } from '@/hooks/useAuth';
import { useCloudSync } from '@/hooks/useCloudSync';
import { useDemoSeed } from '@/hooks/useDemoSeed';
import { AppRoutes } from '@/AppRoutes';

export default function App() {
  const store = useAppStore();
  const auth  = useAuth();
  const sync  = useCloudSync({ user: auth.user, appState: store.appState, store });
  const seed  = useDemoSeed({ user: auth.user, appState: store.appState, store, sync });

  return <AppRoutes store={store} auth={auth} sync={sync} seed={seed} />;
}
