// The résumé store's changes that the cloud sync and a demo account's restore depend on — Delete,
// putting résumés back, a first sync's result, forgetting sent deletions — as updaters over the
// store's state, made with its setAppState (useResumeStore), and the store as the sync engine
// reaches it (liveStore, useCloudSync). No React, so the sync tests build their store from this
// very code (tests/pdf/fake-firestore.mjs): a change here is a change there.
import { normalizeResume } from '@/utils/normalizeResume';
import { withDeletion, withoutDeletions } from '@/utils/localDeletions';
import { afterSync } from '@/utils/cloudSyncPlan';

/** `setAppState(prev => next)` as React's; `now()` → ms, when a deletion is made. */
export function createSyncActions(setAppState, now = () => Date.now()) {
  /** The cloud has these deletions now (sent by the sync at `before`): they are not kept any longer. */
  function forgetDeletions(ids, before) {
    setAppState(prev => (ids.some(id => (prev.deletedIds || []).includes(id))
      ? { ...prev, ...withoutDeletions(prev, ids, before) }
      : prev));
  }

  /** A first cloud sync's result, applied to the store as it is now (cloudSyncPlan.afterSync). */
  function applyCloudSync(result) {
    setAppState(prev => afterSync(prev, result));
  }

  /** Put résumés back (replacing any with the same id) and forget that they were deleted. */
  function restoreResumes(list) {
    const ids = new Set(list.map(r => r.id));
    setAppState(prev => {
      const resumes = [...prev.resumes.filter(r => !ids.has(r.id)), ...list.map(normalizeResume)];
      return {
        ...prev,
        resumes,
        activeId: resumes.some(r => r.id === prev.activeId) ? prev.activeId : (resumes[0]?.id ?? null),
        ...withoutDeletions(prev, ids),
      };
    });
  }

  /** Remove a résumé; the id and the version deleted are kept for the cloud sync (localDeletions). */
  function deleteResume(id) {
    setAppState(prev => {
      const gone = prev.resumes.find(r => r.id === id);
      if (!gone) return prev;
      const remaining = prev.resumes.filter(r => r.id !== id);
      const activeId = prev.activeId === id ? (remaining[0]?.id ?? null) : prev.activeId;
      return { ...prev, resumes: remaining, activeId, ...withDeletion(prev, gone, now()) };
    });
  }

  return { forgetDeletions, applyCloudSync, restoreResumes, deleteResume };
}

/**
 * The résumé store as the sync engine reaches it: `latest()` → { appState, store } as of the last
 * render (useCloudSync keeps it in a ref), read when the engine needs it — a first sync reads the
 * state once the account is known, a flush's forgetDeletions reaches the store's own updater.
 */
export function liveStore(latest) {
  return {
    getState: () => latest().appState,
    applyCloudSync: (result) => latest().store.applyCloudSync(result),
    forgetDeletions: (ids, before) => latest().store.forgetDeletions(ids, before),
  };
}
