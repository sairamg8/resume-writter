import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/** How long an address for a résumé this browser lacks waits for the account's first sync. */
export const OPEN_WAIT_MS = 8000;

/**
 * The editor's résumé: the one in the address (`id`) is made the store's open one, and the page
 * goes back to the dashboard once it is not in the store — never there, or deleted meanwhile in
 * another tab (the store takes that tab's saves). It looked only when the address changed, so a
 * résumé deleted in another tab left the editor showing the next one, and taking its edits, under
 * the deleted one's address (bug audit 2026-09-22). It looks again whenever the store's open one is
 * not the address's, too: an import that finishes after the user opened another résumé adds its
 * résumé as the open one (importResume) without going to it, and the editor went on showing — and
 * editing — the imported résumé under this one's address (R5-HUNT1-LATE-IMPORT-HIJACKS-OPEN-EDITOR).
 * Returns true while it waits for the first sync (the page shows its loading state, not another résumé).
 */
export function useOpenResume(store, id, auth, sync, waitMs = OPEN_WAIT_MS) {
  const navigate = useNavigate();
  const exists = store.appState.resumes.some((r) => r.id === id);
  const activeId = store.appState.activeId;
  // An address opened on an empty second device right after sign-in names a résumé the first sync has
  // not brought yet: the page waits for the account (being restored, or its first sync not answered)
  // instead of going home at once. No account, no cloud, offline or a failed sync answer already, and
  // the wait is bounded, so a sync that never answers cannot hold the user on "Loading".
  const user = auth?.user;
  const waiting = Boolean(auth?.authLoading)
    || Boolean(user && sync && sync.account?.uid !== user.uid && (sync.syncStatus === 'idle' || sync.syncStatus === 'syncing'));
  const [gaveUpOn, setGaveUpOn] = useState(null);
  const pending = Boolean(id) && !exists && waiting && gaveUpOn !== id;
  useEffect(() => {
    if (!pending) return undefined;
    const timer = setTimeout(() => setGaveUpOn(id), waitMs);
    return () => clearTimeout(timer);
  }, [pending, id, waitMs]);
  useEffect(() => {
    if (!id || pending) return;
    if (!exists) navigate('/', { replace: true });
    else if (activeId !== id) store.setActiveId(id);
  }, [id, exists, activeId, pending]);
  return pending;
}
