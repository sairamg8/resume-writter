// The Firestore calls behind the cloud sync of a plain list (collectionSyncEngine.js) — the jobs
// under `users/{uid}/jobs`, the boards under `users/{uid}/boards` — with the SDK's functions passed
// in (`fs`: collection, doc, getDocsFromServer, getDocFromServer, writeBatch, arrayUnion,
// arrayRemove), as cloudSyncIo.js does for the résumés, so the tests run this very code against a
// fake Firestore (tests/pdf/fake-firestore.mjs). firestore.rules keeps every document under
// `users/{uid}` to that account.
//
// Reads go to the server only (R8-4: a sync planned from the SDK's stale cache wrote it back over
// newer work). The deletion list is never read before it is written: ids are added and removed in
// the batch itself, so no entry another device adds meanwhile is lost.
//
// An item document carries two fields of the sync's own, its version and its writer (collectionSyncRev.js):
// read off a copy as it is read (`stamps`, id → stamp, beside the items) and added to it as it is written.
import { BY_FIELD, REV_FIELD, splitStamp } from './collectionSyncRev.js';

/** The item a document holds, with the document's own id and without the sync's two fields; its stamp. */
const splitDoc = (d) => {
  const { item, stamp } = splitStamp(d.data());
  return { item: { ...item, id: d.id }, stamp };
};

/** `{ docs, stamps }` of the documents `snaps`: the items, and id → stamp. */
const itemsOf = (snaps) => {
  const all = snaps.map(splitDoc);
  return { docs: all.map((x) => x.item), stamps: new Map(all.map((x) => [x.item.id, x.stamp])) };
};

/** An item as the server takes it: what its JSON holds (a field holding `undefined` left out, as the SDK refuses one). */
export const asStored = (x) => JSON.parse(JSON.stringify(x));

/** `x` as the server takes it, with its stamp (`{ rev, by }`) when it has one. */
const stored = (x, stamp) => asStored(stamp ? { ...x, [REV_FIELD]: stamp.rev, [BY_FIELD]: stamp.by } : x);

/** The path segments of item `id` of list `name` in account `uid`: what the size guard counts. */
export const itemPath = (name, uid, id) => ['users', uid, name, id];

/**
 * Whether Firestore can name a document `id`: not empty, no "/" (a path, not an id), not "." or
 * "..", not "__…__". One it cannot was never in the cloud (an imported job's "linkedin/3912345",
 * held: R5-HUNT7), so its deletion is nothing to send (R5-HUNT8).
 */
export const cloudCanName = (id) => typeof id === 'string' && id !== '' && !id.includes('/')
  && id !== '.' && id !== '..' && !/^__.*__$/.test(id);

export function collectionIo(fs, db, name) {
  const itemsCol = (uid) => fs.collection(db, 'users', uid, name);
  const itemDoc = (uid, id) => fs.doc(db, ...itemPath(name, uid, id));
  const metaDoc = (uid) => fs.doc(db, 'users', uid, 'meta', name);

  return {
    /** The account's list as a first sync needs it: `{ docs, stamps, deleted, order }`. */
    async read(uid) {
      const [snap, meta] = await Promise.all([fs.getDocsFromServer(itemsCol(uid)), fs.getDocFromServer(metaDoc(uid))]);
      const m = meta.exists() ? meta.data() : {};
      const ids = (v) => (Array.isArray(v) ? v.filter((id) => typeof id === 'string') : []);
      return { ...itemsOf(snap.docs), deleted: ids(m.deleted), order: ids(m.order) };
    },

    /** The server's copies of these items now, those that exist, `{ docs, stamps }`: a flush keeps a newer one another device wrote. */
    async readItems(uid, ids) {
      const snaps = await Promise.all(ids.map((id) => fs.getDocFromServer(itemDoc(uid, id))));
      return itemsOf(snaps.filter((d) => d.exists()));
    },

    /**
     * One batch: whole items written (`sets`) — each id comes off the deletion list, as an edit
     * made where the deletion was never seen wins (collectionSyncPlan.js) — ids removed and added to
     * it (`deletes`), and the list's `order` when given. Each item goes with its stamp from `stamps`
     * (id → { rev, by }) when it has one. Resolves when the server has it.
     */
    commit(uid, { sets = [], deletes = [], order = null, stamps = null }) {
      const batch = fs.writeBatch(db);
      sets.forEach((x) => batch.set(itemDoc(uid, x.id), stored(x, stamps?.get(x.id))));
      deletes.forEach((id) => batch.delete(itemDoc(uid, id)));
      if (deletes.length) batch.set(metaDoc(uid), { deleted: fs.arrayUnion(...deletes) }, { merge: true });
      if (sets.length) batch.set(metaDoc(uid), { deleted: fs.arrayRemove(...sets.map((x) => x.id)) }, { merge: true });
      if (order) batch.set(metaDoc(uid), { order }, { merge: true });
      return batch.commit();
    },
  };
}
