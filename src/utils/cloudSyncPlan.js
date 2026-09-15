// What the cloud sync writes, decided as pure functions over plain data — no Firebase, so tests
// run every rule directly (tests/pdf/18-cloud-sync.test.mjs). useCloudSync only reads the
// cloud, applies these plans in one batch, and loads the result.
//
// Deleting: an ordinary résumé is removed from the cloud and its id goes on the account's
// deletion list (meta/deletions), so a device still holding a copy drops it instead of
// uploading it again. In a demo account a sample résumé (demo_…) is flagged { deleted: true }
// instead, keeping its last edited copy for a later restore (project_demo-account.md). Any
// other account deletes a sample like any résumé (R4-11): the samples reach it only through a
// shared browser — local résumés carry over to whichever account signs in next — and a flag
// kept the owner's sample content in that account's cloud for good.
import { isDemoId, nextTombstones } from '@/utils/demoSeed';
import { mergeResumeLists } from '@/utils/syncMerge';

const hasId = (r) => r && typeof r.id === 'string' && r.id !== '';
/** A deletion entry (localDeletions.js); a bare id is an older build's, with no version. */
const asEntry = (e) => (typeof e === 'string' ? { id: e, version: null } : e);

/**
 * The first sync after sign-in (or after coming back online).
 *   local         this browser's résumés
 *   deletions     résumés deleted in this browser that the cloud may not have yet — deleted
 *                 signed out or offline, after a failed flush, or within the flush delay before a
 *                 reload; a flush that sent one forgets it (R8-1). Entries { id, version }
 *                 (localDeletions.deletionEntries): version the updatedAt of the copy deleted,
 *                 null for an older build's entry
 *   cloud         the account's résumé documents, each with its document id
 *   cloudDeleted  the account's deletion list
 *   demoAccount   the account is a demo account (its deleted samples are flagged)
 * Returns
 *   merged       the list to write and load: newer copy wins, deletions left out
 *   flags        samples deleted here that the cloud still holds whole → flag them
 *   hardDeletes  other résumés deleted here that the cloud still holds → remove them; outside
 *                a demo account also every flagged sample (flagged before R4-11)
 *   tombstones   the new deletion list when it changes, else null
 * A deletion is sent only when the cloud's copy is not newer than the version deleted: one made
 * offline or signed out must never remove an edit made later on another device — that edit
 * wins, and the résumé comes back here (R8-0). An entry with no version is left out of this
 * merge only, never sent, as before 53d6a3b. Before 53d6a3b no deletion was sent at all: the
 * cloud kept the résumés, the store forgot the deletions, and the next sync brought them back
 * (R4-1).
 */
export function planInitialSync({ local = [], deletions = [], cloud = [], cloudDeleted = [], demoAccount = false }) {
  const docs = cloud.filter(hasId);
  const byId = new Map(docs.map((r) => [r.id, r]));
  const cloudDeletedSet = new Set(cloudDeleted);
  const flagged = docs.filter((r) => r.deleted).map((r) => r.id);
  const excluded = new Set([...cloudDeletedSet, ...flagged]);

  const unsent = [];
  for (const { id, version } of deletions.map(asEntry)) {
    const doc = byId.get(id);
    const live = Boolean(doc) && !doc.deleted && !cloudDeletedSet.has(id);
    if (live && version !== null && (doc.updatedAt ?? 0) > version) continue; // edited elsewhere since
    excluded.add(id);
    if (live && version !== null && !unsent.includes(id)) unsent.push(id);
  }
  const flags = demoAccount ? unsent.filter(isDemoId) : [];
  const hardDeletes = [
    ...unsent.filter((id) => !flags.includes(id)),
    ...(demoAccount ? [] : flagged),
  ];

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
 * One flush of the queue: `sets` to write, sample ids to `flag` (a demo account's only), other
 * ids to remove, and whether the deletion list must be read and rewritten — when something is
 * removed, or when a demo account writes again a sample on the list (deleted outright by an
 * older build): a restore takes it off (nextTombstones).
 */
export function planFlush(writes, deletes, tombstones = new Set(), { demoAccount = false } = {}) {
  const flags = demoAccount ? deletes.filter(isDemoId) : [];
  const hardDeletes = deletes.filter((id) => !flags.includes(id));
  return {
    sets: writes,
    flags,
    hardDeletes,
    rewriteTombstones: hardDeletes.length > 0
      || (demoAccount && writes.some((r) => isDemoId(r.id) && tombstones.has(r.id))),
  };
}
