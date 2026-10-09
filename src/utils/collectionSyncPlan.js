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
// was changed here, and a known id no longer in the list was deleted here. It keeps the order that
// account's cloud holds as last seen here too (`order`): the base a first sync compares both
// orders with. An order carries no `updatedAt`, so without it a move made before the first sync
// (offline, signed out, a failed sync) always lost to the cloud's order (R2-140).
//
// When both sides changed the same item since this browser last synced, the newer copy stays the
// item and the older one is kept beside it as a conflict copy (collectionSyncConflict.js), as the
// résumés' is: nothing typed is lost.
import { hasTwin, sameContent } from './collectionSyncConflict.js';
import { NO_STAMP, movedInCloud } from './collectionSyncRev.js';

/**
 * The version this browser records for an item whose deletion it sent to the cloud
 * (collectionSyncEngine's noteVersions), kept until the next first sync: older than any copy, so
 * one put back here since (Undo) counts as changed here. The deletion itself is in the cloud
 * already: a list leaving this browser (leaveList) keeps no such id aside to delete again.
 */
export const DELETED = 0;

/** `{ id: updatedAt }` of `list`. */
export const versionsOf = (list) => Object.fromEntries(list.filter((x) => Number.isFinite(x.updatedAt)).map((x) => [x.id, x.updatedAt]));

const time = (x) => (Number.isFinite(x?.updatedAt) ? x.updatedAt : 0);

/** Whether the ids `a` and `b` have in common come in the same order in both (an id on one side only does not count). */
export function sameOrder(a, b) {
  const inA = new Set(a);
  const inB = new Set(b);
  const x = a.filter((id) => inB.has(id));
  const y = b.filter((id) => inA.has(id));
  return x.length === y.length && x.every((id, i) => y[i] === id);
}

/** `lead` with the ids only `other` has, each put right after the id before it in `other` (first when there is none). */
function weave(lead, other) {
  const out = [...lead];
  const has = new Set(out);
  let after = -1;
  for (const id of other) {
    if (has.has(id)) { after = out.indexOf(id); continue; }
    out.splice(after + 1, 0, id);
    has.add(id);
    after += 1;
  }
  return out;
}

/**
 * The first sync of an account's list: this browser's `local` list with what it knew of the
 * cloud (`versions`), the ids it deleted since (`localDeletes`), and the cloud's `docs`,
 * `deleted` and `order`; `baseOrder` is the cloud's order as this browser last saw it (null:
 * unknown, as in a record written before it was kept) and `localOrder` a move kept aside when the
 * list left this browser (leaveList), which leads `local`'s own order. Returns { merged (the list,
 * in order), sets (items to write), deletes (ids to remove and list as deleted), order (the ids in
 * order: written when it differs from the cloud's), conflicts (the older copies kept beside an
 * item both sides changed: `{ id, copy }`, `copyOf(older, everyItem)` making each; none without it;
 * `apart`: the fields whose difference alone is no conflict, a project's star and colour; `revs`, `stamps`
 * (id → stamp) and `device`: the versions this browser last saw, the cloud's now and this browser's id,
 * collectionSyncRev.js; `fresh`: this browser's list was never this account's, so an item both hold that it
 * never synced was edited on both from the same start) }.
 * Nothing typed is lost:
 *   - an item on one side only is new there and joins the list — unless the account deleted it
 *     for good, or it is one this browser knew and deleted since;
 *   - on both sides, the newer `updatedAt` wins (this browser's on a tie) — and when both sides
 *     changed it since this browser last synced, to different content, the older copy is kept
 *     beside it as a conflict copy — but for this browser's untouched demo (`seed(item)`), never synced here: the account's copy wins;
 *   - that demo on this browser only joins an account with no items and no deletions, and no other;
 *   - a demo (`seedIds`: the ids a first visit shows) this browser has not, never synced here and
 *     not in the account either, was deleted here before any sign-in: it is listed as deleted, so
 *     another browser's untouched demo does not bring it back to an account with nothing else in
 *     it; an edited copy of the demo still wins over that deletion, as nothing typed is lost;
 *   - a deleted id stays deleted, but for a copy changed where the deletion was never seen (its
 *     version newer than the one this browser last saw): that edit wins, as a résumé's does (R2-029);
 *   - one deleted here that another device changed since this browser last saw it comes back.
 * The order merges on its base as the items do on their versions: moved here while the cloud's
 * order is still the base's, this browser's order leads, and what only the cloud has goes where
 * the cloud has it; otherwise (not moved here, moved elsewhere, or no base) the cloud's order
 * leads, and what only this browser has follows as this browser had it. Moved on both sides, the
 * cloud's wins: the device that sent first.
 */
export function planFirstSync({ local, versions = {}, localDeletes = [], docs, deleted = [], order = [], baseOrder = null, localOrder = [], seed = () => false, seedIds = [], copyOf = null, apart = [], revs = {}, stamps = new Map(), device = '', fresh = false }) {
  const gone = new Set(deleted);
  const dropped = new Set(localDeletes);
  const cloudById = new Map(docs.map((d) => [d.id, d]));
  const localById = new Map(local.map((x) => [x.id, x]));
  const known = (id) => Number.isFinite(versions[id]);
  // Changed since this browser last saw it is "differs from the version it recorded", not "is later": a device whose
  // clock is behind stamps an edit earlier than the copy it was made on.
  const changedSince = (x) => known(x.id) && time(x) !== versions[x.id];
  /** Whether the cloud's copy of an item this browser knows moved since it saw it (collectionSyncRev.movedInCloud). */
  const movedSince = (theirs) => known(theirs.id) && movedInCloud({
    stamp: stamps.get(theirs.id) ?? NO_STAMP, updatedAt: time(theirs), baseRev: revs[theirs.id], baseTime: versions[theirs.id], device,
  });

  const keep = new Map();
  const sets = [];
  const deletes = [];
  const conflicts = [];
  for (const id of new Set([...localById.keys(), ...cloudById.keys(), ...dropped])) {
    const mine = localById.get(id);
    const theirs = cloudById.get(id);
    if (!mine && dropped.has(id)) {
      if (theirs && !gone.has(id) && movedSince(theirs)) keep.set(id, theirs);
      else if (theirs || !gone.has(id)) deletes.push(id);
      continue;
    }
    if (gone.has(id)) {
      // The demo, filled in on this browser before its first sync, is typed work like any edit made
      // where the deletion was never seen: it wins (the demo's id is the same on every browser).
      const filledDemo = mine && !known(id) && seedIds.includes(id) && !seed(mine);
      if (mine && (changedSince(mine) || filledDemo)) { keep.set(id, mine); sets.push(mine); } else if (theirs) deletes.push(id);
      continue;
    }
    if (mine && theirs) {
      // Changed on both sides since this browser last saw the cloud's copy, and not to the same
      // content: the older side's edits would be dropped. A deletion sent from here (DELETED) is no
      // base to tell an edit from.
      const synced = known(id) && versions[id] > DELETED;
      // An item this browser never synced, in a list new to the account (the demo job has one id on every browser,
      // an imported file's jobs the same): there is no copy to have changed since, both sides are edits of one start —
      // the cloud's copy written by another device, this browser's not the untouched demo. A pristine demo in the
      // cloud is no edit, and an untouched one here never wins (below).
      const fromStart = fresh && !known(id) && !seed(mine);
      const based = synced || fromStart;
      const here = based && (synced ? changedSince(mine) : true);
      const there = based && (synced ? movedSince(theirs)
        : !seed(theirs) && movedInCloud({ stamp: stamps.get(id) ?? NO_STAMP, updatedAt: time(theirs), device }));
      const conflict = Boolean(copyOf) && here && there && !sameContent(mine, theirs, apart);
      // Only one side changed it since: that side stays, whatever the two clocks say.
      const oneSide = based && here !== there;
      // A first visit's demo (the store's `seed`), never synced here and never edited, carries
      // nothing typed: the account's copy wins, however old — the demo is dated from the day it
      // was shown, so clearing site data used to send a fresh demo over the one the user filled in.
      const theirsStay = (oneSide ? there : time(theirs) > time(mine)) || (!known(id) && seed(mine));
      if (theirsStay) keep.set(id, theirs);
      else { keep.set(id, mine); if (time(mine) > time(theirs) || conflict || (oneSide && !sameContent(mine, theirs, apart))) sets.push(mine); }
      if (conflict) {
        const copy = copyOf(theirsStay ? mine : theirs, [...local, ...docs, ...conflicts.map((c) => c.copy)]);
        if (!hasTwin(copy, [...local, ...docs])) {
          keep.set(copy.id, copy);
          sets.push(copy);
          conflicts.push({ id, copy });
        }
      }
    } else if (mine) {
      // Known here and gone from the cloud with no deletion listed (removed by hand): gone, unless
      // changed here since.
      if (known(id) && !changedSince(mine)) continue;
      // A first visit's untouched demo, on this browser only, does not join an account that has a
      // list of its own (items, or deletions): the user may have deleted it before signing in
      // anywhere — a deletion that never reached the cloud — and sent, it came back on every device.
      if (!known(id) && seed(mine) && (docs.length || gone.size)) continue;
      keep.set(id, mine);
      sets.push(mine);
    } else keep.set(id, theirs);
  }
  // The demo deleted here before this browser ever synced: nothing else would tell the account, and
  // the next fresh browser's untouched demo, sent to an account with no list of its own, came back
  // on every device (R5-HUNT4 review).
  for (const id of seedIds) {
    if (!localById.has(id) && !cloudById.has(id) && !gone.has(id) && !dropped.has(id) && !known(id)) deletes.push(id);
  }

  const here = [...new Set([...localOrder, ...local.map((x) => x.id)])];
  const movedHere = Array.isArray(baseOrder) && sameOrder(order, baseOrder) && !sameOrder(here, baseOrder);
  // Moved here only: this browser's order, with what only the cloud has where the cloud has it.
  // Otherwise the cloud's order first, then what only this browser had, as it had it. Then the rest.
  const ids = [...(movedHere ? weave(here, order) : [...order, ...here]), ...docs.map((d) => d.id)];
  // A conflict copy goes right after its item.
  const copyOfId = new Map(conflicts.map((c) => [c.id, c.copy.id]));
  const placed = [...new Set(ids)].flatMap((id) => (copyOfId.has(id) ? [id, copyOfId.get(id)] : [id]));
  const merged = placed.filter((id) => keep.has(id)).map((id) => keep.get(id));
  return { merged, sets, deletes, order: merged.map((x) => x.id), conflicts };
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
/** A list of ids as saved (null: none saved, or not a list). */
const idsOf = (v) => (Array.isArray(v) ? v.filter((id) => typeof id === 'string') : null);

/**
 * The list's sync record (collectionSyncMeta.js) and the list once account `uid`'s list leaves
 * this browser — it signed out, or another account signs in: `{ meta, list }`. As with the résumés
 * (cloudSyncLeave.js, R2-005) the list goes; what its cloud does not have yet — changed or added
 * here, or deleted here and not yet sent, or a move not yet sent (the list's order with the base
 * it was made on) — is kept aside for that account (`stashed[uid]`) and its next first sync sends
 * it. null when the list is not that account's.
 */
export function leaveList(meta, list, uid) {
  if (!uid || meta.uid !== uid) return null;
  const versions = isMap(meta.versions) ? meta.versions : {};
  const revs = isMap(meta.revs) ? meta.revs : {};
  const unsent = list.filter((x) => versions[x.id] !== x.updatedAt);
  const ids = new Set(list.map((x) => x.id));
  // A deletion already sent (DELETED) is not kept aside: sent again at the next sign-in, it
  // deleted the copy another device had edited and written back since (R5-HUNT2 review).
  const deletes = Object.keys(versions).filter((id) => !ids.has(id) && versions[id] !== DELETED);
  const base = idsOf(meta.order);
  const moved = base && !sameOrder(list.map((x) => x.id), base);
  const stashed = { ...(isMap(meta.stashed) ? meta.stashed : {}) };
  if (unsent.length || deletes.length || moved) {
    const was = stashOf(meta, uid);
    const mine = new Set(unsent.map((x) => x.id));
    stashed[uid] = {
      items: [...was.items.filter((x) => !mine.has(x.id)), ...unsent],
      versions: { ...was.versions, ...Object.fromEntries(unsent.filter((x) => Number.isFinite(versions[x.id])).map((x) => [x.id, versions[x.id]])) },
      revs: { ...was.revs, ...Object.fromEntries(unsent.filter((x) => Number.isFinite(revs[x.id])).map((x) => [x.id, revs[x.id]])) },
      deletes: [...new Set([...was.deletes.filter((id) => !mine.has(id)), ...deletes])],
      ...(moved ? { order: list.map((x) => x.id), base } : was.base ? { order: was.order, base: was.base } : {}),
    };
  }
  // This browser's id as a writer stays: it is the browser's, not the account's.
  return { meta: { uid: null, versions: {}, revs: {}, device: meta.device ?? null, order: null, stashed }, list: [] };
}

/**
 * Account `uid`'s items kept aside when its list left: { items, versions, revs, deletes, order, base }
 * (empty when none; `order` and `base` null when no move was kept).
 */
export function stashOf(meta, uid) {
  const entry = isMap(meta?.stashed) && isMap(meta.stashed[uid]) ? meta.stashed[uid] : {};
  const base = idsOf(entry.base);
  const order = idsOf(entry.order);
  return {
    items: Array.isArray(entry.items) ? entry.items.filter((x) => x && typeof x.id === 'string' && x.id) : [],
    versions: isMap(entry.versions) ? entry.versions : {},
    revs: isMap(entry.revs) ? entry.revs : {},
    deletes: Array.isArray(entry.deletes) ? entry.deletes.filter((id) => typeof id === 'string') : [],
    order: base && order ? order : null,
    base: base && order ? base : null,
  };
}
