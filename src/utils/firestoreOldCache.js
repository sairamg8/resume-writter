// The Firestore cache on disk (R2-005). Until R2-005 the app ran Firestore with its persistent
// IndexedDB cache: every account ever signed in on a browser left its résumé documents there
// after signing out — on a shared or public computer, readable by whoever came next — and the
// SDK clears none of it at a sign-out (it only swaps the pending-write queue).
// The app never reads that cache: every read asks the server (cloudSyncIo.js), and what a flush
// could not send the résumé store keeps and the next first sync sends (cloudSyncEngine.js). So
// Firestore now keeps its cache in memory only (firebase.js), and the database an earlier build
// left is deleted at startup — best effort: while a tab of that build still has it open, the
// browser deletes it once that tab closes.

/** The IndexedDB database Firestore's persistent cache used for the default app of `projectId`. */
export const oldCacheName = (projectId) => `firestore/[DEFAULT]/${projectId}/main`;

/**
 * Ask `idb` (the page's indexedDB) to delete the cache an earlier build left for `projectId`.
 * Never throws and never waits: true when the deletion was asked for.
 */
export function forgetOldCache(idb, projectId) {
  if (!projectId || typeof idb?.deleteDatabase !== 'function') return false;
  try {
    const request = idb.deleteDatabase(oldCacheName(projectId));
    if (request && typeof request === 'object') {
      request.onerror = () => {};
      request.onblocked = () => {};
    }
    return true;
  } catch {
    return false;
  }
}
