// What the cloud sync writes, decided as pure functions over plain data — no Firebase, so tests
// run every rule directly (tests/pdf/18-cloud-sync.test.mjs). The sync engine
// (cloudSyncEngine.js) reads the cloud, commits each plan in one batch, and applies the result to
// the store (afterSync).
//
// Deleting: an ordinary résumé is removed from the cloud and its id goes on the account's
// deletion list (meta/deletions), so a device still holding a copy drops it instead of
// uploading it again. In a demo account one of its originals (keep: true, demoSeed.js) is
// flagged { deleted: true, keep: true } instead, keeping its last edited copy for a later
// restore (project_demo-account.md). Any other account deletes an original like any résumé
// (R4-11): a flag there kept content nothing would ever bring back — originals reach such an
// account only through a shared browser, whose local résumés carry over to whoever signs in next.
// Until 2026-09-15 a demo account flagged the fictional samples (demo_…) instead; one flagged then
// stays flagged, and a sample deleted now is removed for good.
import { isOriginal } from '@/utils/demoSeed';
import { mergeResumeLists } from '@/utils/syncMerge';
import { withoutDeletions } from '@/utils/localDeletions';

const hasId = (r) => r && typeof r.id === 'string' && r.id !== '';
/** A deletion entry (localDeletions.js); a bare id is an older build's, with no version. */
const asEntry = (e) => (typeof e === 'string' ? { id: e, version: null } : e);

/**
 * The first sync after sign-in (or after coming back online).
 *   local         this browser's résumés
 *   deletions     résumés deleted in this browser that the cloud may not have yet — deleted
 *                 signed out or offline, after a failed flush, or within the flush delay before a
 *                 reload; a flush that sent one forgets it (R8-1). Entries { id, version, owner }
 *                 (localDeletions.deletionEntries): version the updatedAt of the copy deleted,
 *                 null for an older build's entry; owner the account it was deleted from
 *   uid           the account signing in: another account's deletions are left for it (R8-6)
 *   cloud         the account's résumé documents, each with its document id
 *   cloudDeleted  the account's deletion list
 *   demoAccount   the account is a demo account (its deleted originals are flagged)
 * Returns
 *   merged       the list to load: newer copy wins, deletions left out
 *   sets         the merged résumés the account lacks or holds an older copy of → write them.
 *                Only those: writing back a copy just read put it over an edit another device
 *                made before the batch arrived (R8-4)
 *   flags        originals deleted here that the cloud still holds whole → flag them. Original:
 *                the copy deleted was (its entry's `keep`), else the cloud's copy is
 *   hardDeletes  other résumés deleted here that the cloud still holds → remove them; outside
 *                a demo account also every flagged résumé (flagged before R4-11)
 *   listAdd      ids to add to the deletion list (the removals)
 *   handled      the ids of the deletions dealt with — the store forgets them (afterSync);
 *                another account's are left out of the merge and kept
 * A deletion is sent only when the cloud's copy is not newer than the version deleted: one made
 * offline or signed out must never remove an edit made later on another device — that edit
 * wins, and the résumé comes back here (R8-0). An entry with no version is left out of this
 * merge only, never sent, as before 53d6a3b. A flagged résumé is read the same way: the flag
 * deletes the version it carries, so a copy here edited since (restored, then edited offline)
 * brings it back — written whole, flag and all — instead of being dropped. Before 53d6a3b no
 * deletion was sent at all: the cloud kept the résumés, the store forgot the deletions, and the
 * next sync brought them back (R4-1).
 */
export function planInitialSync({ local = [], deletions = [], cloud = [], cloudDeleted = [], demoAccount = false, uid = null }) {
  const docs = cloud.filter(hasId);
  const byId = new Map(docs.map((r) => [r.id, r]));
  const cloudDeletedSet = new Set(cloudDeleted);
  const localById = new Map(local.filter(hasId).map((r) => [r.id, r]));
  const editedSince = (doc) => (localById.get(doc.id)?.updatedAt ?? 0) > (doc.updatedAt ?? 0);
  const flagged = docs.filter((r) => r.deleted && !editedSince(r)).map((r) => r.id);
  const excluded = new Set([...cloudDeletedSet, ...flagged]);

  const unsent = [];
  const kept = new Set(); // the unsent that were originals
  const handled = [];
  for (const { id, version, owner, keep = null } of deletions.map(asEntry)) {
    if (owner && uid && owner !== uid) { excluded.add(id); continue; } // deleted from another account
    handled.push(id);
    const doc = byId.get(id);
    const live = Boolean(doc) && !doc.deleted && !cloudDeletedSet.has(id);
    if (live && version !== null && (doc.updatedAt ?? 0) > version) continue; // edited elsewhere since
    excluded.add(id);
    if (!live || version === null || unsent.includes(id)) continue;
    unsent.push(id);
    if (keep ?? isOriginal(doc)) kept.add(id);
  }
  const flags = demoAccount ? unsent.filter((id) => kept.has(id)) : [];
  const hardDeletes = [
    ...unsent.filter((id) => !flags.includes(id)),
    ...(demoAccount ? [] : flagged),
  ];

  const merged = mergeResumeLists(local, docs, excluded);
  // `!(>=)`: a copy with no time of its own, on either side, is written.
  const sets = merged.filter((r) => { const c = byId.get(r.id); return !c || c.deleted || !(c.updatedAt >= r.updatedAt); });
  return { merged, sets, flags, hardDeletes, listAdd: hardDeletes, handled };
}

/**
 * The résumé store after a first sync: its plan applied to the store as it is NOW, not as it was
 * when the plan read it — the user may have typed, deleted or added a résumé while the sync read
 * the account and waited for its batch (R8-2). `snapshot` the résumés the plan was made from,
 * `merged` and `handled` from the plan, `before` when the plan read the store, `uid` the account
 * the list is now synced with (`syncedUid`: whose a later deletion is, R8-6).
 * A résumé unchanged since the snapshot takes its merged copy, or goes when the plan left it out;
 * one edited or added meanwhile stays as it is, and one deleted meanwhile stays deleted — the
 * watcher then sends those changes. Only the deletions the plan dealt with are forgotten. The
 * merged order is kept (then what was added meanwhile). Before, the merged list replaced the
 * store and every deletion was forgotten: an edit typed during the sync was lost, and a résumé
 * deleted during it came back — the batch had just written it to the cloud again.
 */
export function afterSync(state, { uid, snapshot, merged, handled, before }) {
  const seen = new Map(snapshot.map((r) => [r.id, r.updatedAt]));
  const current = new Map(state.resumes.map((r) => [r.id, r]));
  const touched = (r) => !seen.has(r.id) || seen.get(r.id) !== r.updatedAt;
  const resumes = [];
  for (const m of merged) {
    const now = current.get(m.id);
    if (now) resumes.push(touched(now) ? now : m);
    else if (!seen.has(m.id)) resumes.push(m);
  }
  const planned = new Set(merged.map((r) => r.id));
  resumes.push(...state.resumes.filter((r) => !planned.has(r.id) && touched(r)));
  return {
    ...state,
    resumes,
    activeId: resumes.some((r) => r.id === state.activeId) ? state.activeId : (resumes[0]?.id ?? state.activeId),
    ...withoutDeletions(state, handled, before),
    syncedUid: uid ?? state.syncedUid ?? null,
  };
}

/**
 * The local changes since the last look, added to the queue waiting for the next flush.
 * `writes` (Map id → résumé), `deletes` (Set of ids) and `kept` (Set: the deletes whose copy
 * deleted was an original — flagged in a demo account, planFlush) come back as new objects, with
 * `dirty` true when anything changed. A résumé deleted and put back before the flush (a restored
 * original) is written, not deleted.
 */
export function queueChanges({ writes, deletes, kept = new Set() }, prev = [], current = []) {
  const nextWrites = new Map(writes);
  const nextDeletes = new Set(deletes);
  const nextKept = new Set(kept);
  let dirty = false;
  const currentIds = new Set(current.map((r) => r.id));
  for (const r of prev) {
    if (currentIds.has(r.id)) continue;
    nextWrites.delete(r.id);
    nextDeletes.add(r.id);
    // The copy deleted decides: marked and deleted before a flush, the cloud's copy is not marked.
    if (isOriginal(r)) nextKept.add(r.id);
    else nextKept.delete(r.id);
    dirty = true;
  }
  const before = new Map(prev.map((r) => [r.id, r]));
  for (const r of current) {
    const p = before.get(r.id);
    if (p && p.updatedAt === r.updatedAt) continue;
    nextDeletes.delete(r.id);
    nextKept.delete(r.id);
    nextWrites.set(r.id, r);
    dirty = true;
  }
  return { writes: nextWrites, deletes: nextDeletes, kept: nextKept, dirty };
}

/**
 * One flush of the queue: `sets` to write, the ids of deleted originals to `flag` (`kept`,
 * queueChanges; a demo account's only), other ids to remove and to add to the deletion list
 * (`listAdd`). Nothing comes off the list: a résumé written again stays listed, so a stale device
 * cannot resurrect it — an original neither. A demo account never lists an original it deletes
 * (it flags it), so a listed one was deleted for good ("Stop keeping", then Delete), and the flush
 * that took a stale device's kept copy of it off the list brought it back on every device
 * (V2OWNER-DATA-0).
 */
export function planFlush(writes, deletes, { demoAccount = false, kept = new Set() } = {}) {
  const flags = demoAccount ? deletes.filter((id) => kept.has(id)) : [];
  const hardDeletes = deletes.filter((id) => !flags.includes(id));
  return { sets: writes, flags, hardDeletes, listAdd: hardDeletes };
}
