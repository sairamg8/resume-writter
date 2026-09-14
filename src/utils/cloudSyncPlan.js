// What the cloud sync writes, decided as pure functions over plain data — no Firebase, so tests
// run every rule directly (tests/pdf/18-cloud-sync.test.mjs). useCloudSync only reads the
// cloud, applies these plans in one batch, and loads the result.
//
// Deleting: an ordinary résumé is removed from the cloud and its id goes on the account's
// deletion list (meta/deletions), so a device still holding a copy drops it instead of
// uploading it again. A sample résumé (demo_…) is flagged { deleted: true } instead, keeping
// its last edited copy for a later restore (project_demo-account.md).
import { isDemoId, nextTombstones } from '@/utils/demoSeed';
import { mergeResumeLists } from '@/utils/syncMerge';

const hasId = (r) => r && typeof r.id === 'string' && r.id !== '';

/**
 * The first sync after sign-in (or after coming back online).
 *   local         this browser's résumés
 *   localDeleted  ids deleted in this browser and not yet sent — deleted signed out, offline,
 *                 after a failed sync, or within the flush delay before a reload
 *   cloud         the account's résumé documents, each with its document id
 *   cloudDeleted  the account's deletion list
 * Returns
 *   merged       the list to write and load: newer copy wins, every deletion left out
 *   flags        samples deleted here that the cloud still holds whole → flag them
 *   hardDeletes  other résumés deleted here that the cloud still holds → remove them
 *   tombstones   the new deletion list when it changes, else null
 * Before this plan the deletions were only left out of the merge: the cloud kept the
 * résumés, the store then forgot the deletions, and the next sync brought them back (R4-1).
 */
export function planInitialSync({ local = [], localDeleted = [], cloud = [], cloudDeleted = [] }) {
  const docs = cloud.filter(hasId);
  const cloudDeletedSet = new Set(cloudDeleted);
  const live = new Set(docs.filter((r) => !r.deleted).map((r) => r.id));
  const flagged = docs.filter((r) => r.deleted).map((r) => r.id);
  const excluded = new Set([...cloudDeletedSet, ...localDeleted, ...flagged]);

  const unsent = [...new Set(localDeleted)].filter((id) => live.has(id) && !cloudDeletedSet.has(id));
  const flags = unsent.filter(isDemoId);
  const hardDeletes = unsent.filter((id) => !isDemoId(id));

  return {
    merged: mergeResumeLists(local, docs, excluded),
    flags,
    hardDeletes,
    tombstones: hardDeletes.length ? nextTombstones(cloudDeleted, hardDeletes, []) : null,
  };
}

/**
 * The local changes since the last look, added to the queue waiting for the next flush.
 * `writes` (Map id → résumé) and `deletes` (Set of ids) come back as new objects, with `dirty`
 * true when anything changed. A résumé deleted and put back before the flush (a restored
 * sample) is written, not deleted.
 */
export function queueChanges({ writes, deletes }, prev = [], current = []) {
  const nextWrites = new Map(writes);
  const nextDeletes = new Set(deletes);
  let dirty = false;
  const currentIds = new Set(current.map((r) => r.id));
  for (const r of prev) {
    if (currentIds.has(r.id)) continue;
    nextWrites.delete(r.id);
    nextDeletes.add(r.id);
    dirty = true;
  }
  const before = new Map(prev.map((r) => [r.id, r]));
  for (const r of current) {
    const p = before.get(r.id);
    if (p && p.updatedAt === r.updatedAt) continue;
    nextDeletes.delete(r.id);
    nextWrites.set(r.id, r);
    dirty = true;
  }
  return { writes: nextWrites, deletes: nextDeletes, dirty };
}

/**
 * One flush of the queue: `sets` to write, sample ids to `flag`, other ids to remove, and
 * whether the deletion list must be read and rewritten — when something is removed, or when a
 * sample on the list (deleted outright by an older build) is written again: a restore takes it
 * off (nextTombstones).
 */
export function planFlush(writes, deletes, tombstones = new Set()) {
  const hardDeletes = deletes.filter((id) => !isDemoId(id));
  return {
    sets: writes,
    flags: deletes.filter(isDemoId),
    hardDeletes,
    rewriteTombstones: hardDeletes.length > 0 || writes.some((r) => isDemoId(r.id) && tombstones.has(r.id)),
  };
}
