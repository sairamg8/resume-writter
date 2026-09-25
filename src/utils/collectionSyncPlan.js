// What the cloud sync of a plain list — the Job Tracker's jobs, the boards (R2-145, R2-140) —
// decides, as plain functions over plain data: no Firebase, no storage, so the tests run them
// through the engine (collectionSyncEngine.js) over a fake Firestore.
//
// Each item (a job, a board) is one document, `users/{uid}/<name>/{id}`, and the newer
// `updatedAt` wins, item by item. The account's `meta/<name>` document lists the ids deleted for
// good (`deleted`) — so a device that still holds a deleted item does not bring it back — and the
// list's order (`order`), which is the array's order in the store (the job board's ranks, the
// boards' grid). This browser keeps, per list, the account it last synced with and the
// `updatedAt` of every item that account's cloud holds as this browser last saw it (`versions`,
// collectionSyncMeta.js): an item with no version there is new here, one whose version differs
// was changed here, and a known id no longer in the list was deleted here.

/** `{ id: updatedAt }` of `list`. */
export const versionsOf = (list) => Object.fromEntries(list.filter((x) => Number.isFinite(x.updatedAt)).map((x) => [x.id, x.updatedAt]));

const time = (x) => (Number.isFinite(x?.updatedAt) ? x.updatedAt : 0);

/**
 * The first sync of an account's list: this browser's `local` list with what it knew of the
 * cloud (`versions`), the ids it deleted since (`localDeletes`), and the cloud's `docs`,
 * `deleted` and `order`. Returns { merged (the list, in order), sets (items to write), deletes
 * (ids to remove and list as deleted), order (the ids in order: written when it differs from
 * the cloud's) }. Nothing typed is lost:
 *   - an item on one side only is new there and joins the list — unless the account deleted it
 *     for good, or it is one this browser knew and deleted since;
 *   - on both sides, the newer `updatedAt` wins (this browser's on a tie);
 *   - a deleted id stays deleted, but for a copy changed where the deletion was never seen (its
 *     version newer than the one this browser last saw): that edit wins, as a résumé's does (R2-029);
 *   - one deleted here that another device changed since this browser last saw it comes back.
 */
export function planFirstSync({ local, versions = {}, localDeletes = [], docs, deleted = [], order = [] }) {
  const gone = new Set(deleted);
  const dropped = new Set(localDeletes);
  const cloudById = new Map(docs.map((d) => [d.id, d]));
  const localById = new Map(local.map((x) => [x.id, x]));
  const known = (id) => Number.isFinite(versions[id]);
  const changedSince = (x) => known(x.id) && time(x) > versions[x.id];

  const keep = new Map();
  const sets = [];
  const deletes = [];
  for (const id of new Set([...localById.keys(), ...cloudById.keys(), ...dropped])) {
    const mine = localById.get(id);
    const theirs = cloudById.get(id);
    if (!mine && dropped.has(id)) {
      if (theirs && !gone.has(id) && changedSince(theirs)) keep.set(id, theirs);
      else if (theirs || !gone.has(id)) deletes.push(id);
      continue;
    }
    if (gone.has(id)) {
      if (mine && changedSince(mine)) { keep.set(id, mine); sets.push(mine); } else if (theirs) deletes.push(id);
      continue;
    }
    if (mine && theirs) {
      if (time(theirs) > time(mine)) keep.set(id, theirs);
      else { keep.set(id, mine); if (time(mine) > time(theirs)) sets.push(mine); }
    } else if (mine) {
      // Known here and gone from the cloud with no deletion listed (removed by hand): gone, unless
      // changed here since.
      if (known(id) && !changedSince(mine)) continue;
      keep.set(id, mine);
      sets.push(mine);
    } else keep.set(id, theirs);
  }

  // The cloud's order first, then what only this browser had, as it had it, then the rest.
  const ids = [...order, ...local.map((x) => x.id), ...docs.map((d) => d.id)];
  const merged = [...new Set(ids)].filter((id) => keep.has(id)).map((id) => keep.get(id));
  return { merged, sets, deletes, order: merged.map((x) => x.id) };
}

/**
 * What changed from `prev` to `next` (the store's list before and after a change): `writes`, the
 * items added or changed — a new object with the same content is no change — `deletes`, the ids
 * gone, and `reordered`.
 */
export function diffLists(prev, next) {
  const before = new Map(prev.map((x) => [x.id, x]));
  const writes = next.filter((x) => {
    const was = before.get(x.id);
    return was !== x && (!was || JSON.stringify(was) !== JSON.stringify(x));
  });
  const ids = new Set(next.map((x) => x.id));
  const deletes = prev.filter((x) => !ids.has(x.id)).map((x) => x.id);
  const kept = prev.map((x) => x.id).filter((id) => ids.has(id));
  const reordered = next.filter((x) => before.has(x.id)).some((x, i) => kept[i] !== x.id);
  return { writes, deletes, reordered };
}

const isMap = (v) => Boolean(v && typeof v === 'object' && !Array.isArray(v));

/**
 * The list's sync record (collectionSyncMeta.js) and the list once account `uid`'s list leaves
 * this browser — it signed out, or another account signs in: `{ meta, list }`. As with the résumés
 * (cloudSyncLeave.js, R2-005) the list goes; what its cloud does not have yet — changed or added
 * here, or deleted here and not yet sent — is kept aside for that account (`stashed[uid]`) and its
 * next first sync sends it. null when the list is not that account's.
 */
export function leaveList(meta, list, uid) {
  if (!uid || meta.uid !== uid) return null;
  const versions = isMap(meta.versions) ? meta.versions : {};
  const unsent = list.filter((x) => versions[x.id] !== x.updatedAt);
  const ids = new Set(list.map((x) => x.id));
  const deletes = Object.keys(versions).filter((id) => !ids.has(id));
  const stashed = { ...(isMap(meta.stashed) ? meta.stashed : {}) };
  if (unsent.length || deletes.length) {
    const was = stashOf(meta, uid);
    const mine = new Set(unsent.map((x) => x.id));
    stashed[uid] = {
      items: [...was.items.filter((x) => !mine.has(x.id)), ...unsent],
      versions: { ...was.versions, ...Object.fromEntries(unsent.filter((x) => Number.isFinite(versions[x.id])).map((x) => [x.id, versions[x.id]])) },
      deletes: [...new Set([...was.deletes.filter((id) => !mine.has(id)), ...deletes])],
    };
  }
  return { meta: { uid: null, versions: {}, stashed }, list: [] };
}

/** Account `uid`'s items kept aside when its list left: { items, versions, deletes } (empty when none). */
export function stashOf(meta, uid) {
  const entry = isMap(meta?.stashed) && isMap(meta.stashed[uid]) ? meta.stashed[uid] : {};
  return {
    items: Array.isArray(entry.items) ? entry.items.filter((x) => x && typeof x.id === 'string' && x.id) : [],
    versions: isMap(entry.versions) ? entry.versions : {},
    deletes: Array.isArray(entry.deletes) ? entry.deletes.filter((id) => typeof id === 'string') : [],
  };
}
