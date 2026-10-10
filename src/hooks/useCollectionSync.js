import { useEffect, useState } from 'react';
import { db } from '@/utils/firebase';
import { BOARDS_SYNC_KEY, JOBS_SYNC_KEY, collectionReport, localMeta } from '@/utils/collectionSyncMeta';
import { browserCloudSync } from '@/utils/cloudSyncBrowser';
import { lazyCollectionSync } from '@/utils/collectionSyncLazy';

/**
 * The sync engine and everything it needs (the stores' wiring, the real Firestore calls, the plan, the
 * conflict copies) is one lazy module: it is fetched when a user first signs in, not with the page.
 */
const createSync = lazyCollectionSync(() => import('@/utils/collectionSyncLoaded').then((m) => m.createListSync));

/**
 * The Job Tracker's jobs and the boards as the cloud sync (collectionSyncEngine.js) reaches them: the
 * list's name and this browser's record of it. Its store is wired in collectionSyncLoaded.js.
 */
export const jobSync = { name: 'jobs', meta: () => localMeta(JOBS_SYNC_KEY) };

export const boardSync = { name: 'boards', meta: () => localMeta(BOARDS_SYNC_KEY) };

/**
 * One list's cloud sync wired to the page (cloudSyncBrowser.js): the signed-in user and the
 * browser's online flag go in; the items the cloud will not take go to syncHeld, which the job and
 * board pages show (SyncHeldNotice), and what the sync is doing to collectionSyncStatus, which the
 * workspace's top bar shows as the résumés' cloud icon (CollectionSyncDot). Signed out, it does
 * nothing: the list stays this browser's.
 */
export function useCollectionSync(user, { name, meta }) {
  const [page] = useState(() => browserCloudSync(window, {
    name, meta: meta(),
    cloud: Boolean(db),
    report: collectionReport(name),
    log: (...args) => console.info(...args),
  }, createSync));
  const [isOnline, setIsOnline] = useState(() => page.online());

  useEffect(() => page.watch(setIsOnline), [page]);

  useEffect(() => {
    page.sync.start(user);
    return () => page.sync.cancel();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, isOnline]);
}
