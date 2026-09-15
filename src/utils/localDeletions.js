// The résumés deleted in this browser, as the store keeps them for the cloud sync — plain data in
// and out, no imports, so Node's test runner loads this file as it is
// (tests/unit/local-deletions.unit.mjs).
//
//   deletedIds   the ids, as every build has saved them
//   deletedInfo  id → { version, at }: `version` the updatedAt of the copy deleted, `at` when.
//                A parallel map, so a store saved by an older build (ids only) still loads, and
//                one saved by this build still loads in an older one.
// An entry stays until the account's cloud has the deletion: a flush that sent it forgets it
// (R8-1), and so does a restore. The first sync sends one only when the account's copy is not
// newer than the version deleted: a deletion made offline must never remove an edit made later
// on another device (R8-0). An entry with no version (an older build's) cannot be checked, so it
// is never sent.

const isInfo = (v) => Boolean(v && typeof v === 'object' && !Array.isArray(v));

/** The store's deletions as entries { id, version, at } — version null for an older build's. */
export function deletionEntries(state) {
  const info = isInfo(state?.deletedInfo) ? state.deletedInfo : {};
  const ids = Array.isArray(state?.deletedIds) ? state.deletedIds : [];
  return [...new Set(ids.filter((id) => typeof id === 'string' && id))].map((id) => {
    const i = isInfo(info[id]) ? info[id] : {};
    return {
      id,
      version: Number.isFinite(i.version) ? i.version : null,
      at: Number.isFinite(i.at) ? i.at : 0,
    };
  });
}

/** The deletion fields after `resume` is deleted at `now`: its id and the version deleted. */
export function withDeletion(state, resume, now) {
  const { id } = resume;
  const info = isInfo(state.deletedInfo) ? state.deletedInfo : {};
  return {
    deletedIds: [...(state.deletedIds || []).filter((d) => d !== id), id],
    deletedInfo: { ...info, [id]: { version: Number.isFinite(resume.updatedAt) ? resume.updatedAt : 0, at: now } },
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

/** The deletion fields of a saved store as this build keeps them (anything unreadable dropped). */
export function savedDeletions(saved) {
  const entries = deletionEntries(saved);
  return {
    deletedIds: entries.map((e) => e.id),
    deletedInfo: Object.fromEntries(entries.filter((e) => e.version !== null).map(({ id, version, at }) => [id, { version, at }])),
  };
}
