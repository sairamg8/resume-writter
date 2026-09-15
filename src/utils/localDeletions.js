// The résumés deleted in this browser, as the store keeps them for the cloud sync — plain data in
// and out, no imports, so Node's test runner loads this file as it is
// (tests/unit/local-deletions.unit.mjs).
//
//   deletedIds   the ids, as every build has saved them
//   deletedInfo  id → { version, at, owner, keep }: `version` the updatedAt of the copy deleted,
//                `at` when, `owner` the account the list was last synced with (the store's
//                `syncedUid`; null before any), `keep` whether that copy was one of the account's
//                originals (demoSeed.js; missing in an older build's entry). A parallel map, so a
//                store saved by an older build (ids only) still loads, and one saved by this build
//                still loads in an older one.
// The list stays in the browser when its account signs out, so a deletion made then is that
// account's: another account's first sync leaves it for that one (R8-6).
// An entry stays until the account's cloud has the deletion: a flush that sent it forgets it
// (R8-1), and so does a restore. The first sync sends one only when the account's copy is not
// newer than the version deleted: a deletion made offline must never remove an edit made later
// on another device (R8-0). An entry with no version (an older build's) cannot be checked, so it
// is never sent.

const isInfo = (v) => Boolean(v && typeof v === 'object' && !Array.isArray(v));

/**
 * The store's deletions as entries { id, version, at, owner, keep } — version null for an older
 * build's, keep null when the entry does not say (the cloud's copy decides, cloudSyncPlan.js).
 */
export function deletionEntries(state) {
  const info = isInfo(state?.deletedInfo) ? state.deletedInfo : {};
  const ids = Array.isArray(state?.deletedIds) ? state.deletedIds : [];
  return [...new Set(ids.filter((id) => typeof id === 'string' && id))].map((id) => {
    const i = isInfo(info[id]) ? info[id] : {};
    return {
      id,
      version: Number.isFinite(i.version) ? i.version : null,
      at: Number.isFinite(i.at) ? i.at : 0,
      owner: typeof i.owner === 'string' && i.owner ? i.owner : null,
      keep: typeof i.keep === 'boolean' ? i.keep : null,
    };
  });
}

/** The deletion fields after `resume` is deleted at `now`: its id, the version deleted, whose, kept or not. */
export function withDeletion(state, resume, now) {
  const { id } = resume;
  const info = isInfo(state.deletedInfo) ? state.deletedInfo : {};
  const version = Number.isFinite(resume.updatedAt) ? resume.updatedAt : 0;
  return {
    deletedIds: [...(state.deletedIds || []).filter((d) => d !== id), id],
    deletedInfo: { ...info, [id]: { version, at: now, owner: state.syncedUid || null, keep: resume.keep === true } },
  };
}

/**
 * The deletion fields without these `ids` (put back, or sent). With `before`, only an entry made
 * at or before that time goes: a résumé deleted again after a flush took the queue — restored,
 * then deleted — still has its newer deletion to send.
 */
export function withoutDeletions(state, ids, before = Infinity) {
  const info = isInfo(state.deletedInfo) ? state.deletedInfo : {};
  const newer = (id) => Number.isFinite(info[id]?.at) && info[id].at > before;
  const drop = new Set([...ids].filter((id) => !newer(id)));
  return {
    deletedIds: (state.deletedIds || []).filter((id) => !drop.has(id)),
    deletedInfo: Object.fromEntries(Object.entries(info).filter(([id]) => !drop.has(id))),
  };
}

/**
 * The deletion fields of a saved store as this build keeps them (anything unreadable dropped),
 * with `syncedUid`: the account the list was last synced with, null when none or unknown.
 */
export function savedDeletions(saved) {
  const entries = deletionEntries(saved);
  return {
    deletedIds: entries.map((e) => e.id),
    deletedInfo: Object.fromEntries(entries.filter((e) => e.version !== null)
      .map(({ id, keep, ...info }) => [id, keep === null ? info : { ...info, keep }])),
    syncedUid: typeof saved?.syncedUid === 'string' && saved.syncedUid ? saved.syncedUid : null,
  };
}
