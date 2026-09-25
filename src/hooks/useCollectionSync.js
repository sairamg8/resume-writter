import { useEffect, useState } from 'react';
import {
  arrayRemove, arrayUnion, collection, doc, getDocFromServer, getDocsFromServer, writeBatch,
} from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { collectionIo } from '@/utils/collectionSyncIo';
import { createCollectionSync } from '@/utils/collectionSyncEngine';
import { BOARDS_SYNC_KEY, JOBS_SYNC_KEY, localMeta, syncHeld } from '@/utils/collectionSyncMeta';
import { browserCloudSync } from '@/utils/cloudSyncBrowser';
import { completeJob, readJob } from '@/utils/normalizeJob';
import { completeBoard, readBoard } from '@/utils/normalizeBoard';
import { isUntouchedDemoJob } from '@/utils/jobEdits';
import { isUntouchedDemoBoard } from '@/utils/boardDemo';
import { jobsNow, replaceJobs, subscribe as subscribeJobs } from '@/hooks/useJobStore';
import { boardsNow, replaceBoards, subscribe as subscribeBoards } from '@/hooks/useBoardStore';

const fs = { collection, doc, getDocsFromServer, getDocFromServer, writeBatch, arrayUnion, arrayRemove };

/** A cloud copy as the store would load it from storage (readJob / readBoard); null when it is not one. */
const fromCloud = (read, complete) => (d) => {
  const { kept } = read(d);
  return kept ? complete(kept) : null;
};

/**
 * The Job Tracker's jobs and the boards as the cloud sync (collectionSyncEngine.js) reaches them:
 * the store's list, this browser's record of it, and the real Firestore calls (null in a build
 * without a cloud). Exported so the tests build the same stores.
 */
export const jobSync = {
  name: 'jobs',
  store: {
    items: jobsNow, replace: replaceJobs, subscribe: subscribeJobs,
    fromCloud: fromCloud(readJob, completeJob),
    label: (j) => [j.company, j.role].filter(Boolean).join(' — ') || 'Untitled job',
    seed: isUntouchedDemoJob,
  },
  meta: () => localMeta(JOBS_SYNC_KEY),
};

export const boardSync = {
  name: 'boards',
  store: {
    items: boardsNow, replace: replaceBoards, subscribe: subscribeBoards,
    fromCloud: fromCloud(readBoard, completeBoard),
    label: (b) => b.title || 'Untitled project',
    seed: isUntouchedDemoBoard,
  },
  meta: () => localMeta(BOARDS_SYNC_KEY),
};

/**
 * One list's cloud sync wired to the page (cloudSyncBrowser.js): the signed-in user and the
 * browser's online flag go in; the items the cloud will not take go to syncHeld, which the job and
 * board pages show (SyncHeldNotice). Signed out, it does nothing: the list stays this browser's.
 */
export function useCollectionSync(user, { name, store, meta }) {
  const [page] = useState(() => browserCloudSync(window, {
    name, store, meta: meta(),
    io: db ? collectionIo(fs, db, name) : null,
    report: { held: (list) => syncHeld.set(name, list) },
    log: (...args) => console.info(...args),
  }, createCollectionSync));
  const [isOnline, setIsOnline] = useState(() => page.online());

  useEffect(() => page.watch(setIsOnline), [page]);

  useEffect(() => {
    page.sync.start(user);
    return () => page.sync.cancel();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, isOnline]);
}
