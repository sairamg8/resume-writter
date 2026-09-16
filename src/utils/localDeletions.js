// The résumés deleted in this browser, as the store keeps them for the cloud sync — plain data in
// and out, no imports, so Node's test runner loads this file as it is
// (tests/unit/local-deletions.unit.mjs).
//
//   deletedIds   the ids, as every build has saved them
//   deletedInfo  id → { version, at, owner, keep }: `version` the updatedAt of the copy deleted,
//                `at` when, `owner` the account signed in then — signed out, the one the list was
//                last synced with (the store's `syncedUid`; null before any) — and `keep` whether
//                that copy was one of the account's originals (demoSeed.js; missing in an older
//                build's entry). A parallel map, so a store saved by an older build (ids only)
//                still loads, and one saved by this build still loads in an older one.
// The list stays in the browser when its account signs out, so a deletion made then is that
// account's: another account's first sync leaves it for that one (R8-6). An id can then have a
// deletion of each account — a sample's id is the same in every account, and a résumé carried
// from one account's list into another's keeps its id: deletedInfo[id] is the latest (what every
// build reads), and its `also` holds other accounts' earlier ones still waiting. One account's
// deletion used to replace another's, and its flush forgot both: that account's copy came back
// at its next sign-in (V2VF1S-1).
// An entry stays until the account's cloud has the deletion: a flush that sent it forgets it
// (R8-1), and so does a restore. The first sync sends one only when the account's copy is not
// newer than the version deleted: a deletion made offline must never remove an edit made later
// on another device (R8-0). An entry with no version (an older build's) cannot be checked, so it
// is never sent.

const isInfo = (v) => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const ownerOf = (i) => (typeof i?.owner === 'string' && i.owner ? i.owner : null);
/** deletedInfo[id] and the other accounts' entries kept in its `also`, as saved (unread). */
const savedFor = (i) => (isInfo(i) ? [i, ...(Array.isArray(i.also) ? i.also.filter(isInfo) : [])] : []);
const withoutAlso = ({ also: _also, ...i }) => i;
const atOf = (i) => (Number.isFinite(i.at) ? i.at : 0);

/** One saved entry of `id` as deletionEntries gives it. */
const entryOf = (id, i) => ({
  id,
  version: Number.isFinite(i.version) ? i.version : null,
  at: Number.isFinite(i.at) ? i.at : 0,
  owner: ownerOf(i),
  keep: typeof i.keep === 'boolean' ? i.keep : null,
});

/**
 * The store's deletions as entries { id, version, at, owner, keep } — version null for an older
 * build's, keep null when the entry does not say (the cloud's copy decides, cloudSyncPlan.js).
 * An id's latest entry comes first, then other accounts' still waiting: one per account.
 */
export function deletionEntries(state) {
  const info = isInfo(state?.deletedInfo) ? state.deletedInfo : {};
  const ids = Array.isArray(state?.deletedIds) ? state.deletedIds : [];
  return [...new Set(ids.filter((id) => typeof id === 'string' && id))].flatMap((id) => {
    const [first = {}, ...also] = savedFor(info[id]);
    const owners = new Set([ownerOf(first)]);
    const entries = [entryOf(id, first)];
    for (const e of also.map((i) => entryOf(id, i))) {
      // One per account, and only one a sync could send: an entry with no version never is.
      if (e.version === null || !e.owner || owners.has(e.owner)) continue;
      owners.add(e.owner);
      entries.push(e);
    }
    return entries;
  });
}

/**
 * The deletion fields after `resume` is deleted at `now` by account `uid` (signed in; none when
 * signed out): its id, the version deleted, whose, kept or not. Signed in, the deletion is that
 * account's even before its first sync got through — the list may still be the last account's
 * (syncedUid), whose sync would never send it (V2W1a-3); signed out, it waits for that one.
 * Another account's deletion of the same id still waiting is kept with it (`also`), never
 * replaced; the same account's earlier one, or nobody's, is.
 */
export function withDeletion(state, resume, now, uid = null) {
  const { id } = resume;
  const info = isInfo(state.deletedInfo) ? state.deletedInfo : {};
  const version = Number.isFinite(resume.updatedAt) ? resume.updatedAt : 0;
  const owner = (typeof uid === 'string' && uid) || state.syncedUid || null;
  const waiting = (state.deletedIds || []).includes(id) ? savedFor(info[id]) : [];
  const also = waiting.filter((i) => Number.isFinite(i.version) && ownerOf(i) && ownerOf(i) !== owner).map(withoutAlso);
  const entry = { version, at: now, owner, keep: resume.keep === true };
  return {
    deletedIds: [...(state.deletedIds || []).filter((d) => d !== id), id],
    deletedInfo: { ...info, [id]: also.length ? { ...entry, also } : entry },
  };
}

/**
 * The deletion fields without these `ids` (put back, or sent). With `before`, only an entry made
 * at or before that time goes: a résumé deleted again after a flush took the queue — restored,
 * then deleted — still has its newer deletion to send. With `uid` (the account whose sync sent
 * them), only that account's entries and nobody's go: another account's deletion of the same id
 * still waits for it (V2VF1S-1); without (a restore), every entry of the id goes.
 */
export function withoutDeletions(state, ids, before = Infinity, uid = undefined) {
  const info = isInfo(state.deletedInfo) ? state.deletedInfo : {};
  const goes = (i) => !(Number.isFinite(i.at) && i.at > before) && (uid === undefined || !ownerOf(i) || ownerOf(i) === uid);
  const deletedInfo = { ...info };
  const gone = new Set();
  for (const id of new Set(ids)) {
    const saved = savedFor(info[id]);
    const left = saved.filter((i) => !goes(i)).map(withoutAlso).sort((a, b) => atOf(b) - atOf(a));
    if (left.length === saved.length && saved.length) continue;
    if (!left.length) {
      delete deletedInfo[id];
      gone.add(id);
      continue;
    }
    // The latest left is deletedInfo[id] now, as every build reads it.
    deletedInfo[id] = left.length > 1 ? { ...left[0], also: left.slice(1) } : left[0];
  }
  return { deletedIds: (state.deletedIds || []).filter((id) => !gone.has(id)), deletedInfo };
}

/**
 * The deletion fields of a saved store as this build keeps them (anything unreadable dropped),
 * with `syncedUid`: the account the list was last synced with, null when none or unknown.
 */
export function savedDeletions(saved) {
  const entries = deletionEntries(saved);
  const deletedInfo = {};
  for (const { id, keep, ...info } of entries.filter((e) => e.version !== null)) {
    const kept = keep === null ? info : { ...info, keep };
    if (!deletedInfo[id]) deletedInfo[id] = kept;
    else deletedInfo[id] = { ...deletedInfo[id], also: [...(deletedInfo[id].also || []), kept] };
  }
  return {
    deletedIds: [...new Set(entries.map((e) => e.id))],
    deletedInfo,
    syncedUid: typeof saved?.syncedUid === 'string' && saved.syncedUid ? saved.syncedUid : null,
  };
}
