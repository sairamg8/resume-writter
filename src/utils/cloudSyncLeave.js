// Whose résumés a shared browser shows (R2-005). The store's list belongs to the account it was
// last synced with (`syncedUid`). Until R2-005 that list stayed on screen after the account
// signed out — readable and exportable by whoever used the browser next — and the next account's
// first sync merged it into its own cloud (users/B/resumes got A's résumés).
// Now the list leaves this browser with its account — when it signs out, or when another account
// signs in while the list is still the last one's (an earlier build's sign-out, a session ended
// in another tab):
//   - a résumé the account's cloud holds as it is here goes: its next sign-in brings it back;
//   - one with a change that cloud does not have yet (typed within the pause before a flush,
//     offline, or held back as too large) is kept aside for that account (`stashed`), off the
//     dashboard and out of every other account's sync, and its next first sync sends it
//     (cloudSyncEngine.js) — nothing typed is lost;
//   - its deletions still waiting stay as they are: they are that account's (localDeletions.js).
// A list no account synced (syncedUid null: made signed out) is this browser's own and joins
// whoever signs in, as before; a build with no cloud never syncs one, and keeps it — its only copy.
// Plain functions over the store's state: useResumeSyncActions runs them, the engine reads them.

const isMap = (v) => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const isResume = (r) => Boolean(r && typeof r.id === 'string' && r.id);

/**
 * The store once account `uid`'s list leaves this browser (above); `state` itself when the list is
 * not that account's. `cloudVersions` ({ id: updatedAt }, cloudSyncLineage.js) tells what its cloud
 * holds: a résumé with no version known there is kept aside, as a change the cloud may not have.
 */
export function leaveAccount(state, uid) {
  if (!uid || state.syncedUid !== uid) return state;
  const versions = isMap(state.cloudVersions) ? state.cloudVersions : {};
  const unsent = (state.resumes || []).filter((r) => isResume(r) && versions[r.id] !== r.updatedAt);
  const stashed = { ...(isMap(state.stashed) ? state.stashed : {}) };
  if (unsent.length) {
    const was = stashOf(state, uid) || { resumes: [], versions: {} };
    const ids = new Set(unsent.map((r) => r.id));
    const known = unsent.filter((r) => Number.isFinite(versions[r.id])).map((r) => [r.id, versions[r.id]]);
    stashed[uid] = {
      resumes: [...was.resumes.filter((r) => !ids.has(r.id)), ...unsent],
      // The cloud's copy each one was changed from: its next first sync tells another device's
      // edit made meanwhile from this one's (cloudSyncLineage.js, R2-004).
      versions: { ...was.versions, ...Object.fromEntries(known) },
    };
  }
  return { ...state, resumes: [], activeId: null, syncedUid: null, cloudVersions: {}, stashed };
}

/** Account `uid`'s résumés kept aside when its list left: { resumes, versions }, or null — none. */
export function stashOf(state, uid) {
  const entry = isMap(state?.stashed) ? state.stashed[uid] : null;
  const resumes = Array.isArray(entry?.resumes) ? entry.resumes.filter(isResume) : [];
  return resumes.length ? { resumes, versions: isMap(entry.versions) ? entry.versions : {} } : null;
}

/** The `stashed` field without account `uid`'s entry: its résumés are in its list again. */
export function withoutStash(state, uid) {
  if (!isMap(state.stashed) || !(uid in state.stashed)) return {};
  const { [uid]: _gone, ...rest } = state.stashed;
  return { stashed: rest };
}
