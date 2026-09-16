import { useEffect, useRef, useState } from 'react';
import {
  arrayUnion, collection, doc, getDocFromServer, getDocsFromServer, writeBatch,
} from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { isDemoAccount } from '@/utils/demoSeed';
import { DEMO_ACCOUNTS } from '@/utils/demoAccounts';
import { cloudIo } from '@/utils/cloudSyncIo';
import { browserCloudSync } from '@/utils/cloudSyncBrowser';
import { liveStore } from '@/hooks/useResumeSyncActions';

/** The real Firestore calls (cloudSyncIo); null in a build without a cloud. */
const io = db
  ? cloudIo({ collection, doc, getDocsFromServer, getDocFromServer, writeBatch, arrayUnion }, db)
  : null;

/**
 * The cloud sync (utils/cloudSyncEngine.js) in this page (utils/cloudSyncBrowser.js) wired to
 * React: the signed-in user, the browser's online flag and every change of the résumé store go
 * in; the sync's status, the time of the last sync and the account (once its list is known) come
 * out. tests/pdf/18-cloud-sync-browser-events.test.mjs mounts it.
 */
export function useCloudSync({ user, appState, store }) {
  // Hook order is fixed — never add/remove hooks conditionally.
  const [syncStatus, setSyncStatus] = useState('idle'); // idle|syncing|synced|offline|error|stopped|off
  const [lastSynced, setLastSynced] = useState(null);
  // Set once the signed-in account's résumé list is known (first sync done, or no cloud to sync
  // with): { uid, cloudOriginals, cloudDeleted } — the cloud's originals (demoSeed.js), deleted
  // ones included, and its deletion list.
  const [account, setAccount] = useState(null);
  // The résumés the cloud will not take, held back on their own (cloudSyncHeld.js): [{ id, name }].
  const [heldResumes, setHeldResumes] = useState([]);

  // The store as of the last render, for the sync to read and call when it needs to.
  const latest = useRef({ appState, store });
  useEffect(() => { latest.current = { appState, store }; });

  // The sync, reading this page's online flag and whether its tab is hidden.
  const [page] = useState(() => browserCloudSync(window, {
    io,
    store: liveStore(() => latest.current),
    report: { status: setSyncStatus, synced: setLastSynced, account: setAccount, held: setHeldResumes },
    isDemo: (u) => isDemoAccount(u, DEMO_ACCOUNTS),
    log: (...args) => console.info(...args),
  }));
  const { sync } = page;
  const [isOnline, setIsOnline] = useState(() => page.online());

  // ── Online / offline detection; a retry that came due while the tab was hidden ──
  useEffect(() => page.watch(setIsOnline), [page]);

  // ── Initial sync when user signs in (or comes back online) ────────────────
  useEffect(() => {
    sync.start(user);
    return () => sync.cancel();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, isOnline]);

  // ── Watch for local mutations and debounce-write ──────────────────────────
  useEffect(() => {
    sync.resumesChanged(appState.resumes);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appState.resumes, user]);

  return { syncStatus, lastSynced, isOnline, account, heldResumes, readCloudCopies: sync.readCloudCopies };
}
