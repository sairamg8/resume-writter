// The résumé store's changes that the cloud sync and a demo account's restore depend on — Delete,
// putting résumés back, a first sync's result, forgetting sent deletions — as updaters over the
// store's state, made with its setAppState (useResumeStore), and the store as the sync engine
// reaches it (liveStore, useCloudSync). No React, so the sync tests build their store from this
// very code (tests/pdf/fake-firestore.mjs): a change here is a change there.
import { normalizeResume } from '@/utils/normalizeResume';
import { withDeletion, withoutDeletions } from '@/utils/localDeletions';
import { afterSync } from '@/utils/cloudSyncPlan';
import { leaveAccount as leaving } from '@/utils/cloudSyncLeave';

/** `setAppState(prev => next)` as React's; `now()` → ms, when a deletion is made. */
export function createSyncActions(setAppState, now = () => Date.now()) {
  /**
   * Account `uid`'s cloud has these deletions now (sent by the sync at `before`): its entries are
   * not kept any longer — another account's of the same id still are (localDeletions.js).
   */
  function forgetDeletions(ids, before, uid) {
    setAppState(prev => (ids.some(id => (prev.deletedIds || []).includes(id))
      ? { ...prev, ...withoutDeletions(prev, ids, before, uid) }
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

  /**
   * Remove a résumé; the id and the version deleted are kept for the cloud sync (localDeletions),
   * as a deletion of account `uid` — the one signed in, if any.
   */
  function deleteResume(id, uid = null) {
    setAppState(prev => {
      const gone = prev.resumes.find(r => r.id === id);
      if (!gone) return prev;
      const remaining = prev.resumes.filter(r => r.id !== id);
      const activeId = prev.activeId === id ? (remaining[0]?.id ?? null) : prev.activeId;
      return { ...prev, resumes: remaining, activeId, ...withDeletion(prev, gone, now(), uid) };
    });
  }

  /**
   * Account `uid`'s cloud holds these copies now ({ id: updatedAt }, null: none), as a flush it got
   * sent them: kept for the next visit's first sync, to tell another device's edit from this
   * browser's (cloudSyncLineage.js, R2-004) — only while the list is that account's.
   */
  function noteCloudVersions(uid, versions) {
    setAppState(prev => {
      if (prev.syncedUid !== uid) return prev;
      const next = { ...(prev.cloudVersions || {}) };
      for (const [id, v] of Object.entries(versions)) {
        if (Number.isFinite(v)) next[id] = v;
        else delete next[id];
      }
      return { ...prev, cloudVersions: next };
    });
  }

  /**
   * Account `uid` signed out, or another one signs in: its list leaves this browser — what its
   * cloud does not have yet kept aside for it (cloudSyncLeave.js, R2-005). Nothing when the list
   * is not that account's.
   */
  function leaveAccount(uid) {
    setAppState(prev => leaving(prev, uid));
  }

  return { forgetDeletions, applyCloudSync, restoreResumes, deleteResume, noteCloudVersions, leaveAccount };
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
    forgetDeletions: (ids, before, uid) => latest().store.forgetDeletions(ids, before, uid),
    restoreResumes: (list) => latest().store.restoreResumes(list),
    noteCloudVersions: (uid, versions) => latest().store.noteCloudVersions(uid, versions),
    leaveAccount: (uid) => latest().store.leaveAccount(uid),
  };
}
