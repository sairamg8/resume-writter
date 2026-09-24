// Which copies of each résumé this browser has seen, so the cloud sync can tell another device's
// edit from its own (R2-004). A copy's version is its `updatedAt`; clocks differ between devices,
// so versions are only ever compared for equality, never for which is later.
//
// Until R2-004 a page left open wrote its stale copy over another device's later edit: a flush
// set the whole résumé without looking at the cloud, and a first sync kept whichever copy was
// newer — the other one's edit was gone on every device, with no word. Now:
//   - a résumé changed on both sides since this browser last knew the cloud's copy keeps both:
//     this browser's copy under its id (the editor open on it is not changed under the user), and
//     the other device's as a new résumé, "<name> (conflict copy)";
//   - a copy here unchanged since then takes the cloud's newer one;
//   - a deletion made from a copy older than the cloud's is not sent: the newer copy comes back,
//     as a deletion made offline already did at a first sync (R8-0).
// With no version of a résumé known — a list from before this build, a résumé new here — the
// first sync decides as before (the newer copy wins).
// Plain functions, no Firebase: the engine (cloudSyncEngine.js, cloudSyncQueue.js) and the first
// sync's plan (cloudSyncPlan.js) run them; tests/pdf/18-cloud-sync-stale-tab.test.mjs drives them.
import { newId } from '@/utils/ids';

const add = (map, id, version) => {
  if (!Number.isFinite(version)) return;
  if (!map.has(id)) map.set(id, new Set());
  map.get(id).add(version);
};

/**
 * What one page knows of one account's résumés:
 *   reset()           another account, or none: forget everything
 *   base(versions)    { id: version } the store kept — the cloud's copies this browser last knew
 *                     (cloudVersions: afterSync, noteCloudVersions), of the account the list is synced with
 *   synced(list)      these copies are the cloud's now — read by a first sync, or sent
 *   held(list)        these copies were in this page's store (its own edits, another tab's save)
 *   isSynced(id, v)   the cloud held, or was sent, version v of `id`
 *   elsewhere(id, v)  version v of `id` was made on another device: a version the cloud held is
 *                     known here, and this one was never seen here
 */
export function createLineage() {
  const synced = new Map();
  const held = new Map();
  return {
    reset() { synced.clear(); held.clear(); },
    base(versions) {
      if (!versions || typeof versions !== 'object') return;
      for (const [id, v] of Object.entries(versions)) add(synced, id, v);
    },
    synced(list) { list.forEach((r) => add(synced, r.id, r.updatedAt)); },
    held(list) { list.forEach((r) => add(held, r.id, r.updatedAt)); },
    isSynced: (id, v) => Boolean(synced.get(id)?.has(v)),
    elsewhere: (id, v) => synced.has(id) && !synced.get(id).has(v) && !held.get(id)?.has(v),
  };
}

/** `doc` — another device's copy — as a new résumé of its own: "<name> (conflict copy)", no original. */
export function conflictCopy(doc, id = newId('resume')) {
  const { keep: _keep, deleted: _deleted, restoredAt: _restoredAt, ...rest } = doc;
  return { ...rest, id, name: `${doc.name || 'Untitled Resume'} (conflict copy)` };
}

/**
 * A first sync's résumés here (`local`) against the account's live copies (`docs`: not deleted,
 * not left out of the merge), by what `lineage` knows. Returns { pulled, forked, copies }:
 *   pulled  ids whose copy here is one the cloud had: the cloud's newer copy is loaded, whatever
 *           the clocks say
 *   forked  ids changed on both sides: the copy here is kept and written
 *   copies  the cloud's copies of the forked ones, as new résumés (conflictCopy)
 */
export function sortOut(local, docs, lineage, copyId = () => newId('resume')) {
  const here = new Map(local.filter(Boolean).map((r) => [r.id, r]));
  const pulled = new Set();
  const forked = new Set();
  const copies = [];
  for (const doc of docs) {
    const mine = here.get(doc.id);
    if (!mine || mine.updatedAt === doc.updatedAt || !lineage.elsewhere(doc.id, doc.updatedAt)) continue;
    if (lineage.isSynced(doc.id, mine.updatedAt)) pulled.add(doc.id);
    else {
      forked.add(doc.id);
      copies.push(conflictCopy(doc, copyId()));
    }
  }
  return { pulled, forked, copies };
}

/**
 * One flush against the server's copies of what it sends (`docs`: those that exist). Returns
 *   writes   `writes` — each still written: a copy made on another device goes on as a new résumé
 *   copies   those copies (conflictCopy): written in the same batch, and added to the store
 *   deletes  `deletes` without those whose cloud copy was made on another device
 *   back     those cloud copies: not deleted — put back in the store
 * A flagged copy (a demo account's deleted original) or none at all is nobody's edit: as before.
 */
export function checkFlush({ writes, deletes, docs, lineage, copyId = () => newId('resume') }) {
  const cloud = new Map(docs.filter((d) => d && !d.deleted).map((d) => [d.id, d]));
  const theirs = (id, mine) => {
    const doc = cloud.get(id);
    return doc && doc.updatedAt !== mine && lineage.elsewhere(id, doc.updatedAt) ? doc : null;
  };
  const copies = writes.map((r) => theirs(r.id, r.updatedAt)).filter(Boolean).map((doc) => conflictCopy(doc, copyId()));
  const back = deletes.map((id) => theirs(id, undefined)).filter(Boolean);
  const kept = new Set(back.map((d) => d.id));
  return { writes, copies, deletes: deletes.filter((id) => !kept.has(id)), back };
}
