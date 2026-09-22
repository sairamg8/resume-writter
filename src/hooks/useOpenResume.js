import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * The editor's résumé: the one in the address (`id`) is made the store's open one, and the page
 * goes back to the dashboard once it is not in the store — never there, or deleted meanwhile in
 * another tab (the store takes that tab's saves). It looked only when the address changed, so a
 * résumé deleted in another tab left the editor showing the next one, and taking its edits, under
 * the deleted one's address (bug audit 2026-09-22).
 */
export function useOpenResume(store, id) {
  const navigate = useNavigate();
  const exists = store.appState.resumes.some((r) => r.id === id);
  useEffect(() => {
    if (!id) return;
    if (!exists) navigate('/', { replace: true });
    else if (store.appState.activeId !== id) store.setActiveId(id);
  }, [id, exists]);
}
