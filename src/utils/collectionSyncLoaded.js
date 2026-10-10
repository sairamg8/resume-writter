// The jobs' and the boards' cloud sync as the app wires it: the engine, the real Firestore calls and the two
// lists' stores. The one module that imports the sync engine for the app, and itself imported only by
// import() (useCollectionSync.js, through collectionSyncLazy.js), so the whole sync stack loads when a user
// first signs in, not at start-up (tests/pdf/520-startup-sync-engine-lazy).
import {
  arrayRemove, arrayUnion, collection, doc, getDocFromServer, getDocsFromServer, runTransaction, writeBatch,
} from 'firebase/firestore';
import { db } from '@/utils/firebase';
import { collectionIo } from '@/utils/collectionSyncIo';
import { createCollectionSync } from '@/utils/collectionSyncEngine';
import { completeJob, readJob } from '@/utils/normalizeJob';
import { completeBoard, readBoard } from '@/utils/normalizeBoard';
import { BOARD_COSMETIC, boardConflictCopy, jobConflictCopy } from '@/utils/collectionSyncConflict';
import { DEMO_JOB_ID, isUntouchedDemoJob } from '@/utils/jobEdits';
import { DEMO_BOARD_ID, isUntouchedDemoBoard } from '@/utils/boardDemo';
import { jobsNow, leaveRecovery as leaveJobsRecovery, replaceJobs, savedJobs, subscribe as subscribeJobs } from '@/hooks/useJobStore';
import { boardsNow, leaveRecovery as leaveBoardsRecovery, replaceBoards, savedBoards, subscribe as subscribeBoards } from '@/hooks/boardStoreState';

const fs = { collection, doc, getDocsFromServer, getDocFromServer, writeBatch, runTransaction, arrayUnion, arrayRemove };

/** A cloud copy as the store would load it from storage (readJob / readBoard); null when it is not one. */
const fromCloud = (read, complete) => (d) => {
  const { kept } = read(d);
  return kept ? complete(kept) : null;
};

/**
 * The Job Tracker's jobs and the boards as the cloud sync (collectionSyncEngine.js) reaches them:
 * the store's list and what the engine asks of it. Exported so the tests build the same stores.
 */
export const listStores = {
  jobs: {
    items: jobsNow, saved: savedJobs, replace: replaceJobs, subscribe: subscribeJobs,
    fromCloud: fromCloud(readJob, completeJob),
    label: (j) => [j.company, j.role].filter(Boolean).join(' — ') || 'Untitled job',
    seed: isUntouchedDemoJob, seedIds: [DEMO_JOB_ID],
    conflictCopy: jobConflictCopy,
    leaveRecovery: leaveJobsRecovery,
  },
  boards: {
    items: boardsNow, saved: savedBoards, replace: replaceBoards, subscribe: subscribeBoards,
    fromCloud: fromCloud(readBoard, completeBoard),
    label: (b) => b.title || 'Untitled project',
    seed: isUntouchedDemoBoard, seedIds: [DEMO_BOARD_ID],
    conflictCopy: boardConflictCopy,
    conflictApart: BOARD_COSMETIC,
    leaveRecovery: leaveBoardsRecovery,
  },
};

/** The list `options.name`'s engine over its store and the real Firestore calls (null in a build without a cloud). */
export const createListSync = (options) => createCollectionSync({
  ...options,
  store: listStores[options.name],
  io: db ? collectionIo(fs, db, options.name) : null,
});
