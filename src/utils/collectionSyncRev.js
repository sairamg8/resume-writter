// The version of a synced job or project (docs/knowledge/11-sync-versions.md). Every item document the
// collection sync writes carries two added fields: `syncRev`, a whole number that goes up by one with each
// write of the item, and `syncBy`, the id of the browser that made the write. A copy without them (written
// by an older build or by the previous site) is rev 0, written by nobody. They are only ever added to a
// document, never renamed or removed, and are read off a cloud copy before it reaches the list: the store
// holds the item as it always did.
//
// Plain functions over plain data, so the plan (collectionSyncPlan.js), the engine
// (collectionSyncEngine.js) and the tests share them.

/** The two fields an item document carries beside its own. */
export const REV_FIELD = 'syncRev';
export const BY_FIELD = 'syncBy';

/** The stamp of a copy nobody stamped: rev 0, no writer, no time. */
export const NO_STAMP = Object.freeze({ rev: 0, by: '', at: null });

/**
 * The stamp a cloud document carries: `{ rev, by, at }`, `at` its `updatedAt` (null: none). What
 * cannot be a rev (a missing field, a text, a fraction, zero) reads as rev 0, so a document edited by hand
 * is never an error.
 */
export function stampOf(data) {
  const rev = data?.[REV_FIELD];
  const by = data?.[BY_FIELD];
  return {
    rev: Number.isInteger(rev) && rev > 0 ? rev : 0,
    by: typeof by === 'string' ? by : '',
    at: Number.isFinite(data?.updatedAt) ? data.updatedAt : null,
  };
}

/** `data` without the two fields, and the stamp they carried: `{ item, stamp }`. */
export function splitStamp(data) {
  const { [REV_FIELD]: _rev, [BY_FIELD]: _by, ...item } = data;
  return { item, stamp: stampOf(data) };
}

/** Whether two stamps name the same copy (null: no document). */
export const sameStamp = (a, b) => (a === null || b === null ? a === b : a.rev === b.rev && a.by === b.by && a.at === b.at);

/**
 * The stamps to write for `items`: one rev above both the cloud's copy as just read (`cloud`: id → stamp)
 * and the rev this browser last saw (`seen`: id → rev), by `device`. A new item is rev 1.
 */
export function nextStamps(items, cloud, seen, device) {
  return new Map(items.map((x) => {
    const was = Math.max(cloud.get(x.id)?.rev ?? 0, Number.isFinite(seen?.[x.id]) ? seen[x.id] : 0);
    return [x.id, { rev: was + 1, by: device }];
  }));
}

/** `{ id: rev }` of `list` as the cloud holds it (`cloud`: id → stamp), for the items with a time, as versionsOf has them. */
export const revsOf = (list, cloud) => Object.fromEntries(list.filter((x) => Number.isFinite(x.updatedAt)).map((x) => [x.id, cloud.get(x.id)?.rev ?? 0]));

/** `{ id: rev }` of `stamps` (id → stamp). */
export const revsOfStamps = (stamps) => Object.fromEntries([...stamps].map(([id, s]) => [id, s.rev]));

/**
 * Whether the cloud's copy of an item moved since this browser last saw it, by version and not by any
 * clock: `stamp` the copy's, `updatedAt` its time, `baseRev` / `baseTime` the rev and the `updatedAt` this
 * browser's record holds for the item (undefined: none), `device` this browser's id, `ownTime` the
 * `updatedAt` of the copy this browser itself last handed to Firestore (its record only has it once
 * acknowledged). Another device's write is a rev above the recorded one; a copy this browser wrote itself is not a move
 * (its record may only lack it); a writer that does not count revs (the previous site rewrites a copy
 * keeping its fields) shows as a different `updatedAt` at the same rev. With no rev recorded the
 * `updatedAt` alone is compared, for equality, and for an item this browser never saw nothing is known: it
 * moved unless this very browser wrote it.
 */
export function movedInCloud({ stamp = NO_STAMP, updatedAt, baseRev, baseTime, device = '', ownTime }) {
  if (ownTime !== undefined && updatedAt === ownTime) return false;
  const seenTime = Number.isFinite(baseTime) ? baseTime : null;
  if (Number.isFinite(baseRev)) {
    if (stamp.rev > baseRev) {
      // A rewrite that changed nothing (the same updatedAt as the copy seen: no new edit) is no move. This browser's own write is
      // not one either — unless its updatedAt is not the one handed over (`ownTime`): the previous site rewrote it since.
      if (stamp.by === device) return ownTime !== undefined;
      return !(seenTime !== null && updatedAt === seenTime);
    }
    return seenTime !== null && updatedAt !== seenTime;
  }
  if (seenTime !== null) return updatedAt !== seenTime;
  return stamp.rev > 0 ? stamp.by !== device : true;
}

/**
 * Whether the cloud's copy (`theirsAt`, written by `by`) is the one that stays the item over this browser's
 * (`mineAt`, `device`) when both changed it: the later `updatedAt`, and on a tie the greater writer id — the same
 * two copies, the same winner, whichever device finds the conflict, and never "whoever read the other". A copy
 * nobody stamped has no writer (''), so a tie with it stays this browser's, as it always did.
 */
export function theirsLater(theirsAt, mineAt, by, device) {
  const t = Number.isFinite(theirsAt) ? theirsAt : 0;
  const m = Number.isFinite(mineAt) ? mineAt : 0;
  return t !== m ? t > m : by > device;
}
